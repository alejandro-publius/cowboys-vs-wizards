// Presenter: plays Engine events, in order, against a displayed copy of the
// Player_View (publicState(state, "cowboy")) and drives an injected renderer
// through the epoch scheduler. Engine events are authoritative: each impact
// applies its event's `after` value and nothing here computes damage. Fields
// an event does not carry (a summoned troop's entry, hands, counts, discards,
// allowances, revision, result) are copied from the batch's `to` at the event
// that changes them, so after a batch's last event the displayed state must
// deep-equal `to`.
//
// Renderer interface; returned times are ms from the call:
//   reset(view)  clear()  setTroopOrbs(side, slot, n)  setBaseOrbs(side, n)
//   summon({ side, slot, cardId, health }) -> { impact, end }
//   attack({ attacker, target }) -> { impact, end }     shapes from the damage event
//   spell({ spell, cardId, caster, target }) -> { impact, end }
//   remove({ side, slot }) -> { end }
//   move({ side, from, to }) -> { end }
// Optional: clashReady(troops, ms) shows a pre-attack cue for ms on the
// { side, slot } of every attacker in the damage events that follow a clash
// pause, past any trap-trigger events between them; ms then covers the clash
// pause and those triggers' pauses. clashReady([], 0) ends it as the attacks
// start.
//
// Traps (issue #99 T6, contract section 5): trap-set and trap-trigger are
// timed pauses with no renderer call. trap-set copies the setter's trap zone,
// hand, handCount and allowance from `to`; the opponent's `to` holds only the
// face-down marker and no hand. trap-trigger clears the trap zone from `to`
// and appends the revealed event.cardId to the owner's displayed discard; a
// later defeat in the same clash copies the rest of the discard. enqueue
// throws for an opponent's trap-set that still names a cardId: project the
// events with publicEvents(events, to.viewer) first.
//
// drawing() is { key, side, cardId, handIndex, ms } during a visible draw's
// pause, else null. handIndex identifies the appended card even when the hand
// already holds another copy of cardId. The event carries no card ID. The key is
// unique per played draw and ms is the pause. A draw for a side whose hand
// `to` lacks (the Wizard) is never reported.
//
// Errors. enqueue throws for an unsupported event type before queueing
// anything. A displayed state that differs from a batch's `from` when the
// batch starts, or from its `to` after its last event, and anything thrown
// during playback (renderer, cue times, onChange, onDrain) go to onError, or
// are rethrown when there is no onError. Playback then halts: nothing more
// plays, onDrain is not called and busy() stays true until reset() or clear().

// Wait after each non-animated event, in ms; `pauses` overrides per type.
export const DEFAULT_PAUSES = Object.freeze({
  "phase-end": 150,
  "phase-start": 350,
  clash: 250,
  "round-start": 500,
  draw: 250,
  result: 300,
  "trap-set": 150,
  "trap-trigger": 400,
});

// Wait after a draw into a visible hand (the Cowboy's), in ms, unless
// `pauses.draw` is set: long enough for the overlay to fly the card from the
// deck to its hand position and settle before the next event.
export const VISIBLE_DRAW_PAUSE = 450;

const EVENT_TYPES = new Set(["summon", "spell", "damage", "defeat", ...Object.keys(DEFAULT_PAUSES)]);

// The first path where two plain JSON values differ, with both values there,
// or null when they are deep-equal. A key missing on one side is a difference.
function firstDifference(actual, expected, path = "") {
  if (Object.is(actual, expected)) return null;
  const here = { path: path || "(root)", actual, expected };
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return here;
  if (Array.isArray(actual) !== Array.isArray(expected)) return here;
  if (Array.isArray(expected)) {
    for (let i = 0; i < Math.max(actual.length, expected.length); i++) {
      const at = `${path}[${i}]`;
      if (i >= actual.length || i >= expected.length) return { path: at, actual: actual[i], expected: expected[i] };
      const found = firstDifference(actual[i], expected[i], at);
      if (found) return found;
    }
    return null;
  }
  for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    const at = path ? `${path}.${key}` : key;
    if (!Object.hasOwn(actual, key) || !Object.hasOwn(expected, key)) {
      return { path: at, actual: actual[key], expected: expected[key] };
    }
    const found = firstDifference(actual[key], expected[key], at);
    if (found) return found;
  }
  return null;
}

function mismatchError(name, { path, actual, expected }) {
  const show = (value) => (value === undefined ? "missing" : JSON.stringify(value));
  const error = new Error(
    `Presenter: displayed state differs from "${name}" at ${path}: displayed ${show(actual)}, "${name}" ${show(expected)}`,
  );
  error.path = path;
  return error;
}

// A cue time from the renderer, clamped at 0 because the scheduler refuses
// negative delays.
function cueTime(cue, key, method) {
  const value = cue?.[key];
  if (!Number.isFinite(value)) throw new TypeError(`renderer.${method}() must return a finite "${key}" in ms, got ${value}`);
  return Math.max(0, value);
}

const targetKey = (target) => (target.kind === "base" ? `base:${target.side}` : `troop:${target.side}:${target.slot}`);

// Copy `fields` of one side from `to`. A field `to` lacks (the hidden Wizard
// hand) is never copied.
function copySide(displayed, to, side, fields) {
  const source = to.sides[side];
  for (const field of fields) {
    if (Object.hasOwn(source, field)) displayed.sides[side][field] = structuredClone(source[field]);
  }
}

export function createPresenter({ scheduler, renderer, pauses = {}, onChange, onDrain, onError } = {}) {
  if (!scheduler || !renderer) throw new TypeError("createPresenter needs a scheduler and a renderer");

  let displayed = null;
  let queue = [];
  let batch = null; // { from, to, events } being played; kept after a failure so busy() stays true
  let halted = false;
  // reset() and clear() start a new generation; a callback from an older one
  // never acts, even when the scheduler epoch was not advanced.
  let generation = 0;
  const timers = new Set(); // scheduler ids of this generation's pending callbacks
  let drawing = null; // see drawing() above
  let draws = 0; // played visible draws, never reset, so a key is never reused

  const live = (gen) => gen === generation && !halted;

  function cancelTimers() {
    for (const id of timers) scheduler.cancel(id);
    timers.clear();
  }

  function fail(error) {
    halted = true;
    drawing = null;
    cancelTimers();
    if (!onError) throw error;
    onError(error);
  }

  // One playback step; anything it throws halts playback through onError.
  function attempt(gen, step) {
    try {
      step();
    } catch (error) {
      if (gen !== generation || halted) throw error;
      fail(error);
    }
  }

  function later(gen, ms, step) {
    if (!live(gen)) return;
    const id = scheduler.after(Math.max(0, ms), () => {
      timers.delete(id);
      if (live(gen)) attempt(gen, step);
    });
    timers.add(id);
  }

  // Report a change. False when the listener reset, cleared or halted playback.
  function changed(gen) {
    onChange?.(structuredClone(displayed));
    return live(gen);
  }

  // Start every removal together; `done` runs when the longest one ends.
  function removeTogether(gen, slots, done) {
    let longest = 0;
    for (const { side, slot } of slots) {
      const cue = renderer.remove({ side, slot });
      if (!live(gen)) return;
      longest = Math.max(longest, cueTime(cue, "end", "remove"));
    }
    later(gen, longest, done);
  }

  // What each non-animated event changes, applied when it starts.
  const PATCHES = {
    "phase-start": (event) => {
      displayed.activeSide = event.side;
    },
    "round-start": (event, to) => {
      displayed.round = event.round;
      displayed.startingSide = event.startingSide;
      displayed.allowances = structuredClone(to.allowances);
    },
    draw: (event, to) => copySide(displayed, to, event.side, ["hand", "handCount", "deckCount"]),
    result: (event, to) => {
      displayed.result = structuredClone(to.result);
      displayed.activeSide = to.activeSide;
    },
    "trap-set": (event, to) => {
      copySide(displayed, to, event.side, ["trap", "hand", "handCount"]);
      displayed.allowances[event.side] = structuredClone(to.allowances[event.side]);
    },
    "trap-trigger": (event, to) => {
      copySide(displayed, to, event.side, ["trap"]);
      displayed.sides[event.side].discard.push(event.cardId);
    },
  };

  function playPause(gen, event, next) {
    const visibleDraw = event.type === "draw" && Object.hasOwn(batch.to.sides[event.side], "hand");
    const pause = pauses[event.type] ?? (visibleDraw ? VISIBLE_DRAW_PAUSE : DEFAULT_PAUSES[event.type]);
    const handIndex = visibleDraw ? displayed.sides[event.side].hand.length : null;
    const patch = PATCHES[event.type];
    if (patch) {
      patch(event, batch.to);
      if (visibleDraw) {
        const cardId = displayed.sides[event.side].hand[handIndex];
        if (cardId !== undefined) drawing = { key: `draw-${++draws}`, side: event.side, cardId, handIndex, ms: pause };
      }
      if (!changed(gen)) return;
    }
    if (event.type === "clash" && renderer.clashReady) {
      // The attackers come from the damage events playClash plays next,
      // including troops that a later event of the same clash defeats.
      // Trap triggers play between the clash and its damage events.
      const { events } = batch;
      let first = next;
      let wait = pause;
      for (; first < events.length && events[first].type === "trap-trigger"; first++) {
        wait += pauses["trap-trigger"] ?? DEFAULT_PAUSES["trap-trigger"];
      }
      const troops = [];
      for (let i = first; i < events.length && events[i].type === "damage"; i++) {
        const { side, slot } = events[i].attacker;
        if (Number.isInteger(slot) && !troops.some((each) => each.side === side && each.slot === slot)) {
          troops.push({ side, slot });
        }
      }
      if (troops.length > 0) {
        renderer.clashReady(troops, wait);
        if (!live(gen)) return;
      }
    }
    later(gen, pause, () => {
      drawing = null; // the drawn card has settled in the hand
      play(gen, next);
    });
  }

  function playSummon(gen, event, next) {
    const { to } = batch;
    const { side, slot, cardId } = event;
    const tributes = event.tributes ?? [];
    const enter = () => {
      copySide(displayed, to, side, ["hand", "handCount", "discard"]);
      displayed.allowances[side] = structuredClone(to.allowances[side]);
      if (!changed(gen)) return;
      const troop = to.sides[side].board[slot];
      const cue = renderer.summon({ side, slot, cardId, health: troop.health });
      if (!live(gen)) return;
      const impact = cueTime(cue, "impact", "summon");
      later(gen, impact, () => {
        displayed.sides[side].board[slot] = structuredClone(troop);
        renderer.setTroopOrbs(side, slot, troop.health);
        changed(gen);
      });
      later(gen, Math.max(impact, cueTime(cue, "end", "summon")), () => play(gen, next));
    };
    if (tributes.length === 0) return enter();
    removeTogether(
      gen,
      tributes.map((each) => ({ side, slot: each })),
      () => {
        for (const each of tributes) displayed.sides[side].board[each] = null;
        enter();
      },
    );
  }

  function playSpell(gen, event, next) {
    const { to } = batch;
    const { caster, target, after, destination } = event;
    copySide(displayed, to, caster, ["hand", "handCount", "discard"]);
    displayed.allowances[caster] = structuredClone(to.allowances[caster]);
    if (!changed(gen)) return;
    const cue = renderer.spell({ spell: event.spell, cardId: event.cardId, caster, target: { ...target } });
    if (!live(gen)) return;
    const impact = cueTime(cue, "impact", "spell");
    later(gen, impact, () => {
      displayed.sides[target.side].board[target.slot].health = after;
      renderer.setTroopOrbs(target.side, target.slot, after);
      changed(gen);
    });
    later(gen, Math.max(impact, cueTime(cue, "end", "spell")), () => {
      if (destination == null) return play(gen, next);
      // A Singularity survivor moves only after the spell has finished.
      const move = renderer.move({ side: target.side, from: target.slot, to: destination });
      if (!live(gen)) return;
      later(gen, cueTime(move, "end", "move"), () => {
        const { board } = displayed.sides[target.side];
        board[destination] = board[target.slot];
        board[target.slot] = null;
        if (changed(gen)) play(gen, next);
      });
    });
  }

  // The consecutive damage events of one clash. Every attack starts now, even
  // one whose attacker is already at 0 displayed health. Impacts on one target
  // never overtake each other, so chained Base before/after values stay
  // monotone, and impacts due on the same tick fire in event order.
  function playClash(gen, index) {
    const { events } = batch;
    let stop = index;
    while (stop < events.length && events[stop].type === "damage") stop += 1;
    const group = events.slice(index, stop);
    renderer.clashReady?.([], 0); // the pre-attack cue ends as the attacks start
    if (!live(gen)) return;
    const start = scheduler.now();
    const cues = [];
    for (const { attacker, target } of group) {
      cues.push(renderer.attack({ attacker: { ...attacker }, target: { ...target } }));
      if (!live(gen)) return;
    }
    const latest = new Map(); // target key -> time of its latest impact
    let groupEnd = start;
    group.forEach((event, k) => {
      const key = targetKey(event.target);
      const at = Math.max(start + cueTime(cues[k], "impact", "attack"), latest.get(key) ?? start);
      latest.set(key, at);
      groupEnd = Math.max(groupEnd, at, start + cueTime(cues[k], "end", "attack"));
      later(gen, at - scheduler.now(), () => {
        const { target, after } = event;
        const view = displayed.sides[target.side];
        if (target.kind === "base") {
          view.baseOrbs = after;
          renderer.setBaseOrbs(target.side, after);
        } else {
          view.board[target.slot].health = after;
          renderer.setTroopOrbs(target.side, target.slot, after);
        }
        changed(gen);
      });
    });
    // Scheduled after every impact, so it runs after them even on the same tick.
    later(gen, groupEnd - scheduler.now(), () => play(gen, stop));
  }

  // Consecutive defeat events: after a clash group, or after the spell that
  // caused them. The models leave together.
  function playDefeats(gen, index) {
    const { events, to } = batch;
    let stop = index;
    while (stop < events.length && events[stop].type === "defeat") stop += 1;
    const group = events.slice(index, stop);
    removeTogether(gen, group, () => {
      for (const { side, slot } of group) displayed.sides[side].board[slot] = null;
      for (const side of new Set(group.map((event) => event.side))) copySide(displayed, to, side, ["discard"]);
      if (changed(gen)) play(gen, stop);
    });
  }

  function play(gen, index) {
    if (!live(gen)) return;
    const { events } = batch;
    if (index === events.length) return finishBatch(gen);
    const event = events[index];
    if (event.type === "summon") return playSummon(gen, event, index + 1);
    if (event.type === "spell") return playSpell(gen, event, index + 1);
    if (event.type === "damage") return playClash(gen, index);
    if (event.type === "defeat") return playDefeats(gen, index);
    return playPause(gen, event, index + 1);
  }

  function finishBatch(gen) {
    const difference = firstDifference(displayed, batch.to);
    if (difference) return fail(mismatchError("to", difference));
    batch = null;
    startNext(gen);
  }

  function startNext(gen) {
    if (!live(gen) || batch !== null) return;
    if (queue.length === 0) {
      onDrain?.();
      return;
    }
    batch = queue.shift();
    const difference = firstDifference(displayed, batch.from);
    if (difference) return fail(mismatchError("from", difference));
    displayed.revision = batch.to.revision;
    if (changed(gen)) play(gen, 0);
  }

  // reset() and clear() share this: drop the queue, the batch in progress and
  // every pending callback, and start a new generation.
  function drop() {
    generation += 1;
    cancelTimers();
    queue = [];
    batch = null;
    halted = false;
    drawing = null;
  }

  return {
    reset(view) {
      drop();
      displayed = structuredClone(view);
      renderer.reset(structuredClone(view));
      onChange?.(structuredClone(displayed));
    },

    // The displayed state is kept as it was; call reset(view) before the next enqueue.
    clear() {
      drop();
      renderer.clear();
    },

    // One accepted action: `from` and `to` are the Player_Views before and after it.
    enqueue({ from, to, events } = {}) {
      if (!Array.isArray(events)) throw new TypeError("enqueue needs { from, to, events } with an events array");
      for (const event of events) {
        if (!EVENT_TYPES.has(event?.type)) throw new Error(`Presenter: unsupported event type "${event?.type}"`);
        if (event.type === "trap-set" && event.side !== to?.viewer && Object.hasOwn(event, "cardId")) {
          throw new Error(`Presenter: the ${event.side} trap-set names its cardId to ${to?.viewer}; use publicEvents`);
        }
      }
      queue.push(structuredClone({ from, to, events }));
      const gen = generation;
      if (batch === null && !halted) attempt(gen, () => startNext(gen));
    },

    busy: () => batch !== null || queue.length > 0,
    drawing: () => (drawing === null ? null : { ...drawing }),
    displayed: () => structuredClone(displayed),
  };
}
