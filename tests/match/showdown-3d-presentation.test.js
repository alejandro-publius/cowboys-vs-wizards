import assert from "node:assert/strict";
import test from "node:test";
import { TYPES } from "../../src/game/showdown/cards.js";
import { attackExample, attackPreviews } from "../../src/ui/showdown-3d/attack-preview.js";
import { viewFor } from "../../src/game/showdown/contract.js";
import { applyAction, createShowdown, legalActions, opponent, random } from "../../src/game/showdown/rules.js";
import { createShowdownSession } from "../../src/match/showdown-session.js";
import { turnDuel } from "../../src/match/showdown-turn.js";
import { LAST_CALL_TIMING, presentationBeats } from "../../src/ui/showdown-3d/event-positions.js";
import { SPELL_STUDIES } from "../../src/ui/showdown-3d/spell-studies.js";

function fixture(cowboy, wizard, side = "cowboy") {
  const state = createShowdown(7, { first: side, opening: { cowboy, wizard } });
  state.turn = 5;
  return state;
}
const actor = (type, health) => ({ type, health });

test("Last Call has one Sheriff hit followed by the Wizard's Rune Cannon counter", () => {
  const example = attackExample("cowboy-sheriff", "last-call");
  const beats = presentationBeats(example.trace);
  assert.deepEqual(beats.map(beat => beat.kind), ["last-call", "blade"]);
  const [shot, counter] = beats;
  assert.deepEqual([shot.duration, shot.contact], [LAST_CALL_TIMING.duration, LAST_CALL_TIMING.contact]);
  assert.equal(shot.pre.sides.wizard.board[0].health, 4);
  assert.equal(shot.hit.sides.wizard.board[0].health, 3);
  assert.equal(shot.hit.sides.cowboy.board[0].health, 3);
  assert.equal(counter.counter, true);
  assert.equal(counter.pre.sides.cowboy.board[0].health, 3);
  assert.equal(counter.hit.sides.cowboy.board[0].health, 1);
  assert.equal(presentationBeats(attackExample("cowboy-sheriff", "attack").trace)[0].kind, "gun");
});

test("spell studies retain the Wizard's actual hit and the Sheriff's counter", () => {
  const standard = attackExample("wizard-wizard", "attack");
  for (const [mode, { timing }] of Object.entries(SPELL_STUDIES)) {
    const example = attackExample("wizard-wizard", mode);
    assert.deepEqual(example.trace[0].events, standard.trace[0].events, mode);
    assert.deepEqual(example.before, standard.before, mode);
    assert.deepEqual(example.end, standard.end, mode);
    const [hit, counter] = presentationBeats(example.trace);
    assert.equal(hit.kind, "spell-study");
    assert.equal(hit.spellStudy, mode);
    assert.deepEqual([hit.duration, hit.contact], timing);
    assert.equal(hit.pre.sides.cowboy.board[0].health, 3);
    assert.equal(hit.hit.sides.cowboy.board[0].health, 1);
    assert.equal(counter.counter, true);
    assert.equal(counter.spellStudy, undefined);
    assert.equal(counter.kind, "gun");
    assert.equal(counter.hit.sides.wizard.board[0].health, 3);
  }
  assert.equal(presentationBeats(standard.trace)[0].kind, "blade");
});

test("every troop opens a real rules-engine preview, including no-attack Guard, Ride, and Last Stand", () => {
  for (const [id, card] of Object.entries(TYPES)) {
    const previews = attackPreviews(id);
    const hasCardPreview = ["wizard-singularity", "wizard-hellfire", "cowboy-lasso", "cowboy-deadeye", "cowboy-six-shooter"].includes(id);
    assert.equal(previews.length > 0, ["troop", "trap", "location"].includes(card.kind) || hasCardPreview, id);
    if (card.kind !== "troop") continue;
    for (const [mode] of previews) {
      const example = attackExample(id, mode);
      const events = example.trace[0].events;
      const beats = presentationBeats(example.trace);
      assert.ok(example.summary && beats.length > 0, id);
      if (mode === "attack") assert.equal(events[0].cardId, id + "-0");
      if (mode === "guard") assert.equal(events[0].target, id + "-0");
      if (mode === "ride") assert.ok(beats.some((beat) => beat.kind === "ride"));
      if (mode === "scout") assert.ok(beats.some((beat) => beat.kind === "draw"));
      if (mode === "laststand")
        assert.ok(beats.some((beat) => beat.kind === "laststand" && beat.cardId === id + "-0"));
      if (mode === "attack" && card.keys.includes("sweep"))
        assert.ok(beats.some((beat) => beat.kind === "sweep"));
    }
  }
  assert.equal(attackExample("wizard-bone-wall", "attack"), null);
});

test("the Hellfire gallery casts one real spell and strikes all three troops together", () => {
  const example = attackExample("wizard-hellfire", "cast");
  const beats = presentationBeats(example.trace);
  assert.deepEqual(beats.map((beat) => beat.kind), ["play", "hellfire", "burial"]);
  assert.equal(beats[1].targets.length, 3);
  const start = example.before.sides.cowboy.board;
  const end = example.end.sides.cowboy.board;
  assert.deepEqual(end.map((troop) => troop.health), start.map((troop) => troop.health - 1));
});

test("the Cowboy replays use actual attack targets and preserve the Lasso's orbs", () => {
  const dynamite = attackExample("cowboy-dynamiter", "attack");
  const [throwBeat] = presentationBeats(dynamite.trace);
  assert.equal(throwBeat.cardId, "cowboy-dynamiter-0");
  assert.ok(throwBeat.contact > 500 && throwBeat.duration - throwBeat.contact >= 550);
  const gatling = attackExample("cowboy-gatling-crew", "attack");
  const sweep = presentationBeats(gatling.trace).find((beat) => beat.kind === "sweep");
  assert.deepEqual(sweep.targets.map((target) => target.slot), [1, 2]);
  for (const { slot } of sweep.targets) {
    assert.equal(sweep.hit.sides.wizard.board[slot].health, sweep.pre.sides.wizard.board[slot].health - 1);
  }
  const lasso = attackExample("cowboy-lasso", "cast");
  const beats = presentationBeats(lasso.trace);
  assert.deepEqual(beats.map((beat) => beat.kind), ["play", "lasso", "burial"]);
  assert.deepEqual(beats[1].from, { side: "cowboy", slot: 0 });
  const start = lasso.before.sides.wizard.board[0];
  const end = lasso.end.sides.wizard.board[0];
  assert.equal(start.stunned, false);
  assert.equal(end.stunned, true);
  assert.equal(end.health, start.health);
});
function present(before, action, options) {
  assert.ok(legalActions(before).some((a) => JSON.stringify(a) === JSON.stringify(action)));
  const { state: after, events } = applyAction(before, action);
  return presentationBeats([
    { before: viewFor(before, before.active), after: viewFor(after, before.active), events },
  ], options);
}

test("live Wizard attacks cycle through Rune Cannon and all eight casts with identical orb changes", () => {
  const action = { type: "attack", slot: 0, target: 0 };
  const casts = [undefined, ...Object.keys(SPELL_STUDIES)];
  for (const [round, cast] of casts.entries()) {
    const state = fixture([actor("cowboy-sheriff", 3)], [actor("wizard-wizard", 4)], "wizard");
    state.first = "cowboy";
    state.turn = 2 * round + 2;
    const standard = present(state, action);
    const live = present(state, action, { match: true });
    assert.equal(live[0].kind, cast ? "spell-study" : "blade");
    assert.equal(live[0].spellStudy, cast);
    assert.deepEqual(live.map(beat => beat.hit), standard.map(beat => beat.hit));
    assert.equal(live[1].kind, "gun");
    assert.equal(live[1].counter, true);
  }
  const covered = fixture([actor("cowboy-sheriff", 3)], [actor("wizard-wizard", 4)], "wizard");
  covered.sides.cowboy.board[0].cover = true;
  assert.deepEqual(present(covered, action, { match: true }).map(beat => beat.kind), ["blade"]);
  const open = fixture([], [actor("wizard-wizard", 4)], "wizard");
  const [base] = present(open, { ...action, target: "base" }, { match: true });
  assert.equal(base.kind, "blade");
  assert.equal(base.hit.sides.cowboy.base, open.sides.cowboy.base - 2);
});

test("live Last Call tracks an uncovered Wizard and keeps ordinary Sheriff attacks and Wizard counters", () => {
  const action = { type: "attack", slot: 0, target: 0 };
  const duel = fixture([actor("cowboy-sheriff", 3)], [actor("wizard-wizard", 4)]);
  const [shot, counter] = present(duel, action, { match: true });
  assert.equal(shot.kind, "last-call");
  assert.equal(shot.hit.sides.wizard.board[0].health, 3);
  assert.equal(counter.kind, "blade");
  assert.equal(counter.hit.sides.cowboy.board[0].health, 1);
  duel.sides.wizard.board[0].cover = true;
  assert.deepEqual(present(duel, action, { match: true }).map(beat => beat.kind), ["gun"]);
  const skeleton = fixture([actor("cowboy-sheriff", 3)], [actor("wizard-skeleton", 3)]);
  assert.equal(present(skeleton, action, { match: true })[0].kind, "gun");
  const lethal = fixture([actor("cowboy-sheriff", 3)], [actor("wizard-wizard", 1)]);
  const beats = present(lethal, action, { match: true });
  assert.deepEqual(beats.map(beat => beat.kind), ["last-call", "burial"]);
  assert.equal(beats[0].hit.sides.wizard.board[0].health, 0);
});

test("Ranger, Dragon counter, and a cancelled Dragon attack use their own contact snapshots", () => {
  const s = createShowdownSession(turnDuel("dragon-c5"));
  const hit = [];
  s.act({ type: "attack", slot: 0, target: 0 }, (step) => hit.push(step));
  const [shot, bite] = presentationBeats(hit);
  assert.equal(shot.kind, "gun");
  assert.equal(shot.pre.sides.wizard.board[0].health, 4);
  assert.equal(shot.hit.sides.wizard.board[0].health, 2);
  assert.equal(shot.hit.sides.cowboy.board[0].health, 4);
  assert.equal(bite.kind, "breath");
  assert.equal(bite.counter, true);
  assert.equal(bite.hit.sides.cowboy.board[0].health, 1);
  const reply = [];
  s.act({ type: "end" }, (step) => reply.push(step));
  const response = presentationBeats(reply);
  const trap = response.find((step) => step.kind === "trap");
  assert.equal(trap.stopped, true);
  assert.equal(trap.hit.sides.wizard.board[0].health, 0);
  assert.ok(response.every((step) => step.kind !== "sweep" && step.kind !== "breath"));
  assert.ok(reply.every((frame) => !Object.hasOwn(frame.after.sides.wizard, "traps")));
});

test("covered Last Stand, Ride, and lethal Sweep retain distinct contact outcomes", () => {
  const block = fixture([actor("cowboy-billy", 4)], [actor("wizard-jack-o-lantern", 1)]);
  block.sides.wizard.board[0].cover = true;
  const guard = present(block, { type: "attack", slot: 0, target: 0 });
  assert.deepEqual(
    guard.map((s) => s.kind),
    ["gun", "laststand", "burial"],
  );
  assert.equal(guard[0].blocked, 1);
  assert.equal(guard[1].hit.sides.cowboy.board[0].health, 3);
  assert.deepEqual(guard[2].from, { side: "wizard", slot: 0 });
  assert.equal(guard[2].hit.sides.wizard.discard.at(-1), guard[2].cardId);
  const ride = fixture([actor("cowboy-mounted-billy", 4)], [actor("wizard-skeleton", 3)]);
  const [bypass] = present(ride, { type: "attack", slot: 0, target: "base" });
  assert.equal(bypass.kind, "ride");
  assert.equal(bypass.hit.sides.wizard.base, 4);
  assert.equal(bypass.hit.sides.wizard.board[0].health, 3);
  const dragon = fixture(
    [actor("cowboy-billy", 1), actor("cowboy-sheriff", 4)],
    [actor("wizard-dragon", 5)],
    "wizard",
  );
  const fan = present(dragon, { type: "attack", slot: 0, target: 1 }).find((step) => step.kind === "sweep");
  assert.deepEqual(fan.targets, [{ side: "cowboy", slot: 0 }]);
  assert.equal(fan.hit.sides.cowboy.board[0].health, 0);
});

test("Hex stops an attack, Lasso shows a stun, and Hellfire groups public targets", () => {
  const trap = fixture([actor("cowboy-sheriff", 3)], [actor("wizard-skeleton", 2)]);
  trap.sides.wizard.traps = ["wizard-hex-1"];
  const stopped = present(trap, { type: "attack", slot: 0, target: 0 });
  assert.deepEqual(
    stopped.map((s) => s.kind),
    ["trap", "burial"],
  );
  assert.equal(stopped[0].stopped, true);
  assert.equal(stopped[0].hit.sides.cowboy.board[0].health, 3);
  const spell = fixture(
    [actor("cowboy-sheriff", 2), actor("cowboy-billy", 2)],
    [actor("wizard-skeleton", 2)],
    "wizard",
  );
  spell.sides.wizard.hand = ["wizard-hellfire-1"];
  const flame = present(spell, { type: "spell", cardId: "wizard-hellfire-1" });
  assert.deepEqual(
    flame.map((step) => step.kind),
    ["play", "hellfire", "burial"],
  );
  assert.equal(flame[1].targets.length, 2);
  const rope = fixture([], [actor("wizard-skeleton", 2)]);
  rope.sides.cowboy.hand = ["cowboy-lasso-1"];
  const [, tie] = present(rope, { type: "spell", cardId: "cowboy-lasso-1", target: 0 });
  assert.equal(tie.kind, "lasso");
  assert.equal(tie.from.at, "row");
  assert.equal(tie.hit.sides.wizard.board[0].stunned, true);
  assert.equal(tie.hit.sides.wizard.board[0].health, 2);
});

test("the visible draw comes from the deck without revealing the opposing hand", () => {
  const before = fixture([], []);
  const { state: after, events } = applyAction(before, { type: "end" });
  const drawFor = (seat) =>
    presentationBeats([{ before: viewFor(before, seat), after: viewFor(after, seat), events }]).find(
      (step) => step.kind === "draw",
    );
  const hidden = drawFor("cowboy");
  const visible = drawFor("wizard");
  assert.equal(hidden.from.at, "deck");
  assert.equal(hidden.targets[0].at, "hand");
  assert.equal(hidden.cardId, undefined);
  assert.equal(visible.cardId, after.sides.wizard.hand.at(-1));
  assert.equal(visible.hit.sides.wizard.deckCount, visible.pre.sides.wizard.deckCount - 1);
});

// --- Area Singularity gallery: generated properties -------------------------------------------

const count = (list, id) => list.filter((each) => each === id).length;

// Checks one area Singularity trace against its public before/after views.
function checkAreaSingularity(trace) {
  const { before, after, events } = trace[0];
  const side = events[0].side;
  const enemy = opponent(side);
  const spell = events[0].cardId;
  const beats = presentationBeats(trace);
  const contacts = beats.filter((beat) => beat.kind === "area-vortex");
  assert.equal(contacts.length, 1, "one contact snapshot");
  const [hit] = contacts;
  const foes = before.sides[enemy].board;
  const occupied = foes.flatMap((troop, slot) => (troop ? [slot] : []));
  assert.deepEqual(
    hit.targets.map(({ side: s, slot }) => [s, slot]),
    occupied.map((slot) => [enemy, slot]),
    "every occupied enemy slot is a target",
  );
  assert.deepEqual(hit.pre.sides, before.sides, "contact starts from the public before view");
  assert.deepEqual(
    hit.receiver.map((r) => r.hp),
    occupied.map((slot) => foes[slot].health),
  );
  foes.forEach((troop, slot) => {
    const shown = hit.hit.sides[enemy].board[slot];
    if (!troop) assert.equal(shown, null);
    else assert.equal(shown.health, troop.health - 1, `${troop.cardId} loses exactly one orb`);
  });
  assert.deepEqual(hit.hit.sides[side].board, before.sides[side].board, "no friendly troop changes");
  for (const s of [side, enemy]) assert.equal(hit.hit.sides[s].base, before.sides[s].base, `${s} base unchanged`);

  const lethal = occupied.filter((slot) => foes[slot].health === 1).map((slot) => foes[slot].cardId);
  const survivors = occupied.filter((slot) => foes[slot].health > 1).map((slot) => foes[slot].cardId);
  const final = beats.at(-1).hit.sides;
  const burials = beats.filter((beat) => beat.kind === "burial");
  assert.equal(burials.length, lethal.length + 1, "spell plus each lethal card buried once");
  assert.equal(burials.filter((b) => b.cardId === spell && b.targets[0].side === side).length, 1);
  for (const id of lethal) {
    assert.ok(final[enemy].board.every((t) => t?.cardId !== id), `${id} leaves the board`);
    const moves = burials.filter((b) => b.cardId === id);
    assert.equal(moves.length, 1, `${id} transfers once`);
    assert.deepEqual([moves[0].targets[0].side, moves[0].targets[0].at], [enemy, "discard"]);
    assert.equal(count(final[enemy].discard, id), 1);
    assert.equal(count(after.sides[enemy].discard, id), 1);
    assert.equal(count(final[side].discard, id), 0);
  }
  for (const id of survivors) assert.equal(count(burials.map((b) => b.cardId), id), 0, `${id} stays`);
  assert.ok(
    final[enemy].board.every((t) => !t || t.health >= 1),
    "no target remains on the board at zero orbs",
  );
  assert.deepEqual(
    final[enemy].board.map((t) => t && [t.cardId, t.health]),
    after.sides[enemy].board.map((t) => t && [t.cardId, t.health]),
    "replay ends on the rules engine's after view",
  );
  return { lethal: lethal.length, targets: occupied.length };
}

// Mirrors singularityExample in src/ui/showdown-3d/attack-preview.js for any layout:
// the lawful Hellfire action drives the replay, relabelled as the area Singularity.
function areaTrace(side, layout) {
  const enemy = opponent(side);
  const opening = { [side]: layout[side].filter(Boolean), [enemy]: layout[enemy].filter(Boolean) };
  const start = createShowdown(7, { first: side, opening });
  start.turn = 5;
  for (const [s, base] of [[enemy, 31], [side, 41]]) {
    const placed = start.sides[s].board.filter(Boolean);
    start.sides[s].board = layout[s].map((spot, slot) => {
      if (!spot) return null;
      const troop = placed.shift();
      troop.cardId = `${spot.type}-${base + slot}`;
      return troop;
    });
  }
  const ids = [side, enemy].flatMap((s) => start.sides[s].board.filter(Boolean).map((t) => t.cardId));
  assert.equal(new Set(ids).size, ids.length, "distinct card IDs");
  const caster = start.sides[side].board.find((t) => t?.cardId.startsWith("wizard-wizard-")).cardId;
  const effect = "wizard-hellfire-71";
  const spell = "wizard-singularity-71";
  start.sides[side].hand[0] = effect;
  const action = legalActions(start).find((a) => a.type === "spell" && a.cardId === effect);
  assert.ok(action, "Hellfire is legal");
  const { state: next, events } = applyAction(start, action);
  start.sides[side].hand[0] = spell;
  next.sides[side].discard[0] = spell;
  const before = viewFor(start, side);
  const after = viewFor(next, side);
  return [{ before, after, events: events.map((e) => ({ ...e, cardId: spell, caster, areaVortex: true })) }];
}

const TROOPS = Object.keys(TYPES).filter((id) => TYPES[id].kind === "troop");
const SEED = 172890;
const CASES = 240;

function generatedLayout(next, side) {
  const pick = (list) => list[Math.floor(next() * list.length)];
  const troop = (type) => ({ type, health: 1 + Math.floor(next() * TYPES[type].health) });
  const enemyMask = 1 + Math.floor(next() * 7);
  // Bias toward repeated types so duplicate openings are common.
  const pool = [pick(TROOPS), pick(TROOPS)];
  const foes = [0, 1, 2].map((slot) => (enemyMask & (1 << slot) ? troop(pick(pool)) : null));
  const casterSlot = Math.floor(next() * 3);
  const friends = [0, 1, 2].map((slot) =>
    slot === casterSlot ? troop("wizard-wizard") : next() < 0.5 ? troop(pick(TROOPS)) : null,
  );
  return { [side]: friends, [opponent(side)]: foes };
}

test("both authored area Singularity gallery replays satisfy the area contact properties", () => {
  const sheriffs = attackExample("wizard-singularity", "sheriffs");
  assert.deepEqual(checkAreaSingularity(sheriffs.trace), { lethal: 0, targets: 3 });
  const graveyard = attackExample("wizard-singularity", "graveyard");
  assert.deepEqual(checkAreaSingularity(graveyard.trace), { lethal: 1, targets: 2 });
  assert.equal(graveyard.trace[0].events[0].side, "cowboy");
  assert.ok(sheriffs.summary && graveyard.summary);
});

test("generated area Singularity layouts hit each enemy troop once in one contact", () => {
  const next = random(SEED);
  const seen = { cowboy: 0, wizard: 0, lethal: 0, allLethal: 0, holes: 0, duplicates: 0 };
  for (let n = 0; n < CASES; n++) {
    const side = n % 2 ? "cowboy" : "wizard";
    const layout = generatedLayout(next, side);
    const foes = layout[opponent(side)];
    const label = `seed ${SEED} case ${n}: ${JSON.stringify(layout)}`;
    let result;
    try {
      result = checkAreaSingularity(areaTrace(side, layout));
    } catch (error) {
      error.message = `${label}\n${error.message}`;
      throw error;
    }
    seen[side]++;
    if (result.lethal) seen.lethal++;
    if (result.lethal === result.targets) seen.allLethal++;
    if (foes.some((f) => !f)) seen.holes++;
    const types = foes.filter(Boolean).map((f) => f.type);
    if (new Set(types).size < types.length) seen.duplicates++;
  }
  // The generator must actually reach the interesting shapes.
  for (const key of Object.keys(seen)) assert.ok(seen[key] >= 10, `${key} reached ${seen[key]} cases`);
});

test("a dropped hit or a split contact in a real gallery trace fails the area properties", () => {
  const [frame] = attackExample("wizard-singularity", "sheriffs").trace;
  assert.equal(frame.events.length, 3);
  const dropped = [{ ...frame, events: frame.events.slice(0, 2) }];
  assert.throws(() => checkAreaSingularity(dropped), /every occupied enemy slot is a target/);
  const split = [
    { ...frame, events: frame.events.slice(0, 1) },
    { ...frame, events: frame.events.slice(1) },
  ];
  assert.throws(() => checkAreaSingularity(split), /one contact snapshot/);
  assert.doesNotThrow(() => checkAreaSingularity([frame]));
});

test("ordinary Singularity still shows one targeted vortex", () => {
  const state = fixture([actor("cowboy-sheriff", 3), actor("cowboy-billy", 2)], [actor("wizard-wizard", 3)], "wizard");
  state.sides.wizard.hand = ["wizard-singularity-1"];
  const beats = present(state, { type: "spell", cardId: "wizard-singularity-1", target: 0 });
  assert.deepEqual(
    beats.map((b) => b.kind),
    ["play", "vortex", "burial"],
  );
  const [, vortex] = beats;
  assert.deepEqual(vortex.targets, [{ side: "cowboy", slot: 0 }]);
  assert.equal(vortex.hit.sides.cowboy.board[0].health, 2);
  assert.equal(vortex.hit.sides.cowboy.board[1].health, 2);
  assert.equal(beats[2].cardId, "wizard-singularity-1");
});

test("a lethal Singularity buries the targeted troop, its attached gear, then the spell", () => {
  const state = fixture([actor("cowboy-billy", 3), actor("cowboy-sheriff", 1)], [], "wizard");
  const target = state.sides.cowboy.board[1];
  const gear = "cowboy-six-shooter-1";
  const spell = "wizard-singularity-1";
  target.gear.push(gear);
  state.sides.wizard.hand = [spell];

  const action = { type: "spell", cardId: spell, target: 1 };
  const beats = present(state, action);
  assert.deepEqual(beats.map((beat) => beat.kind), ["play", "vortex", "burial", "burial", "burial"]);
  assert.deepEqual(beats[1].targets, [{ side: "cowboy", slot: 1 }]);
  assert.deepEqual(
    beats.slice(2).map(({ cardId, from, targets }) => [cardId, from.side, from.slot ?? from.at, targets[0].side, targets[0].at]),
    [
      [target.cardId, "cowboy", 1, "cowboy", "discard"],
      [gear, "cowboy", 1, "cowboy", "discard"],
      [spell, "wizard", "row", "wizard", "discard"],
    ],
  );
  const after = applyAction(state, action).state;
  for (const side of ["cowboy", "wizard"]) {
    assert.deepEqual(beats.at(-1).hit.sides[side].discard, after.sides[side].discard);
  }
});
