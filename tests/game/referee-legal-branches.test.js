// Legal-action and branch agreement with the frozen referee (scripts/referee/legal-branches.mjs).
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import test from "node:test";
import {BOARD_SIZE, legalActions} from "../../src/game/showdown/rules.js";
import {canonicalJson, sha256} from "../../scripts/referee/prove.mjs";
import {DECK_LISTS, VARIANTS, duels, recipe} from "../../scripts/referee/corpus.mjs";
import {applyInput, decodeInstance, initialState, seededDeal} from "../../scripts/referee/engine.mjs";
import {SLOTS, TRIBUTE_LISTS, candidateActions, classify, compareLegalBranches, engineSide, listedOrderView} from "../../scripts/referee/legal-branches.mjs";

const quickDuels = () => [...duels(recipe({quick: true}))];
// A corpus deal with chosen actions, carrying cardNames as corpus.mjs does.
const dealt = (seed, actions) => {
  const deal = seededDeal(seed, DECK_LISTS[VARIANTS[seed % VARIANTS.length]]);
  const cards = [...deal.decks.cowboy, ...deal.decks.wizard].map(decodeInstance);
  return {...deal, actions, cardNames: Object.fromEntries(cards.map((card) => [card.type, card.name]))};
};
const hash = (view) => sha256(canonicalJson(view));
const python = process.env.REFEREE_PYTHON || "python3";
const hasPython = spawnSync(python, ["--version"]).status === 0;
const needsPython = {skip: !hasPython && `${python} not found`};

test("candidates come from the boundary schema and cover every engine legal action", () => {
  assert.equal(SLOTS.length, BOARD_SIZE);
  assert.equal(TRIBUTE_LISTS.length, 11);
  assert.equal(new Set(TRIBUTE_LISTS.map(canonicalJson)).size, 11);
  let positions = 0;
  for (const duel of quickDuels()) {
    const eng = engineSide(duel);
    assert.deepEqual(eng.stats, {legalListed: eng.stats.legalListed, legalOutsideUniverse: 0, acceptedSetNotLegal: 0, primedMismatch: 0}, `seed ${duel.seed}`);
    assert.equal(eng.positions.length, eng.duel.actions.length + 1);
    for (const p of eng.positions.filter((each) => each.candidates)) {
      positions++;
      const keys = p.candidates.map(canonicalJson);
      assert.equal(new Set(keys).size, keys.length, `seed ${duel.seed} position ${p.k}: duplicate candidates`);
      for (const action of legalActions(p.state)) assert.ok(keys.includes(canonicalJson(action)), `seed ${duel.seed} position ${p.k}: ${JSON.stringify(action)}`);
    }
  }
  assert.ok(positions > 500, `only ${positions} positions walked`);
});

// Seed 5 (heavy decks): the Wizard opens with a free Bone Wall and ends the turn. The Cowboy then
// holds a free Sheriff and a Lasso, with the Bone Wall in enemy slot 0.
const seedFive = () => dealt(5, [{type: "summon", cardId: "wizard-bone-wall-1", tributes: []}, {type: "end"}]);
const same = (a) => (b) => canonicalJson(a) === canonicalJson(b);

test("the schema's absent-tributes summon and slot-alias spell are judged against their canonical forms", needsPython, async () => {
  const duel = seedFive();
  const cowboyTurn = engineSide(duel).positions[2];
  assert.equal(cowboyTurn.state.active, "cowboy");
  for (const action of [{type: "summon", cardId: "cowboy-sheriff-1"}, {type: "spell", cardId: "cowboy-lasso-1", slot: 0},
    {type: "spell", cardId: "cowboy-lasso-1", target: 0, slot: 0}]) {
    assert.ok(cowboyTurn.candidates.some(same(action)), JSON.stringify(action));
  }
  const run = await compareLegalBranches({duels: [duel], details: 64});
  assert.deepEqual(run.errors, []);
  const b = run.totals.branch;
  assert.equal(b.byClass.unexplained, 0);
  for (const form of ["F1", "F2"]) {
    const f = b.byForm[form];
    assert.ok(f.refereeAccepted > 0, form);
    assert.equal(f.engineAccepted, 0, `${form}: engine.mjs takes only the canonical form`);
    assert.equal(f.refereeSameAsCanonical, f.candidates, `${form}: referee verdict and state equal the canonical form's`);
    assert.equal(f.refereeDiffersFromCanonical, 0, form);
  }
  const atCowboyTurn = (cls) => run.samples[cls].filter((s) => s.position === 2).map((s) => [s.action, s.engineAccepted, s.refereeAccepted]);
  assert.deepEqual(atCowboyTurn("F2"), [[{type: "spell", cardId: "cowboy-lasso-1", slot: 0}, false, true],
    [{type: "spell", cardId: "cowboy-lasso-1", target: 0, slot: 0}, false, true]]);
  assert.ok(atCowboyTurn("F1").some(([action]) => same(action)({type: "summon", cardId: "cowboy-sheriff-1"})));
});

test("the candidate list ignores what is legal right now", () => {
  const state = initialState({...seededDeal(5), actions: []});
  const spent = structuredClone(state);
  Object.assign(spent, {summonUsed: true, castUsed: true, setUsed: true, attacking: true});
  assert.deepEqual(candidateActions(spent), candidateActions(state));
  assert.ok(candidateActions(state).some((action) => action.type === "attack"), "turn 1 still lists attacks");
});

test("engineSide keeps only accepted inputs and replays the same positions", () => {
  const [duel] = quickDuels();
  const eng = engineSide(duel);
  let state = initialState(duel);
  for (const input of eng.duel.actions) {
    const applied = applyInput(state, input);
    assert.equal(applied.accepted, true);
    state = applied.state;
  }
  assert.deepEqual(eng.positions.at(-1).state, state);
  assert.ok(eng.duel.actions.length < duel.actions.length, "the quick corpus seed 1 carries rejected probes");
});

const board = (ids) => [...ids, null, null, null].slice(0, 3).map((cardId) => cardId && {cardId});
const position = ({active = "wizard", hand, enemy = []}) => ({active,
  sides: {[active]: {hand, board: board([])}, [active === "wizard" ? "cowboy" : "wizard"]: {hand: [], board: board(enemy)}}});
const none = () => null;

test("classify names C1 only for Hellfire into an empty enemy board", () => {
  const action = {type: "spell", cardId: "wizard-hellfire-1"};
  const engine = [false, null], referee = [true, null, "r"];
  assert.equal(classify({state: position({hand: ["wizard-hellfire-1"]}), action, engine, referee, lookup: none}), "C1");
  assert.equal(classify({state: position({hand: ["wizard-hellfire-1"], enemy: ["cowboy-sheriff-1"]}), action, engine, referee, lookup: none}), "unexplained");
  assert.equal(classify({state: position({hand: ["wizard-hellfire-1"]}), action: {...action, target: 0}, engine, referee, lookup: none}), "unexplained");
});

test("classify names C2 only when the first copy agrees on both sides", () => {
  const state = position({active: "cowboy", hand: ["cowboy-dynamiter-1", "cowboy-sheriff-1", "cowboy-sheriff-2"]});
  const agreed = {engine: [true, "same"], referee: [true, null, "same"]};
  const later = {type: "summon", cardId: "cowboy-sheriff-2", tributes: []};
  const variantOf = (want) => (action) => (canonicalJson(action) === canonicalJson(want) ? agreed : null);
  assert.equal(classify({state, action: later, engine: [false, null], referee: [true, null, "x"],
    lookup: variantOf({...later, cardId: "cowboy-sheriff-1"})}), "C2");
  assert.equal(classify({state, action: later, engine: [false, null], referee: [true, null, "x"],
    lookup: () => ({engine: [true, "a"], referee: [true, null, "b"]})}), "unexplained");
  assert.equal(classify({state, action: {type: "cover", slot: 0}, engine: [false, null], referee: [true, null, "c"], lookup: none}), "unexplained");
});

// Two Cowboy troops on the board, the first wearing a Six-Shooter, and a Lasso already discarded.
const tributeBoard = () => [{cardId: "cowboy-sheriff-1", gear: ["cowboy-six-shooter-1"]}, {cardId: "cowboy-deputy-1", gear: []}, null];
const sortedViewFor = (summoned) => ({turn: 3, players: {
  cowboy: {base: 5, discard: ["cowboy-lasso-1", "cowboy-sheriff-1", "cowboy-six-shooter-1", "cowboy-deputy-1"], troops: [{id: summoned}, null, null]},
  wizard: {base: 5, discard: [], troops: [null, null, null]}}});
const withDiscard = (view, discard) => ({...view, players: {...view.players, cowboy: {...view.players.cowboy, discard}}});

test("listedOrderView reorders only the tribute block: each troop, then its gear, in listed order", () => {
  const pre = {active: "cowboy", sides: {cowboy: {board: tributeBoard()}}};
  const sorted = sortedViewFor("cowboy-mounted-billy-1");
  assert.deepEqual(listedOrderView(sorted, pre, [1, 0]),
    withDiscard(sorted, ["cowboy-lasso-1", "cowboy-deputy-1", "cowboy-sheriff-1", "cowboy-six-shooter-1"]));
  assert.deepEqual(sorted.players.cowboy.discard, ["cowboy-lasso-1", "cowboy-sheriff-1", "cowboy-six-shooter-1", "cowboy-deputy-1"], "input untouched");
  assert.deepEqual(listedOrderView(sorted, pre, [0, 1]), sorted, "slot order is the identity");
  // Fail closed when the block is split, incomplete or out of order, or a listed slot is empty or repeated.
  assert.equal(listedOrderView(withDiscard(sorted, ["cowboy-sheriff-1", "cowboy-lasso-1", "cowboy-six-shooter-1", "cowboy-deputy-1"]), pre, [1, 0]), null);
  assert.equal(listedOrderView(withDiscard(sorted, ["cowboy-lasso-1", "cowboy-sheriff-1", "cowboy-deputy-1"]), pre, [1, 0]), null);
  assert.equal(listedOrderView(withDiscard(sorted, ["cowboy-lasso-1", "cowboy-six-shooter-1", "cowboy-sheriff-1", "cowboy-deputy-1"]), pre, [1, 0]), null);
  assert.equal(listedOrderView(sorted, pre, [2, 0]), null);
  assert.equal(listedOrderView(sorted, pre, [1, 1]), null);
  assert.equal(listedOrderView(null, pre, [1, 0]), null);
});

test("classify names C3 and C2+C3 only for the referee's own slot-order state with the tribute block in listed order", () => {
  const state = {active: "cowboy", sides: {cowboy: {hand: ["cowboy-mounted-billy-1", "cowboy-mounted-billy-2"], board: tributeBoard()},
    wizard: {hand: [], board: [null, null, null]}}};
  const views = {"cowboy-mounted-billy-1": sortedViewFor("cowboy-mounted-billy-1"), "cowboy-mounted-billy-2": sortedViewFor("cowboy-mounted-billy-2")};
  const listedOrder = (sortedAction, listed) => {
    const expected = listedOrderView(views[sortedAction.cardId], state, listed);
    return expected && hash(expected);
  };
  const right = (id) => hash(listedOrderView(views[id], state, [1, 0]));
  const wrong = (id) => ({
    "slot order kept": hash(views[id]),
    "gear before its troop": hash(withDiscard(views[id], ["cowboy-lasso-1", "cowboy-deputy-1", "cowboy-six-shooter-1", "cowboy-sheriff-1"])),
    "listed order but another field changed": hash({...listedOrderView(views[id], state, [1, 0]), turn: 4}),
  });

  // C3: the first copy, which the engine sorts and both sides accept in slot order with equal states.
  const first = {type: "summon", cardId: "cowboy-mounted-billy-1", tributes: [1, 0]};
  const sortedFirst = hash(views["cowboy-mounted-billy-1"]);
  const firstLookup = (action) => (canonicalJson(action) === canonicalJson({...first, tributes: [0, 1]})
    ? {engine: [true, sortedFirst], referee: [true, null, sortedFirst]} : null);
  const c3 = (refereeHash, extra = {}) => classify({state, action: first, engine: [true, sortedFirst], referee: [true, null, refereeHash],
    lookup: firstLookup, listedOrder, ...extra});
  assert.equal(c3(right("cowboy-mounted-billy-1")), "C3");
  for (const [why, bad] of Object.entries(wrong("cowboy-mounted-billy-1"))) assert.equal(c3(bad), "unexplained", why);
  assert.equal(c3(right("cowboy-mounted-billy-1"), {listedOrder: undefined}), "unexplained", "no listed-order evidence");
  assert.equal(c3(right("cowboy-mounted-billy-1"), {engine: [true, "moved"]}), "unexplained", "engine state differs from its sorted state");
  assert.equal(c3(right("cowboy-mounted-billy-1"), {lookup: () => ({engine: [true, sortedFirst], referee: [true, null, "other"]})}), "unexplained",
    "the sides disagree on the sorted list");

  // C2+C3: a later copy. The engine refuses it; its slot-order counterpart is C2.
  const later = {...first, cardId: "cowboy-mounted-billy-2"};
  const sortedLater = hash(views["cowboy-mounted-billy-2"]);
  const laterLookup = (firstAgrees) => (action) => {
    const key = canonicalJson(action);
    if (key === canonicalJson({...later, tributes: [0, 1]})) return {engine: [false, null], referee: [true, null, sortedLater]};
    if (key === canonicalJson({...first, tributes: [0, 1]})) return {engine: [true, sortedFirst], referee: [true, null, firstAgrees ? sortedFirst : "other"]};
    return null;
  };
  const c23 = (refereeHash, firstAgrees = true) => classify({state, action: later, engine: [false, null], referee: [true, null, refereeHash],
    lookup: laterLookup(firstAgrees), listedOrder});
  assert.equal(c23(right("cowboy-mounted-billy-2")), "C2+C3");
  for (const [why, bad] of Object.entries(wrong("cowboy-mounted-billy-2"))) assert.equal(c23(bad), "unexplained", why);
  assert.equal(c23(right("cowboy-mounted-billy-1")), "unexplained", "the first copy's state is not the later copy's");
  assert.equal(c23(right("cowboy-mounted-billy-2"), false), "unexplained", "the first copy does not agree");
});

test("classify names F1 and F2 only when the referee treats the wire form exactly as its canonical counterpart", () => {
  const state = position({active: "cowboy", hand: ["cowboy-sheriff-1", "cowboy-lasso-1", "cowboy-lasso-2"]});
  const at = (table) => (action) => table[canonicalJson(action)] ?? null;
  const missing = {type: "summon", cardId: "cowboy-sheriff-1"};
  const canonicalSummon = canonicalJson({...missing, tributes: []});
  const f1 = (referee, canonical, engine = [false, null]) => classify({state, action: missing, engine, referee, lookup: at({[canonicalSummon]: canonical})});
  assert.equal(f1([true, null, "s"], {engine: [true, "s"], referee: [true, null, "s"]}), "F1");
  assert.equal(f1([true, null, "s"], {engine: [true, "t"], referee: [true, null, "t"]}), "unexplained", "referee state differs from canonical");
  assert.equal(f1([true, null, "s"], {engine: [true, "u"], referee: [true, null, "s"]}), "unexplained", "the sides disagree on the canonical form");
  assert.equal(f1([true, null, "s"], {engine: [false, null], referee: [false, "troop-already-played", null]}), "unexplained", "referee verdict differs");
  assert.equal(f1([true, null, "s"], {engine: [true, "s"], referee: [true, null, "s"]}, [true, "v"]), "unexplained", "engine took the wire form");
  assert.equal(f1([true, null, "s"], null), "unexplained", "no canonical counterpart");

  const alias = {type: "spell", cardId: "cowboy-lasso-2", slot: 0};
  const table = {
    [canonicalJson({type: "spell", cardId: "cowboy-lasso-2", target: 0})]: {engine: [false, null], referee: [true, null, "x"]},
    [canonicalJson({type: "spell", cardId: "cowboy-lasso-1", target: 0})]: {engine: [true, "y"], referee: [true, null, "y"]},
  };
  assert.equal(classify({state, action: alias, engine: [false, null], referee: [true, null, "x"], lookup: at(table)}), "F2+C2");
  assert.equal(classify({state, action: {...alias, target: 0}, engine: [false, null], referee: [true, null, "x"], lookup: at(table)}), "F2+C2");
  assert.equal(classify({state, action: alias, engine: [false, null], referee: [true, null, "z"], lookup: at(table)}), "unexplained");
});

test("the quick corpus agrees with the frozen referee except for the known classes", needsPython, async () => {
  const run = await compareLegalBranches({duels: quickDuels(), details: 2});
  const t = run.totals;
  assert.deepEqual(run.errors, []);
  assert.equal(t.duels, 12);
  assert.equal(t.main.divergedDuels, 0);
  assert.equal(t.main.agreedPositions, t.main.positions);
  assert.equal(t.oracle.crashes, 0);
  assert.equal(t.oracle.runDisagrees, 0);
  assert.equal(t.branch.byClass.unexplained, 0);
  assert.ok(t.branch.byClass.C2 > 0 && t.branch.byClass.C3 > 0, JSON.stringify(t.branch.byClass));
  assert.equal(t.branch.candidates, t.branch.bothAcceptedSameState + t.branch.bothRejected + t.branch.disagreements);
  for (const s of [...run.samples.C3, ...run.samples["C2+C3"]]) {
    if (!s.differences) continue; // C2+C3: the engine refuses the later copy, so there is no engine state to diff
    assert.ok(s.differences.length > 0 && s.differences.every((d) => /^\$\.players\.(cowboy|wizard)\.discard\[\d+\]$/.test(d.path)), JSON.stringify(s.differences));
  }
  for (const [form, f] of Object.entries(t.branch.byForm)) {
    assert.ok(f.candidates > 0 && f.refereeAccepted > 0, form);
    assert.equal(f.engineAccepted, 0, form);
    assert.equal(f.refereeSameAsCanonical, f.candidates, form);
    assert.equal(f.refereeDiffersFromCanonical, 0, form);
  }
});

// C3 is named only when the referee's digest equals listedOrderView's state. Replacing that rule
// with a wrong one must turn every C3 and C2+C3 into an unexplained disagreement against the real
// frozen referee. A wrong engine discard order must be unexplained too.
test("controls: a wrong tribute discard order or any other state difference is never classified", needsPython, async () => {
  const quick = quickDuels();
  const real = await compareLegalBranches({duels: quick, details: 0});
  assert.deepEqual(real.errors, []);
  const byClass = real.totals.branch.byClass;
  const listed = byClass.C3 + byClass["C2+C3"];
  assert.ok(byClass.C3 > 0, JSON.stringify(byClass));
  const controls = {
    "the referee kept slot order": (view) => view && structuredClone(view),
    "the listed tribute block reversed, gear before its troop": (view, pre, order) => {
      const expected = listedOrderView(view, pre, order);
      if (!expected) return null;
      const board = pre.sides[pre.active].board;
      const ids = new Set(order.flatMap((slot) => [board[slot].cardId, ...board[slot].gear]));
      const discard = expected.players[pre.active].discard;
      const block = discard.filter((id) => ids.has(id)).reverse();
      expected.players[pre.active].discard = discard.map((id) => (ids.has(id) ? block.shift() : id));
      return expected;
    },
    "listed order but another field changed": (view, pre, order) => {
      const expected = listedOrderView(view, pre, order);
      if (expected) expected.players[pre.active].base -= 1;
      return expected;
    },
  };
  for (const [why, expectListed] of Object.entries(controls)) {
    const run = await compareLegalBranches({duels: quick, details: 0, expectListed});
    assert.deepEqual(run.errors, [], why);
    const b = run.totals.branch.byClass;
    assert.equal(b.C3 + b["C2+C3"], 0, why);
    assert.equal(b.unexplained, byClass.unexplained + listed, why);
  }

  const misordered = (state, input) => {
    const applied = applyInput(state, input);
    if (applied.accepted && input.type === "summon" && input.tributes?.length === 2) {
      const discard = applied.state.sides[state.active].discard;
      discard.push(...discard.splice(-2).reverse());
    }
    return applied;
  };
  const wrongEngine = await compareLegalBranches({duels: quick, applyInput: misordered, details: 0});
  assert.deepEqual(wrongEngine.errors, []);
  assert.ok(wrongEngine.totals.branch.byClassAndKind.unexplained?.["different-state"] > 0, JSON.stringify(wrongEngine.totals.branch.byClassAndKind));
});

// The corpus deck lists hold one copy of each two-tribute troop, so they never reach C2+C3. This
// duel does: the Wizard goes first, fields two free Skeletons, and then holds both Dragons.
const twoDragons = () => {
  const top = ["wizard-skeleton-1", "wizard-skeleton-2", "wizard-dragon-1", "wizard-dragon-2"];
  const deal = dealt(2, []);
  return {...deal, first: "wizard", decks: {...deal.decks, wizard: [...top, ...deal.decks.wizard.filter((id) => !top.includes(id))]},
    actions: [{type: "summon", cardId: "wizard-skeleton-1", tributes: []}, {type: "end"}, {type: "end"},
      {type: "summon", cardId: "wizard-skeleton-2", tributes: []}, {type: "end"}, {type: "end"}]};
};

test("a later copy's reversed tributes are C2+C3 only through the referee's own slot-order state", needsPython, async () => {
  const duel = twoDragons();
  const eng = engineSide(duel);
  const k = eng.duel.actions.length;
  assert.equal(k, 6);
  const {state} = eng.positions[k];
  assert.equal(state.active, "wizard");
  assert.deepEqual(state.sides.wizard.board.map((troop) => troop?.cardId ?? null), ["wizard-skeleton-1", "wizard-skeleton-2", null]);
  assert.ok(["wizard-dragon-1", "wizard-dragon-2"].every((id) => state.sides.wizard.hand.includes(id)));
  const run = await compareLegalBranches({duels: [duel], details: 64});
  assert.deepEqual(run.errors, []);
  const byClass = run.totals.branch.byClass;
  assert.equal(byClass.unexplained, 0);
  const atK = (cls) => run.samples[cls].filter((s) => s.position === k).map((s) => s.action);
  assert.deepEqual(atK("C3"), [{type: "summon", cardId: "wizard-dragon-1", tributes: [1, 0]}]);
  assert.deepEqual(atK("C2+C3"), [{type: "summon", cardId: "wizard-dragon-2", tributes: [1, 0]}]);
  const slotOrder = await compareLegalBranches({duels: [duel], details: 0, expectListed: (view) => view && structuredClone(view)});
  assert.equal(slotOrder.totals.branch.byClass.C3 + slotOrder.totals.branch.byClass["C2+C3"], 0);
  assert.equal(slotOrder.totals.branch.byClass.unexplained, byClass.C3 + byClass["C2+C3"]);
});

test("seed 109 opens with the frozen empty-board Hellfire disagreement (C1, still open)", needsPython, async () => {
  const run = await compareLegalBranches({duels: [dealt(109, [])], details: 4});
  assert.deepEqual(run.errors, []);
  assert.equal(run.totals.branch.byClass.C1, 1);
  assert.equal(run.totals.branch.byClass.unexplained, 0);
  assert.deepEqual(run.samples.C1.map((s) => [s.position, s.action, s.engineAccepted, s.refereeAccepted]),
    [[0, {type: "spell", cardId: "wizard-hellfire-1"}, false, true]]);
});

test("negative controls: a refused legal action and a wrong outcome are both caught", needsPython, async () => {
  const refuseCover = (state, input) => (input?.type === "cover" ? {accepted: false, state, events: [], error: "illegal"} : applyInput(state, input));
  const refused = await compareLegalBranches({duels: quickDuels().slice(0, 3), applyInput: refuseCover, details: 1});
  assert.deepEqual(refused.errors, []);
  assert.ok(refused.totals.branch.byClassAndKind.unexplained?.["accepted-by-referee-only"] > 0);
  assert.ok(refused.totals.engine.acceptedSetNotLegal > 0);

  const softBase = (state, input) => {
    const applied = applyInput(state, input);
    if (applied.accepted && input.type === "end") applied.state.sides[applied.state.active].base += 1;
    return applied;
  };
  const wrong = await compareLegalBranches({duels: quickDuels().slice(0, 3), applyInput: softBase, details: 1});
  assert.deepEqual(wrong.errors, []);
  assert.ok(wrong.totals.main.divergedDuels > 0);
  assert.ok(wrong.totals.branch.byClassAndKind.unexplained?.["different-state"] > 0);
});
