import assert from "node:assert/strict";
import test from "node:test";
import { TYPES } from "../../src/game/showdown/cards.js";
import { attackExample, attackPreviews } from "../../src/ui/showdown-3d/attack-preview.js";
import { viewFor } from "../../src/game/showdown/contract.js";
import { applyAction, createShowdown, legalActions, opponent, random } from "../../src/game/showdown/rules.js";
import { createShowdownSession } from "../../src/match/showdown-session.js";
import { turnDuel } from "../../src/match/showdown-turn.js";
import { presentationBeats } from "../../src/ui/showdown-3d/event-positions.js";

function fixture(cowboy, wizard, side = "cowboy") {
  const state = createShowdown(7, { first: side, opening: { cowboy, wizard } });
  state.turn = 5;
  return state;
}
const actor = (type, health) => ({ type, health });

test("every troop opens a real rules-engine preview, including no-attack Guard, Ride, and Last Stand", () => {
  for (const [id, card] of Object.entries(TYPES)) {
    const previews = attackPreviews(id);
    // Singularity is a spell with its own area gallery, checked by the generated properties below.
    assert.equal(previews.length > 0, card.kind === "troop" || id === "wizard-singularity", id);
    if (card.kind !== "troop") continue;
    for (const [mode] of previews) {
      const example = attackExample(id, mode);
      const events = example.trace[0].events;
      const beats = presentationBeats(example.trace);
      assert.ok(example.summary && beats.length > 0, id);
      if (mode === "attack") assert.equal(events[0].cardId, id + "-0");
      if (mode === "guard") assert.equal(events[0].target, id + "-0");
      if (mode === "ride") assert.ok(beats.some((beat) => beat.kind === "ride"));
      if (mode === "laststand")
        assert.ok(beats.some((beat) => beat.kind === "laststand" && beat.cardId === id + "-0"));
      if (mode === "attack" && card.keys.includes("sweep"))
        assert.ok(beats.some((beat) => beat.kind === "sweep"));
    }
  }
  assert.equal(attackExample("wizard-bone-wall", "attack"), null);
});
function present(before, action) {
  assert.ok(legalActions(before).some((a) => JSON.stringify(a) === JSON.stringify(action)));
  const { state: after, events } = applyAction(before, action);
  return presentationBeats([
    { before: viewFor(before, before.active), after: viewFor(after, before.active), events },
  ]);
}

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
  const rope = fixture([actor("cowboy-billy", 4)], [actor("wizard-skeleton", 2)]);
  rope.sides.cowboy.hand = ["cowboy-lasso-1"];
  const [, tie] = present(rope, { type: "spell", cardId: "cowboy-lasso-1", target: 0 });
  assert.equal(tie.kind, "lasso");
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
