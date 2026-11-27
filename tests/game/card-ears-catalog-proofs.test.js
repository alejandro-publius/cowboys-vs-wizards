// Direct EARS clause proofs for Showdown Cowboy & Wizard card specifications (.kiro/specs/card-*/requirements.md).
// Every literal test title cites only the CARD-* clauses asserted in full by that test; open design rulings
// such as empty-board Hellfire (CARD-WIZARD-HELLFIRE-04) remain untouched.
import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {CARD_SPECS, SHOWDOWN_SPECS} from "../../src/game/card-specs.generated.js";
import {DECKS, EFFECTS, TYPES, deckIds} from "../../src/game/showdown/cards.js";
import {viewFor} from "../../src/game/showdown/contract.js";
import {presentEvent} from "../../src/game/showdown/presenter.js";
import {
  BOUNTIES,
  HUNTS,
  RIVALS,
  choose,
  deckProblems,
  duelFor,
  duelList,
  migrate,
  newSave,
  owned,
  pool,
  settle,
} from "../../src/game/showdown/progress.js";
import { sameSave as saveCodeSame } from "../../src/game/showdown/savecode.js";
import {
  applyAction,
  attackOf,
  attackOutcome,
  canAttack,
  createShowdown,
  legalActions,
  planTurn,
  playTurn,
} from "../../src/game/showdown/rules.js";
import {STARTER, TRAIL, deckAfter} from "../../src/game/showdown/trail.js";
import {attackExample, attackPreviews} from "../../src/ui/showdown-3d/attack-preview.js";
import {presentationBeats} from "../../src/ui/showdown-3d/event-positions.js";

const FC = {seed: 20261126, numRuns: 40};
const GEAR = {cowboy: "cowboy-six-shooter-1", wizard: "wizard-bone-armor-1"};

function troop(type, idx = 1, {health = TYPES[type].health, cover = false, stunned = false, attacked = false, gear = [], arrived = 0, ready = true} = {}) {
  return {cardId: `${type}-${idx}`, health, attacked, stunned, cover, gear: [...gear], arrived, ready};
}

function stage({active = "cowboy", turn = 4, own = [null, null, null], foe = [null, null, null], hand = [], traps = {}, bases = {}, location = null} = {}) {
  const state = createShowdown(42);
  state.turn = turn;
  state.active = active;
  state.location = location;
  for (const s of ["cowboy", "wizard"]) {
    state.sides[s].hand = [];
    state.sides[s].discard = [];
    state.sides[s].traps = [...(traps[s] ?? [])];
    state.sides[s].base = bases[s] ?? 5;
  }
  const other = active === "cowboy" ? "wizard" : "cowboy";
  state.sides[active].hand = [...hand];
  state.sides[active].board = [own[0] ?? null, own[1] ?? null, own[2] ?? null];
  state.sides[other].board = [foe[0] ?? null, foe[1] ?? null, foe[2] ?? null];
  return state;
}

function assertWizardDecks(card, expected) {
  const decks = [["even", DECKS.wizard], ...[...TRAIL, ...RIVALS, ...BOUNTIES].map(({id, deck}) => [id, deck])];
  const copies = Object.fromEntries(decks.filter(([, deck]) => deck[card]).map(([id, deck]) => [id, deck[card]]));
  assert.deepEqual(copies, expected);
}

function trailClearedSave() {
  let s = newSave();
  for (let i = 0; i < TRAIL.length; i += 1) {
    s = settle(s, "trail", true).save;
    if (s.offer) s = choose(s, s.offer[0]);
  }
  return s;
}

// ---------------------------------------------------------------- Cowboy cards

// Fill a legal 16-card main deck to the card's cap. One more owned copy in the
// side deck must fail only the combined rarity limit.
function assertCopyCap(save, type, cap, rarity) {
  const enoughCopies = {...save, collection: {...save.collection, [type]: cap + 1}};
  const main = {"cowboy-sheriff": 16 - cap, [type]: cap};
  assert.deepEqual(deckProblems(enoughCopies, main), []);
  assert.deepEqual(deckProblems(enoughCopies, main, {[type]: 1}), [
    `${TYPES[type].name} is ${rarity}: at most ${cap} in a deck and its side deck.`,
  ]);
}

test("CARD-COWBOY-BILLY-01 CARD-COWBOY-BILLY-02 CARD-COWBOY-BILLY-03 CARD-COWBOY-BILLY-04 CARD-COWBOY-BILLY-05 CARD-COWBOY-BILLY-06 CARD-COWBOY-BILLY-07 CARD-COWBOY-BILLY-08 CARD-COWBOY-BILLY-09 CARD-COWBOY-BILLY-10 CARD-COWBOY-BILLY-11 CARD-COWBOY-BILLY-12: Billy catalog, 1-tribute summon, combat, Outlaw tag, Hex interaction, and Trail/progress rules", () => {
  assert.deepEqual(TYPES["cowboy-billy"], {
    side: "cowboy", name: "Billy", kind: "troop", stars: 5, attack: 2, health: 4,
    bounty: false, keys: [], rarity: "basic", tag: "Outlaw",
  });
  assert.equal(DECKS.cowboy["cowboy-billy"], 2);
  assert.equal(STARTER["cowboy-billy"], 5);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((wins) => deckAfter(wins)["cowboy-billy"]), [5, 5, 5, 4, 4, 3, 2]);
  const s0 = newSave();
  assert.equal(owned(s0, "cowboy-billy"), Infinity);
  assert.equal(pool(trailClearedSave()).includes("cowboy-billy"), false);

  // 02 & 03: empty board -> 0 summons; occupied slots -> 1 per slot, arrives ready after turn 1
  const empty = stage({active: "cowboy", hand: ["cowboy-billy-1"]});
  assert.equal(legalActions(empty).some((a) => a.type === "summon"), false);
  fc.assert(fc.property(fc.subarray([0, 1, 2], {minLength: 1}), (occupied) => {
    const own = [null, null, null];
    occupied.forEach((sl, idx) => { own[sl] = troop("cowboy-sheriff", idx + 1); });
    const st = stage({active: "cowboy", own, hand: ["cowboy-billy-1"]});
    const summons = legalActions(st).filter((a) => a.type === "summon");
    assert.deepEqual(summons.map((a) => a.tributes), occupied.sort((a, b) => a - b).map((sl) => [sl]));
    const after = applyAction(st, summons[0]).state;
    const billy = after.sides.cowboy.board.find((t) => t?.cardId === "cowboy-billy-1");
    assert.equal(canAttack(after, billy), true);
  }), FC);

  // 04: Base 5 -> 3
  const baseHit = applyAction(stage({own: [troop("cowboy-billy", 1)], foe: [], bases: {wizard: 5}}), {type: "attack", slot: 0, target: "base"});
  assert.equal(baseHit.state.sides.wizard.base, 3);

  // 05: Billy(4) vs Skeleton(3) -> Skeleton(1), Billy(3)
  const skelFight = applyAction(stage({own: [troop("cowboy-billy", 1, {health: 4})], foe: [troop("wizard-skeleton", 1, {health: 3})]}), {type: "attack", slot: 0, target: 0});
  assert.equal(skelFight.state.sides.wizard.board[0].health, 1);
  assert.equal(skelFight.state.sides.cowboy.board[0].health, 3);

  // 06: Billy(4) vs Jack-o'-Lantern -> Jack defeated, Billy(3) via Last Stand
  const jackFight = applyAction(stage({own: [troop("cowboy-billy", 1, {health: 4})], foe: [troop("wizard-jack-o-lantern", 1, {health: 1})]}), {type: "attack", slot: 0, target: 0});
  assert.equal(jackFight.state.sides.wizard.board[0], null);
  assert.equal(jackFight.state.sides.cowboy.board[0].health, 3);

  assert.equal(jackFight.events.find((e) => e.type === "laststand")?.cardId, "wizard-jack-o-lantern-1");

  // 07: Sheriff's Office leaves Outlaw Billy at 2 attack
  const withOffice = stage({own: [troop("cowboy-billy", 1)], location: {cardId: "cowboy-sheriffs-office-1", side: "cowboy"}});
  assert.equal(attackOf(withOffice, withOffice.sides.cowboy.board[0]), 2);

  // 08: Wizard Hex cancels Billy's attack
  const hexed = applyAction(stage({own: [troop("cowboy-billy", 1)], foe: [troop("wizard-skeleton", 1, {health: 3})], traps: {wizard: ["wizard-hex-1"]}}), {type: "attack", slot: 0, target: 0});
  assert.equal(hexed.events.find((e) => e.type === "trap")?.stopped, true);
  assert.equal(hexed.state.sides.wizard.board[0].health, 3);
  assert.deepEqual(hexed.state.sides.wizard.discard, ["wizard-hex-1"]);
});

test("CARD-COWBOY-SHERIFF-01 CARD-COWBOY-SHERIFF-02 CARD-COWBOY-SHERIFF-03 CARD-COWBOY-SHERIFF-04 CARD-COWBOY-SHERIFF-05 CARD-COWBOY-SHERIFF-06 CARD-COWBOY-SHERIFF-07 CARD-COWBOY-SHERIFF-08 CARD-COWBOY-SHERIFF-09 CARD-COWBOY-SHERIFF-10 CARD-COWBOY-SHERIFF-11 CARD-COWBOY-SHERIFF-12 CARD-COWBOY-SHERIFF-13 CARD-COWBOY-SHERIFF-14 CARD-COWBOY-SHERIFF-15 CARD-COWBOY-SHERIFF-16: Sheriff full specification", () => {
  assert.deepEqual(TYPES["cowboy-sheriff"], {
    side: "cowboy", name: "Sheriff", kind: "troop", stars: 2, attack: 1, health: 3,
    bounty: false, keys: [], rarity: "basic", tag: "Lawman",
  });
  assert.equal(DECKS.cowboy["cowboy-sheriff"], 4);
  assert.deepEqual(deckIds("cowboy").filter((id) => /^cowboy-sheriff-\d+$/.test(id)), ["cowboy-sheriff-1", "cowboy-sheriff-2", "cowboy-sheriff-3", "cowboy-sheriff-4"]);
  assert.equal(STARTER["cowboy-sheriff"], 8);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((wins) => deckAfter(wins)["cowboy-sheriff"]), [8, 6, 4, 4, 3, 3, 3]);

  // 02, 03, 04: free summon, blocked when full, rests on arrival turn
  const openBoard = stage({own: [troop("cowboy-billy", 1), null, null], hand: ["cowboy-sheriff-1", "cowboy-sheriff-2"]});
  assert.deepEqual(legalActions(openBoard).filter((a) => a.type === "summon"), [{type: "summon", cardId: "cowboy-sheriff-1", tributes: []}]);
  const arrived = applyAction(openBoard, {type: "summon", cardId: "cowboy-sheriff-1", tributes: []}).state;
  assert.equal(canAttack(arrived, arrived.sides.cowboy.board[1]), false);
  const nextOwnTurn = applyAction(applyAction(arrived, {type: "end"}).state, {type: "end"}).state;
  assert.equal(canAttack(nextOwnTurn, nextOwnTurn.sides.cowboy.board[1]), true);

  const fullBoard = stage({own: [troop("cowboy-sheriff", 1), troop("cowboy-sheriff", 2), troop("cowboy-sheriff", 3)], hand: ["cowboy-sheriff-4"]});
  assert.equal(legalActions(fullBoard).some((a) => a.type === "summon"), false);

  // 05: Sheriff(3) vs Wizard(4) -> Wizard(3), Sheriff(1), Bases unchanged
  const clash = applyAction(stage({own: [troop("cowboy-sheriff", 1, {health: 3})], foe: [troop("wizard-wizard", 1, {health: 4})]}), {type: "attack", slot: 0, target: 0});
  assert.equal(clash.state.sides.wizard.board[0].health, 3);
  assert.equal(clash.state.sides.cowboy.board[0].health, 1);
  assert.equal(clash.state.sides.cowboy.base, 5);
  assert.equal(clash.state.sides.wizard.base, 5);

  // 06 & 07: Sheriff's Office on either side & Six-Shooter boost attack to 2
  const office = stage({own: [troop("cowboy-sheriff", 1)], foe: [troop("cowboy-sheriff", 2)],
    location: {cardId: "cowboy-sheriffs-office-1", side: "cowboy"}});
  for (const side of ["cowboy", "wizard"]) assert.equal(attackOf(office, office.sides[side].board[0]), 2);
  const geared = stage({own: [troop("cowboy-sheriff", 1, {gear: [GEAR.cowboy]})]});
  assert.equal(attackOf(geared, geared.sides.cowboy.board[0]), 2);

  // 08 & 09: Tribute Sheriff moves to discard and formats log
  const trib = applyAction(stage({own: [troop("cowboy-sheriff", 1)], hand: ["cowboy-billy-1"]}), {type: "summon", cardId: "cowboy-billy-1", tributes: [0]});
  assert.deepEqual(trib.state.sides.cowboy.discard, ["cowboy-sheriff-1"]);
  assert.deepEqual(trib.events.map((e) => [e.type, e.cardId]), [["tribute", "cowboy-sheriff-1"], ["summon", "cowboy-billy-1"]]);
  assert.equal(presentEvent(trib.events[0]), "The Cowboys' Sheriff was paid as tribute.");

  // 13, 14, 15, 16: partial swap, unlimited basic ownership, excluded from pool, rejected in collection by migrate
  const oneSheriffSave = {...newSave(), deck: {"cowboy-sheriff": 1, "cowboy-billy": 15}};
  const settledPartial = settle(oneSheriffSave, "trail", true).save;
  assert.equal(settledPartial.deck["cowboy-covered-wagon"], 1);
  assert.equal(settledPartial.deck["cowboy-sheriff"] ?? 0, 0);
  assert.equal(settledPartial.deck["cowboy-billy"], 15);
  assert.equal(owned(newSave(), "cowboy-sheriff"), Infinity);
  assert.deepEqual(deckProblems(newSave(), {"cowboy-sheriff": 16}, {"cowboy-sheriff": 4}), []);
  assert.equal(pool(trailClearedSave()).includes("cowboy-sheriff"), false);
  const progressed = trailClearedSave();
  assert.equal(saveCodeSame(migrate(progressed), progressed), true);
  assert.equal(saveCodeSame(migrate({...progressed, collection: {...progressed.collection, "cowboy-sheriff": 1}}), newSave()), true);
});

test("CARD-COWBOY-MOUNTED-BILLY-01 CARD-COWBOY-MOUNTED-BILLY-02 CARD-COWBOY-MOUNTED-BILLY-03 CARD-COWBOY-MOUNTED-BILLY-04 CARD-COWBOY-MOUNTED-BILLY-05 CARD-COWBOY-MOUNTED-BILLY-06 CARD-COWBOY-MOUNTED-BILLY-07 CARD-COWBOY-MOUNTED-BILLY-08 CARD-COWBOY-MOUNTED-BILLY-09 CARD-COWBOY-MOUNTED-BILLY-10 CARD-COWBOY-MOUNTED-BILLY-11: Mounted Billy full specification", () => {
  assert.deepEqual(TYPES["cowboy-mounted-billy"], {
    side: "cowboy", name: "Mounted Billy", kind: "troop", stars: 7, attack: 3, health: 5,
    bounty: false, keys: ["ride"], rarity: "rare", tag: "Outlaw",
  });
  assert.equal(DECKS.cowboy["cowboy-mounted-billy"], 1);

  const three = stage({own: [troop("cowboy-sheriff", 1), troop("cowboy-sheriff", 2), troop("cowboy-sheriff", 3)], hand: ["cowboy-mounted-billy-1"]});
  assert.deepEqual(legalActions(three).filter((a) => a.type === "summon").map((a) => a.tributes), [[0, 1], [0, 2], [1, 2]]);
  for (const own of [[], [troop("cowboy-sheriff", 1)]]) {
    assert.equal(legalActions(stage({own, hand: ["cowboy-mounted-billy-1"]})).some((a) => a.type === "summon"), false);
  }
  const sum = applyAction(three, {type: "summon", cardId: "cowboy-mounted-billy-1", tributes: [0, 2]}).state;
  assert.equal(canAttack(sum, sum.sides.cowboy.board[0]), true);

  const vsNonGuard = stage({own: [troop("cowboy-mounted-billy", 1)], foe: [troop("wizard-skeleton", 1), null, troop("wizard-wizard", 2)]});
  assert.deepEqual(legalActions(vsNonGuard).filter((a) => a.type === "attack").map((a) => a.target), [0, 2, "base"]);
  const ride = applyAction(vsNonGuard, {type: "attack", slot: 0, target: "base"});
  assert.equal(ride.state.sides.wizard.base, 4);

  const trample = applyAction(stage({own: [troop("cowboy-mounted-billy", 1, {health: 5})], foe: [troop("wizard-skeleton", 1, {health: 1})], bases: {wizard: 5}}), {type: "attack", slot: 0, target: 0});
  assert.equal(trample.state.sides.wizard.board[0], null);
  assert.equal(trample.state.sides.wizard.base, 3);
  assert.equal(trample.state.sides.cowboy.board[0].health, 5);

  const hitOut = applyAction(stage({active: "wizard", own: [troop("wizard-skeleton", 1, {health: 1})], foe: [troop("cowboy-mounted-billy", 1, {cover: false})]}), {type: "attack", slot: 0, target: 0});
  assert.equal(hitOut.events[0].hitBack, 3);
  const hitCov = applyAction(stage({active: "wizard", own: [troop("wizard-skeleton", 1, {health: 1})], foe: [troop("cowboy-mounted-billy", 1, {cover: true})]}), {type: "attack", slot: 0, target: 0});
  assert.equal(hitCov.events[0].hitBack, 0);

  let s4 = newSave();
  for (let i = 0; i < 4; i += 1) { s4 = settle(s4, "trail", true).save; if (s4.offer) s4 = choose(s4, s4.offer[0]); }
  const s5 = settle(s4, "trail", true).save;
  assert.equal(s5.collection["cowboy-mounted-billy"], 1);
  assert.equal(s5.deck["cowboy-mounted-billy"], 1);
  assert.equal(s5.deck["cowboy-billy"], s4.deck["cowboy-billy"] - 1);

  const threeOwned = {...s5, collection: {...s5.collection, "cowboy-mounted-billy": 3}};
  assert.ok(deckProblems(threeOwned, {"cowboy-sheriff": 14, "cowboy-mounted-billy": 2}, {"cowboy-mounted-billy": 1})
    .includes("Mounted Billy is Rare: at most 2 in a deck and its side deck."));
});

test("CARD-COWBOY-COVERED-WAGON-01 CARD-COWBOY-COVERED-WAGON-02 CARD-COWBOY-COVERED-WAGON-03 CARD-COWBOY-COVERED-WAGON-04 CARD-COWBOY-COVERED-WAGON-05 CARD-COWBOY-COVERED-WAGON-06 CARD-COWBOY-COVERED-WAGON-07 CARD-COWBOY-COVERED-WAGON-08 CARD-COWBOY-COVERED-WAGON-09 CARD-COWBOY-COVERED-WAGON-10: Covered Wagon full specification", () => {
  assert.deepEqual(TYPES["cowboy-covered-wagon"], {
    side: "cowboy", name: "Covered Wagon", kind: "troop", stars: 4, attack: 1, health: 4,
    bounty: false, keys: ["guard"], rarity: "common", tag: "Rig",
  });
  assert.equal(DECKS.cowboy["cowboy-covered-wagon"], 2);
  assert.deepEqual(legalActions(stage({hand: ["cowboy-covered-wagon-1"]})).filter((a) => a.type === "summon"),
    [{type: "summon", cardId: "cowboy-covered-wagon-1", tributes: []}]);

  const wizAtk = stage({
    active: "wizard",
    own: [troop("wizard-skeleton", 1), troop("wizard-headless-horseman", 2), null],
    foe: [troop("cowboy-sheriff", 1), troop("cowboy-covered-wagon", 2), null],
  });
  assert.deepEqual(legalActions(wizAtk).filter((a) => a.type === "attack").map((a) => [a.slot, a.target]),
    [[0, 1], [1, 1]]);

  const swept = applyAction(stage({
    active: "wizard",
    own: [troop("wizard-dragon", 1)],
    foe: [troop("cowboy-covered-wagon", 1, {health: 4}), troop("cowboy-sheriff", 2, {health: 3}), null],
  }), {type: "attack", slot: 0, target: 0});
  assert.equal(swept.state.sides.cowboy.board[1].health, 2);

  const covSt = stage({active: "wizard", own: [troop("wizard-skeleton", 1, {health: 3})], foe: [troop("cowboy-covered-wagon", 1, {cover: true})]});
  const covHit = applyAction(covSt, {type: "attack", slot: 0, target: 0});
  assert.equal(covHit.state.sides.wizard.board[0].health, 3);
  const nextCowboy = applyAction(covHit.state, {type: "end"}).state;
  assert.equal(nextCowboy.sides.cowboy.board[0].cover, false);

  const win1 = settle(newSave(), "trail", true);
  assert.deepEqual(win1.earned.cards, [["cowboy-covered-wagon", 2]]);
  assert.equal(win1.save.collection["cowboy-covered-wagon"], 2);
  assert.ok(deckProblems(win1.save, {"cowboy-sheriff": 13, "cowboy-covered-wagon": 3}, {}).includes("You own 2 Covered Wagon, not 3."));
});

test("CARD-COWBOY-RANGER-01 CARD-COWBOY-RANGER-02 CARD-COWBOY-RANGER-03 CARD-COWBOY-RANGER-04 CARD-COWBOY-RANGER-05 CARD-COWBOY-RANGER-06 CARD-COWBOY-RANGER-07 CARD-COWBOY-RANGER-08: Ranger full specification", () => {
  assert.deepEqual(TYPES["cowboy-ranger"], {
    side: "cowboy", name: "Ranger", kind: "troop", stars: 5, attack: 2, health: 4,
    bounty: false, keys: ["scout"], rarity: "uncommon", tag: "Lawman",
  });
  assert.equal(DECKS.cowboy["cowboy-ranger"], 1);

  const st = stage({own: [troop("cowboy-sheriff", 1)], hand: ["cowboy-ranger-1"]});
  st.sides.cowboy.deck = ["cowboy-deadeye-1", "cowboy-billy-1"];
  const drawn = applyAction(st, {type: "summon", cardId: "cowboy-ranger-1", tributes: [0]});
  assert.deepEqual(drawn.events.map((e) => e.type), ["tribute", "summon", "draw"]);
  assert.deepEqual(drawn.state.sides.cowboy.hand, ["cowboy-deadeye-1"]);
  assert.deepEqual(drawn.state.sides.cowboy.deck, ["cowboy-billy-1"]);
  assert.equal(canAttack(drawn.state, drawn.state.sides.cowboy.board[0]), true);

  const emptyDeck = stage({own: [troop("cowboy-sheriff", 1)], hand: ["cowboy-ranger-1"]});
  emptyDeck.sides.cowboy.deck = [];
  const noDraw = applyAction(emptyDeck, {type: "summon", cardId: "cowboy-ranger-1", tributes: [0]});
  assert.deepEqual(noDraw.events.map((e) => e.type), ["tribute", "summon"]);
  assert.equal(noDraw.state.sides.cowboy.base, 5);

  const office = stage({own: [troop("cowboy-ranger", 1)], location: {cardId: "cowboy-sheriffs-office-1", side: "cowboy"}});
  assert.equal(attackOf(office, office.sides.cowboy.board[0]), 3);

  // 06: planTurn cuts right after Ranger Scout draw
  const botSt = stage({own: [troop("cowboy-sheriff", 1, {health: 1})], foe: [troop("wizard-skeleton", 1, {health: 1})], hand: ["cowboy-ranger-1"]});
  botSt.sides.cowboy.deck = ["cowboy-deadeye-1", "cowboy-billy-1"];
  assert.deepEqual(planTurn(botSt), [{type: "summon", cardId: "cowboy-ranger-1", tributes: [0]}]);
  const events = playTurn(botSt, 2).events;
  assert.deepEqual(events.slice(0, 4).map((e) => [e.type, e.cardId]), [
    ["tribute", "cowboy-sheriff-1"], ["summon", "cowboy-ranger-1"], ["draw", undefined], ["spell", "cowboy-deadeye-1"],
  ]);

  let s2 = newSave();
  for (let i = 0; i < 2; i += 1) { s2 = settle(s2, "trail", true).save; if (s2.offer) s2 = choose(s2, s2.offer[0]); }
  const s3 = settle(s2, "trail", true).save;
  assert.equal(s3.collection["cowboy-ranger"], 1);
  assert.equal(s3.deck["cowboy-ranger"], 1);
  assert.equal(s3.deck["cowboy-billy"], s2.deck["cowboy-billy"] - 1);
});

test("CARD-COWBOY-CAPTURED-WRAITH-01 CARD-COWBOY-CAPTURED-WRAITH-02 CARD-COWBOY-CAPTURED-WRAITH-03 CARD-COWBOY-CAPTURED-WRAITH-04 CARD-COWBOY-CAPTURED-WRAITH-05 CARD-COWBOY-CAPTURED-WRAITH-06 CARD-COWBOY-CAPTURED-WRAITH-07 CARD-COWBOY-CAPTURED-WRAITH-08 CARD-COWBOY-CAPTURED-WRAITH-09 CARD-COWBOY-CAPTURED-WRAITH-10 CARD-COWBOY-CAPTURED-WRAITH-11: Captured Wraith full specification", () => {
  assert.deepEqual(TYPES["cowboy-captured-wraith"], {
    side: "cowboy", name: "Captured Wraith", kind: "troop", stars: 3, attack: 2, health: 2,
    bounty: true, keys: ["ghostly"], rarity: "legendary", tag: "Undead",
  });
  assert.equal("cowboy-captured-wraith" in DECKS.cowboy, false);
  const sumSt = stage({hand: ["cowboy-captured-wraith-1"]});
  assert.deepEqual(legalActions(sumSt).filter((a) => a.type === "summon"), [{type: "summon", cardId: "cowboy-captured-wraith-1", tributes: []}]);
  const arrived = applyAction(sumSt, {type: "summon", cardId: "cowboy-captured-wraith-1", tributes: []}).state;
  assert.equal(canAttack(arrived, arrived.sides.cowboy.board[0]), false);

  const wizSpell = stage({active: "wizard", foe: [troop("cowboy-captured-wraith", 1, {health: 2})], hand: ["wizard-singularity-1", "wizard-hellfire-1"]});
  assert.equal(legalActions(wizSpell).some((a) => a.type === "spell" && a.cardId === "wizard-singularity-1"), false);
  const hf = applyAction(wizSpell, {type: "spell", cardId: "wizard-hellfire-1"}).state;
  assert.equal(hf.sides.cowboy.board[0].health, 1);

  const by = stage({own: [troop("cowboy-captured-wraith", 1)], location: {cardId: "wizard-boneyard-1", side: "wizard"}});
  assert.equal(attackOf(by, by.sides.cowboy.board[0]), 3);

  const hex = applyAction(stage({own: [troop("cowboy-captured-wraith", 1)], foe: [], traps: {wizard: ["wizard-hex-1"]}}), {type: "attack", slot: 0, target: "base"});
  assert.equal(hex.events[0].stopped, true);
  assert.equal(hex.state.sides.wizard.base, 5);

  let s = trailClearedSave();
  assert.equal(pool(s).includes("cowboy-captured-wraith"), false);
  let fifth = null;
  assert.equal(HUNTS, 5);
  for (let i = 0; i < HUNTS; i += 1) {
    assert.equal(s.collection["cowboy-captured-wraith"] ?? 0, 0);
    fifth = settle(s, "hunt:lantern-wraith", true);
    s = fifth.save;
    if (s.offer) s = choose(s, s.offer[0]);
  }
  assert.equal(fifth.earned.captured, "cowboy-captured-wraith");
  assert.equal(s.collection["cowboy-captured-wraith"], 1);
  assertCopyCap(s, "cowboy-captured-wraith", 1, "Legendary");
});

test("CARD-COWBOY-CAPTURED-DRAGON-01 CARD-COWBOY-CAPTURED-DRAGON-02 CARD-COWBOY-CAPTURED-DRAGON-03 CARD-COWBOY-CAPTURED-DRAGON-04 CARD-COWBOY-CAPTURED-DRAGON-05 CARD-COWBOY-CAPTURED-DRAGON-06 CARD-COWBOY-CAPTURED-DRAGON-07 CARD-COWBOY-CAPTURED-DRAGON-08 CARD-COWBOY-CAPTURED-DRAGON-09 CARD-COWBOY-CAPTURED-DRAGON-10: Captured Dragon full specification", () => {
  assert.deepEqual(TYPES["cowboy-captured-dragon"], {
    side: "cowboy", name: "Captured Dragon", kind: "troop", stars: 5, attack: 4, health: 2,
    bounty: true, keys: ["sweep"], rarity: "legendary", tag: "Beast",
  });
  assert.equal("cowboy-captured-dragon" in DECKS.cowboy, false);

  const sumSt = stage({own: [troop("cowboy-sheriff", 1), troop("cowboy-sheriff", 2), null], hand: ["cowboy-captured-dragon-1"]});
  assert.deepEqual(legalActions(sumSt).filter((a) => a.type === "summon").map((a) => a.tributes), [[0], [1]]);
  const arrived = applyAction(sumSt, {type: "summon", cardId: "cowboy-captured-dragon-1", tributes: [0]}).state;
  assert.equal(canAttack(arrived, arrived.sides.cowboy.board[0]), true);

  const c4 = applyAction(stage({own: [troop("cowboy-captured-dragon", 1)], foe: [troop("wizard-wizard", 1, {health: 4}), troop("wizard-skeleton", 2, {health: 3}), null]}), {type: "attack", slot: 0, target: 0});
  assert.equal(c4.state.sides.wizard.board[0], null);
  assert.equal(c4.state.sides.wizard.board[1].health, 2);
  assert.equal(c4.state.sides.wizard.base, 5);

  const c5 = applyAction(stage({own: [troop("cowboy-captured-dragon", 1, {health: 2})], foe: [troop("wizard-dragon", 1, {health: 5}), troop("wizard-skeleton", 2, {health: 3}), null]}), {type: "attack", slot: 0, target: 0});
  assert.equal(c5.state.sides.cowboy.board[0], null);
  assert.equal(c5.state.sides.wizard.board[1].health, 2);

  let s = trailClearedSave();
  assert.equal(pool(s).includes("cowboy-captured-dragon"), false);
  assert.equal(saveCodeSame(migrate({...s, collection: {...s.collection, "cowboy-captured-dragon": 1}}), newSave()), true);
  let fifth = null;
  assert.equal(HUNTS, 5);
  for (let i = 0; i < HUNTS; i += 1) {
    assert.equal(s.collection["cowboy-captured-dragon"] ?? 0, 0);
    fifth = settle(s, "hunt:graveyard-dragon", true);
    s = fifth.save;
    if (s.offer) s = choose(s, s.offer[0]);
  }
  assert.equal(fifth.earned.captured, "cowboy-captured-dragon");
  assert.equal(s.collection["cowboy-captured-dragon"], 1);
  assertCopyCap(s, "cowboy-captured-dragon", 1, "Legendary");
});

test("CARD-COWBOY-DEADEYE-01 CARD-COWBOY-DEADEYE-02 CARD-COWBOY-DEADEYE-03 CARD-COWBOY-DEADEYE-04 CARD-COWBOY-DEADEYE-05 CARD-COWBOY-DEADEYE-06 CARD-COWBOY-DEADEYE-07 CARD-COWBOY-DEADEYE-08 CARD-COWBOY-DEADEYE-09 CARD-COWBOY-DEADEYE-10 CARD-COWBOY-DEADEYE-11 CARD-COWBOY-DEADEYE-12 CARD-COWBOY-DEADEYE-13: Deadeye catalog, targeting, spell resolution, log, and campaign rules", () => {
  assert.deepEqual(TYPES["cowboy-deadeye"], {
    side: "cowboy", name: "Deadeye", kind: "spell", stars: undefined, attack: undefined, health: undefined,
    bounty: false, keys: [], rarity: "common", effect: "shot",
  });
  assert.equal(DECKS.cowboy["cowboy-deadeye"], 1);
  assert.equal(STARTER["cowboy-deadeye"], 3);
  assert.equal(newSave().collection["cowboy-deadeye"], 3);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((wins) => deckAfter(wins)["cowboy-deadeye"]), [3, 3, 3, 2, 1, 1, 1]);

  const st = stage({own: [troop("cowboy-sheriff", 1)],
    foe: [troop("wizard-skeleton", 1, {health: 3}), troop("wizard-lantern-wraith", 2), troop("wizard-skeleton", 3, {stunned: true})],
    hand: ["cowboy-deadeye-1", "cowboy-six-shooter-1"]});
  assert.deepEqual(legalActions(st).filter((a) => a.type === "spell"),
    [0, 2].map((target) => ({type: "spell", cardId: "cowboy-deadeye-1", target})));
  const res = applyAction(st, {type: "spell", cardId: "cowboy-deadeye-1", target: 0});
  assert.equal(res.state.sides.wizard.board[0].health, 2);
  assert.equal(legalActions(res.state).some((a) => a.type === "gear"), false);
  assert.equal(presentEvent(res.events[0]), "The Cowboys' Deadeye hit Skeleton: 2 orbs left.");

  const kill = applyAction(stage({foe: [troop("wizard-skeleton", 1, {health: 1})], hand: ["cowboy-deadeye-1"]}), {type: "spell", cardId: "cowboy-deadeye-1", target: 0});
  assert.equal(kill.state.sides.wizard.board[0], null);
  const killJack = applyAction(stage({foe: [troop("wizard-jack-o-lantern", 1)], hand: ["cowboy-deadeye-1"]}), {type: "spell", cardId: "cowboy-deadeye-1", target: 0});
  assert.equal(killJack.state.sides.wizard.board[0], null);
  assert.equal(killJack.events.some((e) => e.type === "laststand"), false);

  const firstWin = settle(newSave(), "trail", true).save;
  assert.deepEqual([...firstWin.offer].sort(), ["cowboy-covered-wagon", "cowboy-deadeye"]);
  const afterPick = choose(firstWin, "cowboy-deadeye");
  assert.equal(afterPick.collection["cowboy-deadeye"], 4);
  assert.ok(deckProblems(afterPick, {"cowboy-sheriff": 12, "cowboy-deadeye": 4}, {"cowboy-deadeye": 1}).includes("You own 4 Deadeye, not 5."));
});

test("CARD-COWBOY-DYNAMITER-01 CARD-COWBOY-DYNAMITER-02 CARD-COWBOY-DYNAMITER-03 CARD-COWBOY-DYNAMITER-04 CARD-COWBOY-DYNAMITER-05 CARD-COWBOY-DYNAMITER-06 CARD-COWBOY-DYNAMITER-07 CARD-COWBOY-DYNAMITER-08 CARD-COWBOY-DYNAMITER-09 CARD-COWBOY-DYNAMITER-10 CARD-COWBOY-DYNAMITER-11 CARD-COWBOY-DYNAMITER-12 CARD-COWBOY-DYNAMITER-13 CARD-COWBOY-DYNAMITER-14 CARD-COWBOY-DYNAMITER-15 CARD-COWBOY-DYNAMITER-16 CARD-COWBOY-DYNAMITER-17: Dynamiter full specification", () => {
  assert.deepEqual(TYPES["cowboy-dynamiter"], {
    side: "cowboy", name: "Dynamiter", kind: "troop", stars: 3, attack: 3, health: 1,
    bounty: false, keys: ["laststand"], rarity: "uncommon", tag: "Outlaw",
  });
  assert.equal(DECKS.cowboy["cowboy-dynamiter"], 1);
  const sumSt = stage({hand: ["cowboy-dynamiter-1"]});
  assert.deepEqual(legalActions(sumSt).filter((a) => a.type === "summon"), [{type: "summon", cardId: "cowboy-dynamiter-1", tributes: []}]);
  const arr = applyAction(sumSt, {type: "summon", cardId: "cowboy-dynamiter-1", tributes: []}).state;
  assert.equal(canAttack(arr, arr.sides.cowboy.board[0]), false);

  // 04: Dynamiter(1) vs Wizard(4) -> both defeated, log check (14)
  const vsWiz = applyAction(stage({own: [troop("cowboy-dynamiter", 1)], foe: [troop("wizard-wizard", 1, {health: 4})]}), {type: "attack", slot: 0, target: 0});
  assert.deepEqual([vsWiz.events[0].targetLeft, vsWiz.events[0].attackerLeft], [1, 0]);
  assert.equal(vsWiz.state.sides.cowboy.board[0], null);
  assert.equal(vsWiz.state.sides.wizard.board[0], null);
  assert.equal(presentEvent(vsWiz.events.find((e) => e.type === "laststand")), "Last Stand: Dynamiter took an orb off Wizard, defeating it.");

  // 05 & 06: vs Skeleton(3) both ways
  const atkSkel = applyAction(stage({own: [troop("cowboy-dynamiter", 1)], foe: [troop("wizard-skeleton", 1, {health: 3})]}), {type: "attack", slot: 0, target: 0});
  assert.equal(atkSkel.state.sides.wizard.board[0], null);
  assert.equal(atkSkel.state.sides.cowboy.board[0].health, 1);
  const defSkel = applyAction(stage({active: "wizard", own: [troop("wizard-skeleton", 1, {health: 3})], foe: [troop("cowboy-dynamiter", 1)]}), {type: "attack", slot: 0, target: 0});
  assert.equal(defSkel.state.sides.cowboy.board[0], null);
  assert.equal(defSkel.state.sides.wizard.board[0].health, 2);

  // 07 & 08: Imp vs uncovered Dynamiter & Wizard vs covered Dynamiter
  const impHit = applyAction(stage({active: "wizard", own: [troop("wizard-imp", 1)], foe: [troop("cowboy-dynamiter", 1, {cover: false})], bases: {cowboy: 5}}), {type: "attack", slot: 0, target: 0});
  assert.equal(impHit.state.sides.wizard.board[0], null);
  assert.equal(impHit.state.sides.cowboy.board[0], null);
  assert.equal(impHit.state.sides.cowboy.base, 3);
  const covWiz = applyAction(stage({active: "wizard", own: [troop("wizard-wizard", 1, {health: 4})], foe: [troop("cowboy-dynamiter", 1, {cover: true})], bases: {cowboy: 5}}), {type: "attack", slot: 0, target: 0});
  assert.equal(covWiz.state.sides.cowboy.board[0], null);
  assert.equal(covWiz.state.sides.wizard.board[0].health, 3);
  assert.equal(covWiz.state.sides.cowboy.base, 5);

  // 09: Dynamiter defeats Jack-o'-Lantern -> both defeated, single laststand event naming Jack-o'-Lantern
  const vsJack = applyAction(stage({own: [troop("cowboy-dynamiter", 1)], foe: [troop("wizard-jack-o-lantern", 1)]}), {type: "attack", slot: 0, target: 0});
  assert.equal(vsJack.state.sides.cowboy.board[0], null);
  assert.equal(vsJack.state.sides.wizard.board[0], null);
  const lsEvs = vsJack.events.filter((e) => e.type === "laststand");
  assert.equal(lsEvs.length, 1);
  assert.equal(lsEvs[0].cardId, "wizard-jack-o-lantern-1");

  // 10, 11, 12, 13: spell, sweep, tribute, Hex trigger no Last Stand
  for (const sp of ["wizard-singularity-1", "wizard-hellfire-1"]) {
    const spSt = stage({active: "wizard", foe: [troop("cowboy-dynamiter", 1)], hand: [sp]});
    const act = sp === "wizard-hellfire-1" ? {type: "spell", cardId: sp} : {type: "spell", cardId: sp, target: 0};
    const cast = applyAction(spSt, act);
    assert.equal(cast.state.sides.cowboy.board[0], null);
    assert.equal(cast.events.some((e) => e.type === "laststand"), false);
  }
  const dragSweep = applyAction(stage({active: "wizard", own: [troop("wizard-dragon", 1, {health: 5})], foe: [troop("cowboy-sheriff", 1, {health: 3}), troop("cowboy-dynamiter", 2, {health: 1}), null]}), {type: "attack", slot: 0, target: 0});
  assert.deepEqual(dragSweep.state.sides.cowboy.discard, ["cowboy-sheriff-1", "cowboy-dynamiter-2"]);
  assert.deepEqual(dragSweep.state.sides.cowboy.board, [null, null, null]);
  assert.equal(dragSweep.events.some((e) => e.type === "laststand"), false);
  assert.equal(dragSweep.state.sides.wizard.board[0].health, 5);

  const trib = applyAction(stage({own: [troop("cowboy-dynamiter", 1)], hand: ["cowboy-billy-1"]}), {type: "summon", cardId: "cowboy-billy-1", tributes: [0]});
  assert.deepEqual(trib.state.sides.cowboy.discard, ["cowboy-dynamiter-1"]);
  assert.equal(trib.events.some((e) => e.type === "laststand"), false);

  const hex = applyAction(stage({own: [troop("cowboy-dynamiter", 1)], foe: [troop("wizard-skeleton", 1)], traps: {wizard: ["wizard-hex-1"]}}), {type: "attack", slot: 0, target: 0});
  assert.equal(hex.events.find((e) => e.type === "trap")?.stopped, true);
  assert.equal(hex.state.sides.cowboy.board[0].health, 1);
  assert.equal(hex.state.sides.wizard.board[0].health, 3);

  let s3 = newSave();
  for (let i = 0; i < 3; i += 1) { s3 = settle(s3, "trail", true).save; if (s3.offer) s3 = choose(s3, s3.offer[0]); }
  const s4 = settle(s3, "trail", true).save;
  assert.equal(s4.collection["cowboy-dynamiter"], 1);
  assert.equal(s4.deck["cowboy-dynamiter"], 1);
  assert.equal(s4.deck["cowboy-sheriff"], s3.deck["cowboy-sheriff"] - 1);
  assertCopyCap(s4, "cowboy-dynamiter", 3, "Uncommon");
});

test("CARD-COWBOY-GATLING-CREW-01 CARD-COWBOY-GATLING-CREW-02 CARD-COWBOY-GATLING-CREW-03 CARD-COWBOY-GATLING-CREW-04 CARD-COWBOY-GATLING-CREW-05 CARD-COWBOY-GATLING-CREW-06 CARD-COWBOY-GATLING-CREW-07 CARD-COWBOY-GATLING-CREW-08 CARD-COWBOY-GATLING-CREW-09 CARD-COWBOY-GATLING-CREW-10 CARD-COWBOY-GATLING-CREW-11 CARD-COWBOY-GATLING-CREW-12 CARD-COWBOY-GATLING-CREW-13 CARD-COWBOY-GATLING-CREW-14 CARD-COWBOY-GATLING-CREW-15 CARD-COWBOY-GATLING-CREW-16 CARD-COWBOY-GATLING-CREW-17 CARD-COWBOY-GATLING-CREW-18 CARD-COWBOY-GATLING-CREW-19 CARD-COWBOY-GATLING-CREW-20: Gatling Crew full specification", () => {
  assert.deepEqual(TYPES["cowboy-gatling-crew"], {
    side: "cowboy", name: "Gatling Crew", kind: "troop", stars: 7, attack: 4, health: 4,
    bounty: false, keys: ["sweep"], rarity: "rare", tag: "Rig",
  });
  assert.equal("cowboy-gatling-crew" in DECKS.cowboy, false);

  const three = stage({own: [troop("cowboy-sheriff", 1), troop("cowboy-sheriff", 2), troop("cowboy-sheriff", 3)], hand: ["cowboy-gatling-crew-1"]});
  assert.deepEqual(legalActions(three).filter((a) => a.type === "summon").map((a) => a.tributes), [[0, 1], [0, 2], [1, 2]]);
  for (const own of [[], [troop("cowboy-sheriff", 1)]]) {
    assert.equal(legalActions(stage({own, hand: ["cowboy-gatling-crew-1"]})).some((a) => a.type === "summon"), false);
  }
  const summoned = applyAction(three, {type: "summon", cardId: "cowboy-gatling-crew-1", tributes: [1, 2]});
  const sum = summoned.state;
  assert.deepEqual(summoned.events.map((e) => [e.type, e.cardId]), [
    ["tribute", "cowboy-sheriff-2"], ["tribute", "cowboy-sheriff-3"], ["summon", "cowboy-gatling-crew-1"],
  ]);
  assert.deepEqual(sum.sides.cowboy.discard, ["cowboy-sheriff-2", "cowboy-sheriff-3"]);
  assert.equal(sum.sides.cowboy.board[1].cardId, "cowboy-gatling-crew-1");
  assert.equal(canAttack(sum, sum.sides.cowboy.board[1]), true);

  // 05, 06, 08, 11, 12, 15, 16: Sweep across Jack & Lantern Wraith, Base spill 1, no Last Stand from Sweep
  const board = stage({
    own: [troop("cowboy-gatling-crew", 1, {health: 4})],
    foe: [troop("wizard-skeleton", 1, {health: 3}), troop("wizard-jack-o-lantern", 2, {health: 1}), troop("wizard-lantern-wraith", 3, {health: 4})],
    bases: {wizard: 5},
  });
  assert.deepEqual(attackOutcome(board, 0, 0), {baseDamage: 1, targetLeft: 0, attackerLeft: 4});
  const atk = applyAction(board, {type: "attack", slot: 0, target: 0});
  assert.deepEqual(atk.events.map((e) => e.type), ["attack", "sweep"]);
  const swEv = atk.events[1];
  assert.equal(swEv.count, 2);
  assert.equal(presentEvent(swEv), "Sweep: Gatling Crew also hit 2 other troops for 1.");
  assert.equal(atk.events.some((e) => e.type === "laststand"), false);
  assert.equal(atk.state.sides.cowboy.board[0].health, 4);
  assert.equal(atk.state.sides.wizard.board[1], null);
  assert.equal(atk.state.sides.wizard.board[2].health, 3);
  assert.equal(atk.state.sides.wizard.base, 4);

  // 07: Sweep still fires when Gatling Crew dies to Dragon hit-back
  const dieSweep = applyAction(stage({own: [troop("cowboy-gatling-crew", 1, {health: 3})], foe: [troop("wizard-dragon", 1, {health: 5}), troop("wizard-skeleton", 2, {health: 2}), null]}), {type: "attack", slot: 0, target: 0});
  assert.equal(dieSweep.state.sides.cowboy.board[0], null);
  assert.equal(dieSweep.state.sides.wizard.board[1].health, 1);

  // 09 & 10: Guard Bone Wall funnels target, Sweep still hits adjacent Skeleton
  const guardBoard = stage({own: [troop("cowboy-gatling-crew", 1)], foe: [troop("wizard-bone-wall", 1, {health: 4}), troop("wizard-skeleton", 2, {health: 3}), null]});
  assert.deepEqual(legalActions(guardBoard).filter((a) => a.type === "attack").map((a) => a.target), [0]);
  const hitWall = applyAction(guardBoard, {type: "attack", slot: 0, target: 0});
  assert.equal(hitWall.state.sides.wizard.board[1].health, 2);

  // 13 & 14: Hex cancels Sweep; defending Gatling Crew applies no Sweep
  const hexed = applyAction(stage({own: [troop("cowboy-gatling-crew", 1)], foe: [troop("wizard-skeleton", 1), troop("wizard-skeleton", 2), null], traps: {wizard: ["wizard-hex-1"]}}), {type: "attack", slot: 0, target: 0});
  assert.equal(hexed.events.find((e) => e.type === "trap")?.stopped, true);
  assert.deepEqual(hexed.state.sides.wizard.board.map((t) => t?.health ?? null), [3, 3, null]);
  assert.equal(hexed.events.some((e) => e.type === "sweep"), false);
  const defGat = applyAction(stage({active: "wizard", own: [troop("wizard-skeleton", 1), troop("wizard-skeleton", 2), null], foe: [troop("cowboy-gatling-crew", 1)]}), {type: "attack", slot: 0, target: 0});
  assert.equal(defGat.state.sides.wizard.board[1].health, 3);
  assert.equal(defGat.events.some((e) => e.type === "sweep"), false);

  let s5 = newSave();
  for (let i = 0; i < 5; i += 1) { s5 = settle(s5, "trail", true).save; if (s5.offer) s5 = choose(s5, s5.offer[0]); }
  const s6 = settle(s5, "trail", true).save;
  assert.equal(s6.collection["cowboy-gatling-crew"], 1);
  assert.equal(s6.deck["cowboy-gatling-crew"], 1);
  assert.equal(s6.deck["cowboy-billy"], s5.deck["cowboy-billy"] - 1);
  assert.equal(saveCodeSame(migrate({...s6, deck: {"cowboy-sheriff": 12, "cowboy-gatling-crew": 4}}), newSave()), true);
  assertCopyCap(s6, "cowboy-gatling-crew", 2, "Rare");
  assert.equal(saveCodeSame(migrate({...s6, collection: {...s6.collection, "cowboy-gatling-crew": 9}}), newSave()), true);
});

test("CARD-COWBOY-SHERIFFS-OFFICE-01 CARD-COWBOY-SHERIFFS-OFFICE-02 CARD-COWBOY-SHERIFFS-OFFICE-03 CARD-COWBOY-SHERIFFS-OFFICE-04 CARD-COWBOY-SHERIFFS-OFFICE-05 CARD-COWBOY-SHERIFFS-OFFICE-06 CARD-COWBOY-SHERIFFS-OFFICE-07 CARD-COWBOY-SHERIFFS-OFFICE-08 CARD-COWBOY-SHERIFFS-OFFICE-09 CARD-COWBOY-SHERIFFS-OFFICE-10 CARD-COWBOY-SHERIFFS-OFFICE-11 CARD-COWBOY-SHERIFFS-OFFICE-12 CARD-COWBOY-SHERIFFS-OFFICE-13 CARD-COWBOY-SHERIFFS-OFFICE-14: Sheriff's Office full specification", () => {
  assert.deepEqual(TYPES["cowboy-sheriffs-office"], {
    side: "cowboy", name: "Sheriff's Office", rarity: "rare", kind: "location", effect: "office", fresh: true,
  });
  assert.equal("cowboy-sheriffs-office" in DECKS.cowboy, false);

  const st = stage({
    own: [troop("cowboy-sheriff", 1), troop("cowboy-outrider", 2), troop("cowboy-billy", 3)],
    foe: [troop("cowboy-ranger", 4)],
    hand: ["cowboy-sheriffs-office-1", "cowboy-sheriffs-office-2", "cowboy-deadeye-1", "cowboy-six-shooter-1"],
    location: {cardId: "wizard-boneyard-1", side: "wizard"},
  });
  assert.deepEqual(legalActions(st).filter((a) => a.type === "location"), [{type: "location", cardId: "cowboy-sheriffs-office-1"}]);
  const res = applyAction(st, {type: "location", cardId: "cowboy-sheriffs-office-1"});
  assert.deepEqual(res.state.location, {cardId: "cowboy-sheriffs-office-1", side: "cowboy"});
  assert.deepEqual(res.state.sides.cowboy.discard, []);
  assert.deepEqual(res.state.sides.wizard.discard, ["wizard-boneyard-1"]);
  assert.equal(presentEvent(res.events[0]), "The Cowboys' Sheriff's Office is now the location.");
  assert.equal(legalActions(res.state).some((a) => ["spell", "gear", "location"].includes(a.type)), false);

  const duplicateOffice = stage({hand: ["cowboy-sheriffs-office-2"], location: res.state.location});
  assert.equal(legalActions(duplicateOffice).some((a) => a.type === "location"), false);
  assert.equal(attackOf(res.state, res.state.sides.cowboy.board[0]), 2);
  assert.equal(attackOf(res.state, res.state.sides.cowboy.board[1]), 2);
  assert.equal(attackOf(res.state, res.state.sides.wizard.board[0]), 3);
  assert.equal(attackOf(res.state, res.state.sides.cowboy.board[2]), 2);

  const nextWiz = applyAction(res.state, {type: "end"}).state;
  nextWiz.sides.wizard.hand = ["wizard-boneyard-2"];
  const backBy = applyAction(nextWiz, {type: "location", cardId: "wizard-boneyard-2"}).state;
  assert.ok(backBy.sides.cowboy.discard.includes("cowboy-sheriffs-office-1"));

  let s = trailClearedSave();
  assert.equal(pool(s).includes("cowboy-sheriffs-office"), false);
  s = settle(s, "rival:stargazer", true).save;
  if (s.offer) s = choose(s, s.offer[0]);
  assert.equal(pool(s).includes("cowboy-sheriffs-office"), false);
  const impWin = settle(s, "rival:imp", true);
  assert.deepEqual(impWin.earned.cards, [["cowboy-sheriffs-office", 1]]);
  assert.equal(impWin.earned.packs, 1);
  assertCopyCap(impWin.save, "cowboy-sheriffs-office", 2, "Rare");
});

test("CARD-COWBOY-SIX-SHOOTER-01 CARD-COWBOY-SIX-SHOOTER-02 CARD-COWBOY-SIX-SHOOTER-03 CARD-COWBOY-SIX-SHOOTER-04 CARD-COWBOY-SIX-SHOOTER-05 CARD-COWBOY-SIX-SHOOTER-06 CARD-COWBOY-SIX-SHOOTER-07 CARD-COWBOY-SIX-SHOOTER-08 CARD-COWBOY-SIX-SHOOTER-09 CARD-COWBOY-SIX-SHOOTER-10 CARD-COWBOY-SIX-SHOOTER-11 CARD-COWBOY-SIX-SHOOTER-12 CARD-COWBOY-SIX-SHOOTER-13 CARD-COWBOY-SIX-SHOOTER-14: Six-Shooter full specification", () => {
  assert.deepEqual(TYPES["cowboy-six-shooter"], {
    side: "cowboy", name: "Six-Shooter", rarity: "uncommon", kind: "gear", effect: "sixshooter", fresh: true,
  });
  assert.equal("cowboy-six-shooter" in DECKS.cowboy, false);

  const st = stage({
    own: [troop("cowboy-sheriff", 1, {health: 3}), troop("cowboy-mounted-billy", 2), null],
    foe: [troop("wizard-skeleton", 1)],
    hand: ["cowboy-six-shooter-1", "cowboy-six-shooter-2", "cowboy-deadeye-1", "cowboy-sheriffs-office-1"],
  });
  const empty = stage({hand: ["cowboy-six-shooter-1"]});
  assert.equal(legalActions(empty).some((a) => a.type === "gear"), false);
  for (const type of ["spell", "location"]) assert.ok(legalActions(st).some((a) => a.type === type));
  assert.deepEqual(legalActions(st).filter((a) => a.type === "gear").map((a) => a.slot), [0, 1]);
  const g1 = applyAction(st, {type: "gear", cardId: "cowboy-six-shooter-1", slot: 0});
  assert.equal(presentEvent(g1.events[0]), "The Cowboys' Sheriff now carries Six-Shooter.");
  assert.equal(attackOf(g1.state, g1.state.sides.cowboy.board[0]), 2);
  assert.equal(g1.state.sides.cowboy.board[0].health, 3);
  assert.equal(legalActions(g1.state).some((a) => ["spell", "location", "gear"].includes(a.type)), false);

  // Stack second Six-Shooter
  const wizardTurn = applyAction(g1.state, {type: "end"}).state;
  const g2State = applyAction(wizardTurn, {type: "end"}).state;
  const g2 = applyAction(g2State, {type: "gear", cardId: "cowboy-six-shooter-2", slot: 0}).state;
  assert.equal(attackOf(g2, g2.sides.cowboy.board[0]), 3);

  // Hit-back uses gear (+1 -> 2), defeat & tribute discard order
  const wizAtk = applyAction(stage({active: "wizard", own: [troop("wizard-skeleton", 1, {health: 3}), troop("wizard-dragon", 2)], foe: [troop("cowboy-sheriff", 1, {health: 2, gear: ["cowboy-six-shooter-1"]})]}), {type: "attack", slot: 0, target: 0});
  assert.equal(wizAtk.state.sides.wizard.board[0].health, 1);
  const defeated = applyAction(wizAtk.state, {type: "attack", slot: 1, target: 0});
  assert.deepEqual(defeated.state.sides.cowboy.discard, ["cowboy-sheriff-1", "cowboy-six-shooter-1"]);

  const trib = applyAction(stage({own: [troop("cowboy-sheriff", 1, {gear: ["cowboy-six-shooter-1"]})], hand: ["cowboy-billy-1"]}), {type: "summon", cardId: "cowboy-billy-1", tributes: [0]});
  assert.deepEqual(trib.state.sides.cowboy.discard, ["cowboy-sheriff-1", "cowboy-six-shooter-1"]);

  const mbRide = applyAction(stage({own: [troop("cowboy-mounted-billy", 1, {gear: ["cowboy-six-shooter-1"]})], foe: [troop("wizard-skeleton", 1)], bases: {wizard: 5}}), {type: "attack", slot: 0, target: "base"});
  assert.equal(mbRide.state.sides.wizard.base, 4);

  let s = trailClearedSave();
  assert.equal(pool(s).includes("cowboy-six-shooter"), false);
  const starWin = settle(s, "rival:stargazer", true);
  assert.deepEqual(starWin.earned.cards, [["cowboy-six-shooter", 1]]);
  assert.equal(starWin.earned.packs, 1);
  assertCopyCap(starWin.save, "cowboy-six-shooter", 3, "Uncommon");
});

// ---------------------------------------------------------------- Wizard cards

test("CARD-WIZARD-BONE-ARMOR-01 CARD-WIZARD-BONE-ARMOR-02 CARD-WIZARD-BONE-ARMOR-03 CARD-WIZARD-BONE-ARMOR-04 CARD-WIZARD-BONE-ARMOR-05 CARD-WIZARD-BONE-ARMOR-06 CARD-WIZARD-BONE-ARMOR-07 CARD-WIZARD-BONE-ARMOR-08 CARD-WIZARD-BONE-ARMOR-09 CARD-WIZARD-BONE-ARMOR-10 CARD-WIZARD-BONE-ARMOR-11 CARD-WIZARD-BONE-ARMOR-12: Bone Armor full specification", () => {
  assert.deepEqual(TYPES["wizard-bone-armor"], {
    side: "wizard", name: "Bone Armor", rarity: "uncommon", kind: "gear", effect: "bonearmor", fresh: true,
  });
  assert.deepEqual(EFFECTS.bonearmor, {attack: 0, orbs: 2, text: "Gear. The troop that carries it gains 2 orbs."});
  assertWizardDecks("wizard-bone-armor", {imp: 1, bonewright: 1});

  assert.equal(legalActions(stage({active: "wizard", own: [], hand: ["wizard-bone-armor-1"]})).some((a) => a.type === "gear"), false);
  const st = stage({active: "wizard", own: [troop("wizard-skeleton", 1), null, troop("wizard-imp", 1)], foe: [troop("cowboy-billy", 1)], hand: ["wizard-bone-armor-1", "wizard-boneyard-1", "wizard-singularity-1"]});
  assert.deepEqual(legalActions(st).filter((a) => a.type === "gear").map((a) => a.slot), [0, 2]);
  const g1 = applyAction(st, {type: "gear", cardId: "wizard-bone-armor-1", slot: 0});
  assert.equal(presentEvent(g1.events[0]), "The Wizards' Skeleton now carries Bone Armor.");
  assert.equal(g1.state.sides.wizard.board[0].health, 5);
  assert.equal(attackOf(g1.state, g1.state.sides.wizard.board[0]), 1);
  assert.equal(legalActions(g1.state).some((a) => ["spell", "location", "gear"].includes(a.type)), false);
  assert.equal(g1.state.sides.wizard.hand.includes("wizard-bone-armor-1"), false);
  assert.equal(g1.state.sides.wizard.discard.includes("wizard-bone-armor-1"), false);

  assert.equal(g1.state.sides.wizard.deck.includes("wizard-bone-armor-1"), false);
  assert.deepEqual(g1.state.sides.wizard.board[0].gear, ["wizard-bone-armor-1"]);
  const g2St = structuredClone(g1.state);
  g2St.castUsed = false;
  g2St.sides.wizard.hand = ["wizard-bone-armor-2"];
  const g2 = applyAction(g2St, {type: "gear", cardId: "wizard-bone-armor-2", slot: 0}).state;
  assert.equal(g2.sides.wizard.board[0].health, 7);

  // Tribute into Wizard (Raise): Skeleton returns at 1 orb, Bone Armor stays in graveyard
  const doomed = stage({own: [troop("cowboy-billy", 1)], foe: [troop("wizard-imp", 1, {gear: [GEAR.wizard]})]});
  const defeated = applyAction(doomed, {type: "attack", slot: 0, target: 0});
  assert.deepEqual(defeated.state.sides.wizard.discard, ["wizard-imp-1", GEAR.wizard]);
  const paid = stage({active: "wizard", own: [troop("wizard-imp", 1, {gear: [GEAR.wizard]})], hand: ["wizard-wizard-1"]});
  assert.deepEqual(applyAction(paid, {type: "summon", cardId: "wizard-wizard-1", tributes: [0]}).state.sides.wizard.discard, ["wizard-imp-1", GEAR.wizard]);
  const raiseSt = structuredClone(g1.state);
  raiseSt.sides.wizard.hand = ["wizard-wizard-1"];
  const raised = applyAction(raiseSt, {type: "summon", cardId: "wizard-wizard-1", tributes: [0]}).state;
  assert.deepEqual(raised.sides.wizard.discard, ["wizard-bone-armor-1"]);
  assert.deepEqual(raised.sides.wizard.board[1].gear, []);
});

test("CARD-WIZARD-BONE-WALL-01 CARD-WIZARD-BONE-WALL-03 CARD-WIZARD-BONE-WALL-04 CARD-WIZARD-BONE-WALL-05 CARD-WIZARD-BONE-WALL-06 CARD-WIZARD-BONE-WALL-07 CARD-WIZARD-BONE-WALL-08 CARD-WIZARD-BONE-WALL-09 CARD-WIZARD-BONE-WALL-10 CARD-WIZARD-BONE-WALL-11 CARD-WIZARD-BONE-WALL-12 CARD-WIZARD-BONE-WALL-13 CARD-WIZARD-BONE-WALL-14 CARD-WIZARD-BONE-WALL-15 CARD-WIZARD-BONE-WALL-16 CARD-WIZARD-BONE-WALL-17 CARD-WIZARD-BONE-WALL-18 CARD-WIZARD-BONE-WALL-19 CARD-WIZARD-BONE-WALL-20: Bone Wall engine and catalog specification", () => {
  assert.deepEqual(TYPES["wizard-bone-wall"], {
    side: "wizard", name: "Bone Wall", rarity: "common", kind: "troop", stars: 3, attack: 0, health: 4, tag: "Undead", keys: ["guard"], fresh: true,
  });
  assert.equal(SHOWDOWN_SPECS.find((s) => s.type === "wizard-bone-wall").attack, 0);
  assertWizardDecks("wizard-bone-wall", {even: 2, "bone-fence": 3, "hexed-mile": 2, bonewright: 3, "lantern-wraith": 2, "dragons-roost": 2, coven: 2});

  assert.equal(legalActions(stage({active: "wizard", own: [troop("wizard-skeleton", 1), troop("wizard-skeleton", 2), troop("wizard-skeleton", 3)], hand: ["wizard-bone-wall-1"]})).some((a) => a.type === "summon"), false);
  const sum = applyAction(stage({active: "wizard", hand: ["wizard-bone-wall-1"]}), {type: "summon", cardId: "wizard-bone-wall-1", tributes: []}).state;
  const wall = sum.sides.wizard.board[0];
  assert.deepEqual(wall.gear, []);
  assert.equal(wall.health, 4);
  assert.equal(wall.ready, false);
  assert.equal(legalActions(sum).some((a) => a.type === "cover" && a.slot === 0), true);
  assert.equal(legalActions(sum).some((a) => a.type === "attack"), false);

  const readyWall = stage({active: "wizard", own: [troop("wizard-bone-wall", 1, {gear: [GEAR.wizard]})]});
  assert.equal(attackOf(readyWall, readyWall.sides.wizard.board[0]), 0);
  assert.equal(legalActions(readyWall).some((a) => a.type === "attack"), false);
  const byWall = {...readyWall, location: {cardId: "wizard-boneyard-1", side: "wizard"}};
  assert.equal(attackOf(byWall, byWall.sides.wizard.board[0]), 1);
  assert.equal(legalActions(byWall).some((a) => a.type === "attack"), true);

  // Cowboy targeting & spells against Bone Wall
  const vsWall = stage({
    own: [troop("cowboy-billy", 1), troop("cowboy-outrider", 2), null],
    foe: [troop("wizard-bone-wall", 1, {health: 4}), troop("wizard-skeleton", 2, {health: 3}), null],
    hand: ["cowboy-deadeye-1", "cowboy-lasso-1"],
  });
  assert.deepEqual(legalActions(vsWall).filter((a) => a.type === "attack").map((a) => [a.slot, a.target]), [[0, 0], [1, 0]]);
  for (const card of ["cowboy-lasso-1", "cowboy-deadeye-1"]) {
    assert.deepEqual(legalActions(vsWall).filter((a) => a.type === "spell" && a.cardId === card).map((a) => a.target), [0, 1]);
  }

  const hitSurvive = applyAction(vsWall, {type: "attack", slot: 0, target: 0});
  assert.equal(hitSurvive.events[0].hitBack, 0);
  assert.equal(presentEvent(hitSurvive.events[0]), "The Cowboys' Billy attacked Bone Wall and left it on 2; it has no attack, so it did not hit back.");

  const spillOut = applyAction(stage({own: [troop("cowboy-gatling-crew", 1)], foe: [troop("wizard-bone-wall", 1, {health: 2, cover: false, gear: [GEAR.wizard]})], bases: {wizard: 5}}), {type: "attack", slot: 0, target: 0});
  assert.equal(spillOut.state.sides.wizard.base, 3);
  assert.deepEqual(spillOut.state.sides.wizard.discard, ["wizard-bone-wall-1", GEAR.wizard]);

  const spillCov = applyAction(stage({own: [troop("cowboy-gatling-crew", 1)], foe: [troop("wizard-bone-wall", 1, {health: 2, cover: true})], bases: {wizard: 5}}), {type: "attack", slot: 0, target: 0});
  assert.equal(spillCov.state.sides.wizard.base, 5);

  const raiseWall = stage({active: "wizard", own: [troop("wizard-imp", 1)], hand: ["wizard-wizard-1"]});
  raiseWall.sides.wizard.discard = ["wizard-bone-wall-1"];
  const raised = applyAction(raiseWall, {type: "summon", cardId: "wizard-wizard-1", tributes: [0]}).state;
  assert.deepEqual(raised.sides.wizard.board[1].gear, []);
  assert.equal(raised.sides.wizard.board[1].cardId, "wizard-bone-wall-1");
  assert.equal(raised.sides.wizard.board[1].health, 1);
});

test("CARD-WIZARD-BONEYARD-01 CARD-WIZARD-BONEYARD-02 CARD-WIZARD-BONEYARD-03 CARD-WIZARD-BONEYARD-04 CARD-WIZARD-BONEYARD-05 CARD-WIZARD-BONEYARD-06 CARD-WIZARD-BONEYARD-07 CARD-WIZARD-BONEYARD-08 CARD-WIZARD-BONEYARD-09 CARD-WIZARD-BONEYARD-10 CARD-WIZARD-BONEYARD-11 CARD-WIZARD-BONEYARD-12 CARD-WIZARD-BONEYARD-13 CARD-WIZARD-BONEYARD-14 CARD-WIZARD-BONEYARD-15: Boneyard full specification", () => {
  assert.deepEqual(TYPES["wizard-boneyard"], {
    side: "wizard", name: "Boneyard", rarity: "rare", kind: "location", effect: "boneyard", fresh: true,
  });
  assert.equal(EFFECTS.boneyard.tag, "Undead");
  assertWizardDecks("wizard-boneyard", {bonewright: 2, coven: 1});

  const st = stage({
    active: "wizard",
    own: [troop("wizard-bone-wall", 1), troop("wizard-headless-horseman", 2), troop("wizard-imp", 3)],
    foe: [troop("cowboy-captured-wraith", 1), troop("cowboy-sheriff", 2, {health: 1}), null],
    hand: ["wizard-boneyard-1", "wizard-boneyard-2"],
    location: {cardId: "cowboy-sheriffs-office-1", side: "cowboy"},
  });
  const played = applyAction(st, {type: "location", cardId: "wizard-boneyard-1"});
  assert.deepEqual(played.state.location, {cardId: "wizard-boneyard-1", side: "wizard"});
  for (const side of Object.values(played.state.sides)) {
    for (const zone of [side.hand, side.deck, side.discard]) assert.ok(!zone.includes("wizard-boneyard-1"));
  }
  assert.deepEqual(played.state.sides.cowboy.discard, ["cowboy-sheriffs-office-1"]);
  assert.equal(played.state.castUsed, true);
  assert.equal(presentEvent(played.events[0]), "The Wizards' Boneyard is now the location.");
  assert.deepEqual(viewFor(played.state, "cowboy").location, played.state.location);
  assert.deepEqual(viewFor(played.state, "wizard").location, played.state.location);

  assert.equal(attackOf(played.state, played.state.sides.wizard.board[0]), 1);
  assert.equal(canAttack(played.state, played.state.sides.wizard.board[0]), true);
  assert.equal(attackOf(played.state, played.state.sides.wizard.board[2]), 3);
  assert.equal(attackOf(played.state, played.state.sides.cowboy.board[0]), 3);

  // 12 & 13: +1 applies to overflow/hit-back; Horseman ride-past stays 1
  assert.equal(attackOutcome(played.state, 1, "base").baseDamage, 1);
  assert.equal(attackOutcome(played.state, 1, 1).baseDamage, 2);
  const counter = stage({own: [troop("cowboy-sheriff", 1)], foe: [troop("wizard-bone-wall", 1)], location: played.state.location});
  assert.equal(applyAction(counter, {type: "attack", slot: 0, target: 0}).events[0].hitBack, 1);
  const replayCheck = {...played.state, castUsed: false};
  assert.equal(legalActions(replayCheck).some((a) => a.type === "location"), false);

  const cowboyTurn = applyAction(played.state, {type: "end"}).state;
  cowboyTurn.sides.cowboy.hand = ["cowboy-sheriffs-office-2"];
  const replaced = applyAction(cowboyTurn, {type: "location", cardId: "cowboy-sheriffs-office-2"}).state;
  assert.ok(replaced.sides.wizard.discard.includes("wizard-boneyard-1"));
});

test("CARD-WIZARD-SKELETON-01 CARD-WIZARD-SKELETON-02 CARD-WIZARD-SKELETON-03 CARD-WIZARD-SKELETON-04 CARD-WIZARD-SKELETON-05 CARD-WIZARD-SKELETON-06 CARD-WIZARD-SKELETON-07 CARD-WIZARD-SKELETON-08 CARD-WIZARD-SKELETON-09: Skeleton engine and catalog specification", () => {
  assert.deepEqual(TYPES["wizard-skeleton"], {
    side: "wizard", name: "Skeleton", kind: "troop", stars: 1, attack: 1, health: 3,
    bounty: false, keys: [], rarity: "basic", tag: "Undead",
  });
  assert.equal(CARD_SPECS.find((s) => s.type === "wizard-skeleton").copies, 6);
  assert.equal("copies" in SHOWDOWN_SPECS.find((s) => s.type === "wizard-skeleton"), false);
  assertWizardDecks("wizard-skeleton", {even: 4, "boot-hill": 16, "raven-roost": 9, "bone-fence": 8, "imp-hollow": 6, "hexed-mile": 6, "dragons-roost": 4, stargazer: 4, imp: 4, bonewright: 5, coven: 3, "lantern-wraith": 6, "graveyard-dragon": 9});

  const sum = applyAction(stage({active: "wizard", hand: ["wizard-skeleton-1"]}), {type: "summon", cardId: "wizard-skeleton-1", tributes: []}).state;
  assert.equal(canAttack(sum, sum.sides.wizard.board[0]), false);

  const hit = applyAction(stage({own: [troop("cowboy-sheriff", 1, {health: 3})], foe: [troop("wizard-skeleton", 1, {health: 3})]}), {type: "attack", slot: 0, target: 0});
  assert.equal(hit.state.sides.cowboy.board[0].health, 2);

  const by = stage({active: "wizard", own: [troop("wizard-skeleton", 1)], location: {cardId: "wizard-boneyard-1", side: "wizard"}});
  assert.equal(attackOf(by, by.sides.wizard.board[0]), 2);

  const raised = applyAction(stage({active: "wizard", own: [troop("wizard-skeleton", 1)], hand: ["wizard-wizard-1"]}), {type: "summon", cardId: "wizard-wizard-1", tributes: [0]}).state;
  assert.equal(raised.sides.wizard.board[1].cardId, "wizard-skeleton-1");
  assert.equal(raised.sides.wizard.board[1].health, 1);
  assert.equal(canAttack(raised, raised.sides.wizard.board[1]), false);
});

test("CARD-WIZARD-WIZARD-01 CARD-WIZARD-WIZARD-02 CARD-WIZARD-WIZARD-03 CARD-WIZARD-WIZARD-04 CARD-WIZARD-WIZARD-05 CARD-WIZARD-WIZARD-06 CARD-WIZARD-WIZARD-07 CARD-WIZARD-WIZARD-08 CARD-WIZARD-WIZARD-09 CARD-WIZARD-WIZARD-10 CARD-WIZARD-WIZARD-11 CARD-WIZARD-WIZARD-12 CARD-WIZARD-WIZARD-13 CARD-WIZARD-WIZARD-14 CARD-WIZARD-WIZARD-15 CARD-WIZARD-WIZARD-16 CARD-WIZARD-WIZARD-17 CARD-WIZARD-WIZARD-18 CARD-WIZARD-WIZARD-19 CARD-WIZARD-WIZARD-20 CARD-WIZARD-WIZARD-21: Wizard troop and Raise full engine specification", () => {
  assert.deepEqual(TYPES["wizard-wizard"], {
    side: "wizard", name: "Wizard", kind: "troop", stars: 5, attack: 2, health: 4,
    bounty: false, keys: ["raise"], rarity: "uncommon", tag: "Mage",
  });
  assert.equal(CARD_SPECS.find((s) => s.type === "wizard-wizard").copies, 3);
  assert.equal("copies" in SHOWDOWN_SPECS.find((s) => s.type === "wizard-wizard"), false);
  assertWizardDecks("wizard-wizard", {even: 2, "bone-fence": 3, "hexed-mile": 3, "dragons-roost": 2, stargazer: 3, bonewright: 3, coven: 2, "graveyard-dragon": 2});

  assert.equal(legalActions(stage({active: "wizard", own: [], hand: ["wizard-wizard-1"]})).some((a) => a.type === "summon"), false);
  const full3 = stage({active: "wizard", own: [troop("wizard-imp", 1), troop("wizard-imp", 2), troop("wizard-imp", 3)], hand: ["wizard-wizard-1"]});
  full3.sides.wizard.discard = ["wizard-skeleton-9"];
  assert.deepEqual(legalActions(full3).filter((a) => a.type === "summon").map((a) => a.tributes), [[0], [1], [2]]);
  const noRoom = applyAction(full3, {type: "summon", cardId: "wizard-wizard-1", tributes: [1]});
  assert.equal(noRoom.state.sides.wizard.board[1].cardId, "wizard-wizard-1");
  assert.equal(noRoom.events.some((e) => e.type === "raise"), false);
  assert.deepEqual(noRoom.state.sides.wizard.discard, ["wizard-skeleton-9", "wizard-imp-2"]);

  const hit = applyAction(stage({own: [troop("cowboy-sheriff")], foe: [troop("wizard-wizard")]}), {type: "attack", slot: 0, target: 0});
  assert.equal(hit.state.sides.wizard.board[0].health, 3);
  assert.equal(hit.state.sides.cowboy.board[0].health, 1);

  // Raise skips non-Undead & Cowboy graveyard, leaves gear behind, emits tribute->summon->raise
  const st = stage({active: "wizard", own: [troop("wizard-skeleton", 1, {gear: [GEAR.wizard]})], hand: ["wizard-wizard-1"]});
  st.sides.cowboy.discard = ["cowboy-captured-wraith-1"];
  st.sides.wizard.discard = ["wizard-bone-wall-1", "wizard-imp-1", "wizard-hellfire-1"];
  const res = applyAction(st, {type: "summon", cardId: "wizard-wizard-1", tributes: [0]});
  assert.deepEqual(res.events.map((e) => e.type), ["tribute", "summon", "raise"]);
  assert.equal(presentEvent(res.events[2]), "Raise: The Wizards' Skeleton returned from the graveyard with 1 orb.");
  assert.equal(res.state.sides.wizard.board[0].cardId, "wizard-wizard-1");
  assert.equal(res.state.sides.wizard.board[0].health, 4);
  assert.equal(canAttack(res.state, res.state.sides.wizard.board[0]), true);
  assert.equal(res.state.sides.wizard.board[1].cardId, "wizard-skeleton-1");
  assert.equal(res.state.sides.wizard.board[1].health, 1);
  assert.deepEqual(res.state.sides.wizard.board[1].gear, []);
  assert.equal(canAttack(res.state, res.state.sides.wizard.board[1]), false);
  assert.ok(res.state.sides.wizard.discard.includes(GEAR.wizard));

  const noUndead = stage({active: "wizard", own: [troop("wizard-imp", 1)], hand: ["wizard-wizard-1"]});
  noUndead.sides.wizard.discard = ["wizard-jack-o-lantern-1", "wizard-singularity-1", "wizard-hex-1", "wizard-bone-armor-1", "wizard-boneyard-1", "wizard-raven-familiar-1", "wizard-dragon-1", "wizard-wizard-2"];
  noUndead.sides.cowboy.discard = ["cowboy-captured-wraith-1"];
  const noRaise = applyAction(noUndead, {type: "summon", cardId: "wizard-wizard-1", tributes: [0]});
  assert.deepEqual(noRaise.events.map((e) => e.type), ["tribute", "summon"]);
  assert.deepEqual(noRaise.state.sides.wizard.board.map((t) => t?.cardId ?? null), ["wizard-wizard-1", null, null]);
  assert.deepEqual(noRaise.state.sides.cowboy.discard, ["cowboy-captured-wraith-1"]);
  assert.deepEqual(noRaise.state.sides.wizard.discard, [...noUndead.sides.wizard.discard, "wizard-imp-1"]);
  assert.deepEqual(res.state.sides.wizard.discard, [...st.sides.wizard.discard, GEAR.wizard]);
});

test("CARD-WIZARD-IMP-01 CARD-WIZARD-IMP-02 CARD-WIZARD-IMP-03 CARD-WIZARD-IMP-04 CARD-WIZARD-IMP-05 CARD-WIZARD-IMP-06 CARD-WIZARD-IMP-07 CARD-WIZARD-IMP-08 CARD-WIZARD-IMP-09 CARD-WIZARD-IMP-10: Imp engine and catalog specification", () => {
  assert.deepEqual(TYPES["wizard-imp"], {
    side: "wizard", name: "Imp", kind: "troop", stars: 2, attack: 3, health: 1,
    bounty: false, keys: ["quickdraw"], rarity: "uncommon", tag: "Fiend",
  });
  const laneImp = CARD_SPECS.find((s) => s.type === "wizard-imp");
  assert.equal(laneImp.copies, 0);
  assert.equal(laneImp.limit, 1);
  const showdownImp = SHOWDOWN_SPECS.find((s) => s.type === "wizard-imp");
  assert.equal("copies" in showdownImp, false);
  assert.equal("limit" in showdownImp, false);
  assertWizardDecks("wizard-imp", {even: 1, "imp-hollow": 3, "dragons-roost": 1, imp: 3, coven: 1});

  const t1 = applyAction(stage({active: "wizard", turn: 1, hand: ["wizard-imp-1"]}), {type: "summon", cardId: "wizard-imp-1", tributes: []}).state;
  assert.equal(legalActions(t1).some((a) => a.type === "attack"), false);
  const t2 = applyAction(stage({active: "wizard", turn: 2, hand: ["wizard-imp-1"]}), {type: "summon", cardId: "wizard-imp-1", tributes: []}).state;
  assert.equal(canAttack(t2, t2.sides.wizard.board[0]), true);

  const spill = applyAction(stage({active: "wizard", own: [troop("wizard-imp", 1)], foe: [troop("cowboy-sheriff", 1, {health: 2})], bases: {cowboy: 5}}), {type: "attack", slot: 0, target: 0});
  assert.equal(spill.state.sides.cowboy.board[0], null);
  assert.equal(spill.state.sides.cowboy.base, 4);

  const surviveHit = applyAction(stage({active: "wizard", own: [troop("wizard-imp", 1)], foe: [troop("cowboy-billy", 1, {health: 4})]}), {type: "attack", slot: 0, target: 0});
  assert.equal(surviveHit.state.sides.wizard.board[0], null);

  const trapped = applyAction(stage({active: "wizard", own: [troop("wizard-imp", 1, {health: 2})], foe: [troop("cowboy-sheriff", 1, {health: 3})], traps: {cowboy: ["cowboy-bear-trap-1"]}}), {type: "attack", slot: 0, target: 0});
  assert.equal(trapped.state.sides.wizard.board[0], null);
  assert.equal(trapped.state.sides.cowboy.board[0].health, 3);

  const ls = applyAction(stage({active: "wizard", own: [troop("wizard-imp", 1)], foe: [troop("cowboy-dynamiter", 1)]}), {type: "attack", slot: 0, target: 0});
  assert.equal(ls.state.sides.wizard.board[0], null);
  assert.equal(ls.state.sides.cowboy.board[0], null);
  assert.deepEqual(ls.events.map((e) => e.type), ["attack", "laststand"]);
});

test("CARD-WIZARD-JACK-O-LANTERN-01 CARD-WIZARD-JACK-O-LANTERN-02 CARD-WIZARD-JACK-O-LANTERN-03 CARD-WIZARD-JACK-O-LANTERN-04 CARD-WIZARD-JACK-O-LANTERN-05 CARD-WIZARD-JACK-O-LANTERN-06 CARD-WIZARD-JACK-O-LANTERN-07 CARD-WIZARD-JACK-O-LANTERN-08 CARD-WIZARD-JACK-O-LANTERN-09 CARD-WIZARD-JACK-O-LANTERN-10 CARD-WIZARD-JACK-O-LANTERN-11: Jack-o'-Lantern engine and catalog specification", () => {
  assert.deepEqual(TYPES["wizard-jack-o-lantern"], {
    side: "wizard", name: "Jack-o'-Lantern", rarity: "common", kind: "troop", stars: 1, attack: 1, health: 1, tag: "Fiend", keys: ["laststand"], fresh: true,
  });
  assertWizardDecks("wizard-jack-o-lantern", {even: 1, "raven-roost": 3, "imp-hollow": 3, "dragons-roost": 1, imp: 3, coven: 1, "lantern-wraith": 3, "graveyard-dragon": 2});

  // 03, 06, 10, 11: Covered Jack defeated -> Last Stand leaves Sheriff on 2
  const covDefeat = applyAction(stage({own: [troop("cowboy-sheriff", 1, {health: 3})], foe: [troop("wizard-jack-o-lantern", 1, {cover: true})]}), {type: "attack", slot: 0, target: 0});
  const ls1 = covDefeat.events.find((e) => e.type === "laststand");
  assert.deepEqual([ls1.cardId, ls1.target, ls1.left], ["wizard-jack-o-lantern-1", "cowboy-sheriff-1", 2]);
  assert.equal(covDefeat.state.sides.cowboy.board[0].health, 2);
  assert.equal(presentEvent(ls1), "Last Stand: Jack-o'-Lantern took an orb off Sheriff.");

  // 04 & 05: Jack attacks surviving 2-orb Billy -> hit-back kills Jack -> Last Stand leaves Billy on 0 -> Billy defeated
  const suicide = applyAction(stage({active: "wizard", own: [troop("wizard-jack-o-lantern", 1)], foe: [troop("cowboy-billy", 1, {health: 2})]}), {type: "attack", slot: 0, target: 0});
  const ls0 = suicide.events.find((e) => e.type === "laststand");
  assert.equal(ls0.left, 0);
  assert.equal(suicide.state.sides.cowboy.board[0], null);
  assert.equal(presentEvent(ls0), "Last Stand: Jack-o'-Lantern took an orb off Billy, defeating it.");

  // 07: No chain when Dynamiter & Jack both hit 0
  const noChain = applyAction(stage({own: [troop("cowboy-dynamiter", 1)], foe: [troop("wizard-jack-o-lantern", 1)]}), {type: "attack", slot: 0, target: 0});
  assert.equal(noChain.events.filter((e) => e.type === "laststand").length, 1);

  // 08 & 09: Tribute, spell, trap, Sweep, Base strike fire no Last Stand
  assert.equal(applyAction(stage({active: "wizard", own: [troop("wizard-jack-o-lantern", 1)], hand: ["wizard-wizard-1"]}), {type: "summon", cardId: "wizard-wizard-1", tributes: [0]}).events.some((e) => e.type === "laststand"), false);
  assert.equal(applyAction(stage({own: [], foe: [troop("wizard-jack-o-lantern", 1)], hand: ["cowboy-deadeye-1"]}), {type: "spell", cardId: "cowboy-deadeye-1", target: 0}).events.some((e) => e.type === "laststand"), false);
  assert.equal(applyAction(stage({own: [troop("cowboy-gatling-crew", 1)], foe: [troop("wizard-skeleton", 1), troop("wizard-jack-o-lantern", 2), null]}), {type: "attack", slot: 0, target: 0}).events.some((e) => e.type === "laststand"), false);
  assert.equal(applyAction(stage({active: "wizard", own: [troop("wizard-jack-o-lantern", 1)], foe: [], traps: {cowboy: ["cowboy-bear-trap-1"]}}), {type: "attack", slot: 0, target: "base"}).events.some((e) => e.type === "laststand"), false);
  assert.equal(applyAction(stage({active: "wizard", own: [troop("wizard-jack-o-lantern", 1)], foe: []}), {type: "attack", slot: 0, target: "base"}).events.some((e) => e.type === "laststand"), false);
});

test("CARD-WIZARD-RAVEN-FAMILIAR-01 CARD-WIZARD-RAVEN-FAMILIAR-02 CARD-WIZARD-RAVEN-FAMILIAR-03 CARD-WIZARD-RAVEN-FAMILIAR-04 CARD-WIZARD-RAVEN-FAMILIAR-05 CARD-WIZARD-RAVEN-FAMILIAR-06 CARD-WIZARD-RAVEN-FAMILIAR-07 CARD-WIZARD-RAVEN-FAMILIAR-08 CARD-WIZARD-RAVEN-FAMILIAR-09: Raven Familiar engine and catalog specification", () => {
  assert.deepEqual(TYPES["wizard-raven-familiar"], {
    side: "wizard", name: "Raven Familiar", rarity: "common", kind: "troop", stars: 2, attack: 1, health: 1, tag: "Beast", keys: ["scout"], fresh: true,
  });
  assertWizardDecks("wizard-raven-familiar", {even: 1, "raven-roost": 4, "dragons-roost": 1, stargazer: 2, coven: 1, "lantern-wraith": 2, "graveyard-dragon": 2});

  const st = stage({active: "wizard", hand: ["wizard-raven-familiar-1"]});
  st.sides.wizard.deck = ["wizard-hex-1"];
  const drawn = applyAction(st, {type: "summon", cardId: "wizard-raven-familiar-1", tributes: []});
  assert.equal(canAttack(drawn.state, drawn.state.sides.wizard.board[0]), false);
  assert.ok(drawn.state.sides.wizard.hand.includes("wizard-hex-1"));
  assert.equal(drawn.state.castUsed, false);
  assert.equal(drawn.state.setUsed, false);
  assert.deepEqual(drawn.events.map((e) => e.type), ["summon", "draw"]);
  assert.ok(legalActions(drawn.state).some((a) => a.type === "set" && a.cardId === "wizard-hex-1"));
  assert.equal(presentEvent(drawn.events.find((e) => e.type === "draw")), "The Wizards drew a card.");

  const empty = stage({active: "wizard", hand: ["wizard-raven-familiar-1"]});
  empty.sides.wizard.deck = [];
  const resEmpty = applyAction(empty, {type: "summon", cardId: "wizard-raven-familiar-1", tributes: []});
  assert.equal(resEmpty.events.some((e) => e.type === "draw" || e.type === "fatigue"), false);
  assert.equal(resEmpty.state.sides.wizard.base, 5);

  const fullHand = stage({active: "wizard", hand: ["wizard-raven-familiar-1", "wizard-skeleton-1", "wizard-skeleton-2", "wizard-skeleton-3", "wizard-skeleton-4", "wizard-skeleton-5", "wizard-skeleton-6"]});
  fullHand.sides.wizard.deck = ["wizard-hex-2"];
  const burned = applyAction(fullHand, {type: "summon", cardId: "wizard-raven-familiar-1", tributes: []});
  assert.ok(burned.state.sides.wizard.discard.includes("wizard-hex-2"));
  assert.deepEqual(burned.events.at(-1), {type: "burn", side: "wizard", cardId: "wizard-hex-2"});

  const botSt = stage({active: "wizard", hand: ["wizard-raven-familiar-1"]});
  botSt.sides.wizard.deck = ["wizard-hex-1", "wizard-skeleton-1"];
  assert.deepEqual(planTurn(botSt), [{type: "summon", cardId: "wizard-raven-familiar-1", tributes: []}]);
  const played = playTurn(botSt, 2);
  assert.deepEqual(played.events.slice(0, 3).map((e) => e.type), ["summon", "draw", "set"]);
  assert.deepEqual(played.state.sides.wizard.traps, ["wizard-hex-1"]);
});

test("CARD-WIZARD-HEADLESS-HORSEMAN-01 CARD-WIZARD-HEADLESS-HORSEMAN-02 CARD-WIZARD-HEADLESS-HORSEMAN-03 CARD-WIZARD-HEADLESS-HORSEMAN-04 CARD-WIZARD-HEADLESS-HORSEMAN-05 CARD-WIZARD-HEADLESS-HORSEMAN-06 CARD-WIZARD-HEADLESS-HORSEMAN-07 CARD-WIZARD-HEADLESS-HORSEMAN-08 CARD-WIZARD-HEADLESS-HORSEMAN-09 CARD-WIZARD-HEADLESS-HORSEMAN-10 CARD-WIZARD-HEADLESS-HORSEMAN-11 CARD-WIZARD-HEADLESS-HORSEMAN-12: Headless Horseman engine and catalog specification", () => {
  assert.deepEqual(TYPES["wizard-headless-horseman"], {
    side: "wizard", name: "Headless Horseman", rarity: "rare", kind: "troop", stars: 5, attack: 2, health: 3, tag: "Undead", keys: ["ride"], fresh: true,
  });
  assertWizardDecks("wizard-headless-horseman", {even: 1, "hexed-mile": 2, "dragons-roost": 1, imp: 2, bonewright: 2, coven: 1});

  const sum = applyAction(stage({active: "wizard", own: [troop("wizard-skeleton", 1)], hand: ["wizard-headless-horseman-1"]}), {type: "summon", cardId: "wizard-headless-horseman-1", tributes: [0]}).state;
  assert.equal(canAttack(sum, sum.sides.wizard.board[0]), true);

  const raiseSt = stage({active: "wizard", own: [troop("wizard-imp", 1)], hand: ["wizard-wizard-1"]});
  raiseSt.sides.wizard.discard = ["wizard-headless-horseman-1"];
  const raised = applyAction(raiseSt, {type: "summon", cardId: "wizard-wizard-1", tributes: [0]}).state;
  assert.equal(raised.sides.wizard.board[1].health, 1);
  assert.equal(canAttack(raised, raised.sides.wizard.board[1]), false);

  const vsOpen = stage({active: "wizard", own: [troop("wizard-headless-horseman", 1)], foe: [troop("cowboy-sheriff", 1)], bases: {cowboy: 5}});
  assert.deepEqual(legalActions(vsOpen).filter((a) => a.type === "attack").map((a) => a.target), [0, "base"]);
  const ride = applyAction(vsOpen, {type: "attack", slot: 0, target: "base"});
  assert.equal(ride.state.sides.cowboy.base, 4);
  assert.deepEqual(ride.state.sides.cowboy.board, vsOpen.sides.cowboy.board);
  assert.equal(ride.state.sides.wizard.board[0].health, vsOpen.sides.wizard.board[0].health);
  assert.equal(presentEvent(ride.events[0]), "The Wizards' Headless Horseman struck the Cowboys' Base for 1.");

  const vsWagon = stage({active: "wizard", own: [troop("wizard-headless-horseman", 1)], foe: [troop("cowboy-covered-wagon", 1), troop("cowboy-sheriff", 2), null]});
  assert.deepEqual(legalActions(vsWagon).filter((a) => a.type === "attack").map((a) => a.target), [0]);

  const direct = applyAction(stage({active: "wizard", own: [troop("wizard-headless-horseman", 1)], foe: [], bases: {cowboy: 5}}), {type: "attack", slot: 0, target: "base"});
  assert.equal(direct.state.sides.cowboy.base, 3);

  const bearTrap = applyAction(stage({active: "wizard", own: [troop("wizard-headless-horseman", 1, {health: 3})], foe: [troop("cowboy-sheriff", 1)], traps: {cowboy: ["cowboy-bear-trap-2", "cowboy-bear-trap-1"]}, bases: {cowboy: 5}}), {type: "attack", slot: 0, target: "base"});
  assert.equal(bearTrap.events[0].cardId, "cowboy-bear-trap-2");
  assert.deepEqual(bearTrap.state.sides.cowboy.traps, ["cowboy-bear-trap-1"]);
  assert.equal(bearTrap.state.sides.wizard.board[0].health, 1);
  assert.equal(bearTrap.state.sides.cowboy.base, 4);
});

test("CARD-WIZARD-LANTERN-WRAITH-01 CARD-WIZARD-LANTERN-WRAITH-03 CARD-WIZARD-LANTERN-WRAITH-07 CARD-WIZARD-LANTERN-WRAITH-08 CARD-WIZARD-LANTERN-WRAITH-09 CARD-WIZARD-LANTERN-WRAITH-10 CARD-WIZARD-LANTERN-WRAITH-12 CARD-WIZARD-LANTERN-WRAITH-13 CARD-WIZARD-LANTERN-WRAITH-14 CARD-WIZARD-LANTERN-WRAITH-15: Lantern Wraith engine and bounty specification", () => {
  assert.deepEqual(TYPES["wizard-lantern-wraith"], {
    side: "wizard", name: "Lantern Wraith", kind: "troop", stars: 6, attack: 2, health: 4,
    bounty: true, keys: ["ghostly"], rarity: "legendary", tag: "Undead",
  });
  assertWizardDecks("wizard-lantern-wraith", {});

  const s = trailClearedSave();
  const d5 = duelFor({...s, hunts: {"lantern-wraith": 4}}, "hunt:lantern-wraith");
  const game = createShowdown(1, d5.options);
  assert.equal(game.sides.wizard.board[0].cardId, "wizard-lantern-wraith-0");
  assert.equal(game.sides.wizard.board[0].health, 8);
  const wiz1 = applyAction(game, {type: "end"}).state;
  assert.equal(canAttack(wiz1, wiz1.sides.wizard.board[0]), true);

  const vsWraith = stage({own: [troop("cowboy-gatling-crew", 1)], foe: [troop("wizard-lantern-wraith", 1, {health: 4}), troop("wizard-skeleton", 2, {health: 3}), null], hand: ["cowboy-deadeye-1", "cowboy-lasso-1"]});
  assert.deepEqual(legalActions(vsWraith).filter((a) => a.type === "spell").map((a) => [a.cardId, a.target]), [
    ["cowboy-deadeye-1", 1], ["cowboy-lasso-1", 1],
  ]);
  assert.deepEqual(legalActions(vsWraith).filter((a) => a.type === "attack").map((a) => a.target), [0, 1]);
  const swept = applyAction(vsWraith, {type: "attack", slot: 0, target: 1});
  assert.deepEqual(swept.events.map((e) => [e.type, e.cardId, e.target ?? e.count]), [
    ["attack", "cowboy-gatling-crew-1", "wizard-skeleton-2"], ["sweep", "cowboy-gatling-crew-1", 1],
  ]);
  assert.equal(swept.state.sides.wizard.board[0].health, 3);

  const trapped = applyAction(stage({active: "wizard", own: [troop("wizard-lantern-wraith", 1, {health: 4})], foe: [], traps: {cowboy: ["cowboy-bear-trap-1"]}}), {type: "attack", slot: 0, target: "base"});
  assert.equal(trapped.state.sides.wizard.board[0].health, 2);

  let prog = s;
  for (let i = 1; i <= 5; i += 1) {
    prog = settle(prog, "hunt:lantern-wraith", true).save;
    if (prog.offer) prog = choose(prog, prog.offer[0]);
    assert.equal(prog.hunts["lantern-wraith"], i);
  }
  assert.equal(prog.collection["cowboy-captured-wraith"], 1);
  assert.equal(duelFor(prog, "hunt:lantern-wraith"), null);
});

test("CARD-WIZARD-DRAGON-01 CARD-WIZARD-DRAGON-02 CARD-WIZARD-DRAGON-03 CARD-WIZARD-DRAGON-04 CARD-WIZARD-DRAGON-05 CARD-WIZARD-DRAGON-06 CARD-WIZARD-DRAGON-07 CARD-WIZARD-DRAGON-08 CARD-WIZARD-DRAGON-09 CARD-WIZARD-DRAGON-10 CARD-WIZARD-DRAGON-11 CARD-WIZARD-DRAGON-12 CARD-WIZARD-DRAGON-13 CARD-WIZARD-DRAGON-15 CARD-WIZARD-DRAGON-16 CARD-WIZARD-DRAGON-17 CARD-WIZARD-DRAGON-18 CARD-WIZARD-DRAGON-19 CARD-WIZARD-DRAGON-22 CARD-WIZARD-DRAGON-23 CARD-WIZARD-DRAGON-24 CARD-WIZARD-DRAGON-25 CARD-WIZARD-DRAGON-26 CARD-WIZARD-DRAGON-27 CARD-WIZARD-DRAGON-28 CARD-WIZARD-DRAGON-29 CARD-WIZARD-DRAGON-30 CARD-WIZARD-DRAGON-31 CARD-WIZARD-DRAGON-32 CARD-WIZARD-DRAGON-33 CARD-WIZARD-DRAGON-34: Dragon engine and bounty specification", () => {
  assert.deepEqual(TYPES["wizard-dragon"], {
    side: "wizard", name: "Dragon", kind: "troop", stars: 8, attack: 3, health: 5,
    bounty: false, keys: ["sweep"], rarity: "legendary", tag: "Beast",
  });
  assert.equal(CARD_SPECS.find((s) => s.type === "wizard-dragon").copies, 1);
  assert.equal("copies" in SHOWDOWN_SPECS.find((s) => s.type === "wizard-dragon"), false);
  assertWizardDecks("wizard-dragon", {even: 1, "dragons-roost": 1, coven: 1});

  for (const own of [[], [troop("wizard-skeleton")]]) {
    const short = stage({active: "wizard", own, hand: ["wizard-dragon-1"]});
    assert.ok(legalActions(short).every((a) => a.type !== "summon"));
  }
  const three = stage({active: "wizard", own: [troop("wizard-skeleton", 1), troop("wizard-skeleton", 2), troop("wizard-skeleton", 3)], foe: [troop("cowboy-sheriff")], hand: ["wizard-dragon-1"]});
  assert.deepEqual(legalActions(three).filter((a) => a.type === "summon").map((a) => a.tributes), [[0, 1], [0, 2], [1, 2]]);
  const sum = applyAction(three, {type: "summon", cardId: "wizard-dragon-1", tributes: [0, 1]}).state;
  assert.equal(canAttack(sum, sum.sides.wizard.board[0]), true);
  assert.equal(sum.sides.wizard.board[0].cardId, "wizard-dragon-1");
  assert.ok(legalActions(sum).some((a) => a.type === "attack" && a.slot === 0 && a.target === 0));

  // Sweep mechanics (08..19)
  const swBoard = stage({
    active: "wizard",
    own: [troop("wizard-dragon", 1, {health: 5})],
    foe: [troop("cowboy-sheriff", 1, {health: 3}), troop("cowboy-dynamiter", 2, {health: 1, gear: [GEAR.cowboy]}), troop("cowboy-captured-wraith", 3, {health: 2, cover: true})],
    bases: {cowboy: 5, wizard: 5},
  });
  assert.deepEqual(attackOutcome(swBoard, 0, 0), {baseDamage: 0, targetLeft: 0, attackerLeft: 5});
  const swRes = applyAction(swBoard, {type: "attack", slot: 0, target: 0});
  assert.equal(swRes.events.some((e) => e.type === "laststand"), false);
  assert.deepEqual(swRes.state.sides.cowboy.discard, ["cowboy-sheriff-1", "cowboy-dynamiter-2", GEAR.cowboy]);
  assert.equal(swRes.state.sides.cowboy.board[2].health, 1);
  assert.equal(swRes.state.sides.cowboy.base, 5);
  assert.equal(swRes.state.sides.wizard.base, 5);
  assert.deepEqual(swRes.events.map((e) => e.type), ["attack", "sweep"]);
  const swEv = swRes.events[1];
  assert.equal(swEv.count, 2);
  assert.equal(presentEvent(swEv), "Sweep: Dragon also hit 2 other troops for 1.");

  const openBase = stage({active: "wizard", own: [troop("wizard-dragon")], bases: {cowboy: 5}});
  const baseStrike = applyAction(openBase, {type: "attack", slot: 0, target: "base"});
  assert.deepEqual(baseStrike.events.map((e) => [e.type, e.target, e.baseDamage]), [["attack", "base", 3]]);
  assert.equal(baseStrike.state.sides.cowboy.base, 2);
  const dieDrag = applyAction(stage({active: "wizard", own: [troop("wizard-dragon", 1, {health: 2})], foe: [troop("cowboy-gatling-crew", 1, {health: 4}), troop("cowboy-sheriff", 2, {health: 2}), null]}), {type: "attack", slot: 0, target: 0});
  assert.equal(dieDrag.state.sides.wizard.board[0], null);
  assert.equal(dieDrag.state.sides.cowboy.board[1].health, 1);
  assert.deepEqual(dieDrag.state.sides.wizard.discard, ["wizard-dragon-1"]);
  const vsLastStand = stage({active: "wizard", own: [troop("wizard-dragon", 1)],
    foe: [troop("cowboy-dynamiter", 1), troop("cowboy-sheriff", 1)]});
  const fight = applyAction(vsLastStand, {type: "attack", slot: 0, target: 0});
  assert.deepEqual(fight.events.map((e) => e.type), ["attack", "laststand", "sweep"]);
  assert.equal(fight.state.sides.wizard.board[0].health, 4);
  assert.equal(fight.state.sides.cowboy.board[1].health, 2);

  const trapKill = applyAction(stage({active: "wizard", own: [troop("wizard-dragon", 1, {health: 2})], foe: [troop("cowboy-sheriff", 1), troop("cowboy-sheriff", 2), null], traps: {cowboy: ["cowboy-bear-trap-1"]}}), {type: "attack", slot: 0, target: 0});
  assert.equal(trapKill.events.some((e) => e.type === "sweep"), false);
  assert.equal(trapKill.state.sides.wizard.board[0], null);
  assert.deepEqual(trapKill.state.sides.cowboy.board.map((t) => t?.health ?? null), [3, 3, null]);

  const trapLive = applyAction(stage({active: "wizard", own: [troop("wizard-dragon", 1, {health: 5})], foe: [troop("cowboy-sheriff", 1), troop("cowboy-sheriff", 2), null], traps: {cowboy: ["cowboy-bear-trap-1"]}}), {type: "attack", slot: 0, target: 0});
  assert.deepEqual(trapLive.events, [
    {type: "trap", side: "cowboy", cardId: "cowboy-bear-trap-1", target: "wizard-dragon-1", left: 3, stopped: false},
    {type: "attack", side: "wizard", cardId: "wizard-dragon-1", target: "cowboy-sheriff-1", covered: false,
      hitBack: 0, baseDamage: 0, targetLeft: 0, attackerLeft: 3},
    {type: "sweep", side: "wizard", cardId: "wizard-dragon-1", count: 1},
  ]);
  assert.equal(trapLive.state.sides.wizard.board[0].health, 3);
  assert.deepEqual(trapLive.state.sides.cowboy.board.map((t) => t?.health ?? null), [null, 2, null]);

  // Bounty mechanics (22..34)
  const bounty = BOUNTIES[1];
  assert.equal(bounty.id, "graveyard-dragon");
  assert.equal(bounty.boss, "wizard-dragon");
  assert.equal(bounty.entrance, "lands");
  assert.equal(bounty.lands, 4);
  assert.deepEqual(bounty.hunts.map((h) => [h.orbs, h.level, h.base]), [[2, 1, 4], [3, 1, 4], [3, 1.5, 4], [4, 1.5, 4], [4, 2, 4]]);
  assert.deepEqual(bounty.deck, {"wizard-skeleton": 9, "wizard-raven-familiar": 2, "wizard-jack-o-lantern": 2, "wizard-wizard": 2, "wizard-singularity": 1});
  assert.ok(Object.keys(bounty.deck).every((type) => !TYPES[type].keys?.includes("guard")));

  const s = trailClearedSave();
  const d1 = duelFor(s, "hunt:graveyard-dragon");
  assert.equal(d1.lesson, "Wanted: the Graveyard Dragon. It lands on the Wizards' second turn. Get troops out before it does: its fire sweeps your whole line.");
  assert.equal(duelList(s).find((duel) => duel.id === d1.id).name, "The Graveyard Dragon");
  assert.equal(d1.options.first, "cowboy");
  assert.equal(d1.options.baseOrbs.wizard, 4);
  let g = createShowdown(2, d1.options);
  assert.equal(g.sides.wizard.board.every((x) => x === null), true);
  g = applyAction(g, {type: "end"}).state; // turn 2 wizard
  assert.equal(g.sides.wizard.board.every((x) => x === null), true);
  g = applyAction(g, {type: "end"}).state; // turn 3 cowboy
  assert.equal(g.sides.wizard.board.some(Boolean), false);

  // Full board defers arrival until later turn
  const blocked = structuredClone(g);
  blocked.sides.wizard.board = [troop("wizard-skeleton", 1), troop("wizard-skeleton", 2, {health: 1}), troop("wizard-skeleton", 3)];
  blocked.sides.cowboy.board = [troop("cowboy-sheriff", 1), null, null];
  const deferred = applyAction(blocked, {type: "end"}).state;
  assert.deepEqual(deferred.arrivals, blocked.arrivals);
  assert.deepEqual(deferred.sides.wizard.board, blocked.sides.wizard.board);
  const turn5 = applyAction(deferred, {type: "end"}).state;
  const opened = applyAction(turn5, {type: "attack", slot: 0, target: 1}).state;
  const retry = applyAction(opened, {type: "end"}).state;
  assert.equal(retry.turn, 6);
  assert.equal(retry.sides.wizard.board[1].cardId, "wizard-dragon-0");
  assert.deepEqual(retry.arrivals, []);

  // Leave hand space so the normal turn draw can resolve after the landing.
  g.sides.wizard.discard.push(g.sides.wizard.hand.pop());
  const landed = applyAction(g, {type: "end"}); // turn 4 wizard
  assert.equal(landed.state.sides.wizard.board[0].cardId, "wizard-dragon-0");
  assert.equal(landed.state.sides.wizard.board[0].health, 2);
  assert.equal(canAttack(landed.state, landed.state.sides.wizard.board[0]), false);
  assert.deepEqual(landed.events, [
    {type: "turn", side: "wizard", turn: 4},
    {type: "summon", side: "wizard", cardId: "wizard-dragon-0"},
    {type: "draw", side: "wizard"},
  ]);
  const regularDraw = applyAction({...g, arrivals: []}, {type: "end"}).state.sides.wizard;
  assert.deepEqual(landed.state.sides.wizard.hand, regularDraw.hand);
  assert.deepEqual(landed.state.sides.wizard.deck, regularDraw.deck);
  assert.equal(landed.state.summonUsed, false);
  assert.equal(landed.state.castUsed, false);
  assert.equal(landed.state.setUsed, false);
  assert.equal(presentEvent(landed.events.find((e) => e.type === "summon")), "The Wizards' Dragon arrived.");
  landed.state.sides.wizard.hand = ["wizard-skeleton-1", "wizard-wizard-1"];
  assert.deepEqual(legalActions(landed.state).filter((a) => a.type === "summon"), [
    {type: "summon", cardId: "wizard-skeleton-1", tributes: []},
    {type: "summon", cardId: "wizard-wizard-1", tributes: [0]},
  ]);

  // Next Wizard turn: landed boss acts as ordinary Dragon with Sweep
  const wizNext = applyAction(applyAction(landed.state, {type: "end"}).state, {type: "end"}).state;
  assert.equal(canAttack(wizNext, wizNext.sides.wizard.board[0]), true);
  assert.equal(applyAction(wizNext, {type: "cover", slot: 0}).state.sides.wizard.board[0].cover, true);
  wizNext.sides.wizard.hand = ["wizard-wizard-1"];
  const paid = applyAction(wizNext, {type: "summon", cardId: "wizard-wizard-1", tributes: [0]});
  assert.ok(paid.state.sides.wizard.discard.includes("wizard-dragon-0"));
  wizNext.sides.cowboy.board = [troop("cowboy-sheriff", 1), troop("cowboy-sheriff", 2), null];
  const attack = applyAction(wizNext, {type: "attack", slot: 0, target: 0});
  assert.equal(attack.events.find((e) => e.type === "sweep")?.cardId, "wizard-dragon-0");
  assert.equal(attack.state.sides.cowboy.board[1].health, 2);

  let prog = s;
  for (let i = 1; i <= 5; i += 1) {
    const hunt = duelFor(prog, "hunt:graveyard-dragon");
    assert.equal(hunt.name, `The Graveyard Dragon, hunt ${i} of 5`);
    assert.equal(hunt.level, [1, 1, 1.5, 1.5, 2][i - 1]);
    assert.equal(hunt.options.arrivals.wizard[0].health, [2, 3, 3, 4, 4][i - 1]);
    const win = settle(prog, "hunt:graveyard-dragon", true);
    assert.equal(win.earned.captured, i === 5 ? "cowboy-captured-dragon" : null);
    prog = win.save;
    if (prog.offer) prog = choose(prog, prog.offer[0]);
    assert.equal(prog.hunts["graveyard-dragon"], i);
  }
  assert.equal(prog.collection["cowboy-captured-dragon"], 1);
});

// ---------------------------------------------------------------- Remaining Cowboy & Wizard card clauses

test("CARD-COWBOY-BEAR-TRAP-01 CARD-COWBOY-BEAR-TRAP-02 CARD-COWBOY-BEAR-TRAP-03 CARD-COWBOY-BEAR-TRAP-04 CARD-COWBOY-BEAR-TRAP-12 CARD-COWBOY-BEAR-TRAP-13 CARD-COWBOY-BEAR-TRAP-15 CARD-COWBOY-BEAR-TRAP-16 CARD-COWBOY-BEAR-TRAP-17: Bear Trap catalog, set gates, Last Stand/Ride interactions, and campaign rules", () => {
  assert.deepEqual(TYPES["cowboy-bear-trap"], {
    side: "cowboy", name: "Bear Trap", rarity: "uncommon", kind: "trap", effect: "snare", fresh: true,
  });
  assert.equal(DECKS.cowboy["cowboy-bear-trap"], 1);

  const open = stage({hand: ["cowboy-bear-trap-1", "cowboy-bear-trap-2"]});
  assert.deepEqual(legalActions(open).filter((a) => a.type === "set"), [{type: "set", cardId: "cowboy-bear-trap-1"}]);
  const afterSet = applyAction(open, {type: "set", cardId: "cowboy-bear-trap-1"}).state;
  assert.equal(legalActions(afterSet).some((a) => a.type === "set"), false);
  const twoDown = stage({hand: ["cowboy-bear-trap-3"], traps: {cowboy: ["cowboy-bear-trap-1", "cowboy-bear-trap-2"]}});
  assert.equal(legalActions(twoDown).some((a) => a.type === "set"), false);

  const trapJack = applyAction(stage({active: "wizard", own: [troop("wizard-jack-o-lantern", 1)], foe: [troop("cowboy-sheriff", 1)], traps: {cowboy: ["cowboy-bear-trap-1"]}}), {type: "attack", slot: 0, target: 0});
  assert.equal(trapJack.state.sides.wizard.board[0], null);
  assert.equal(trapJack.events.some((e) => e.type === "laststand"), false);

  const trapRide = applyAction(stage({active: "wizard", own: [troop("wizard-headless-horseman", 1, {health: 3})], foe: [troop("cowboy-sheriff", 1)], traps: {cowboy: ["cowboy-bear-trap-1"]}, bases: {cowboy: 5}}), {type: "attack", slot: 0, target: "base"});
  assert.equal(trapRide.state.sides.wizard.board[0].health, 1);
  assert.equal(trapRide.state.sides.cowboy.base, 4);

  let s3 = newSave();
  for (let i = 0; i < 3; i += 1) { s3 = settle(s3, "trail", true).save; if (s3.offer) s3 = choose(s3, s3.offer[0]); }
  const beforeDe = s3.deck["cowboy-deadeye"];
  const s4 = settle(s3, "trail", true).save;
  assert.equal(s4.collection["cowboy-bear-trap"], 1);
  assert.equal(s4.deck["cowboy-bear-trap"], 1);
  assert.equal(s4.deck["cowboy-deadeye"], beforeDe - 1);
  assertCopyCap(s4, "cowboy-bear-trap", 3, "Uncommon");
});

test("CARD-COWBOY-LASSO-01 CARD-COWBOY-LASSO-02 CARD-COWBOY-LASSO-03 CARD-COWBOY-LASSO-09 CARD-COWBOY-LASSO-10 CARD-COWBOY-LASSO-11 CARD-COWBOY-LASSO-12 CARD-COWBOY-LASSO-15 CARD-COWBOY-LASSO-16 CARD-COWBOY-LASSO-17: Lasso catalog, targeting, stunned hit-back & Guard, turn sequencing, and campaign rules", () => {
  assert.deepEqual(TYPES["cowboy-lasso"], {
    side: "cowboy", name: "Lasso", kind: "spell", stars: undefined, attack: undefined, health: undefined,
    bounty: false, keys: [], rarity: "uncommon", effect: "tie",
  });
  assert.equal(DECKS.cowboy["cowboy-lasso"], 1);
  assert.equal(legalActions(stage({foe: [], hand: ["cowboy-lasso-1"]})).some((a) => a.type === "spell"), false);

  const mixed = stage({
    own: [troop("cowboy-sheriff", 1)],
    foe: [troop("wizard-wizard", 1), troop("wizard-lantern-wraith", 2), troop("wizard-skeleton", 3, {stunned: true})],
    hand: ["cowboy-lasso-1", "cowboy-deadeye-1", "cowboy-six-shooter-1", "cowboy-sheriffs-office-1", "cowboy-billy-1"],
  });
  assert.deepEqual(legalActions(mixed).filter((a) => a.type === "spell" && a.cardId === "cowboy-lasso-1"), [{type: "spell", cardId: "cowboy-lasso-1", target: 0}]);
  const afterCast = applyAction(mixed, {type: "spell", cardId: "cowboy-lasso-1", target: 0}).state;
  assert.equal(legalActions(afterCast).some((a) => a.type === "spell" || a.type === "gear" || a.type === "location"), false);
  assert.equal(legalActions(afterCast).some((a) => a.type === "summon"), true);

  // 09: Stunned troop outside cover hits back as usual
  const hitBack = applyAction(stage({own: [troop("cowboy-sheriff", 1, {health: 3})], foe: [troop("wizard-wizard", 1, {health: 4, stunned: true, cover: false})]}), {type: "attack", slot: 0, target: 0});
  assert.equal(hitBack.state.sides.cowboy.board[0].health, 1);
  assert.equal(hitBack.state.sides.wizard.board[0].health, 3);

  // 10: Stunned Bone Wall still enforces Guard
  const guardWall = stage({own: [troop("cowboy-sheriff", 1)], foe: [troop("wizard-bone-wall", 1, {stunned: true}), troop("wizard-wizard", 2), null]});
  assert.deepEqual(legalActions(guardWall).filter((a) => a.type === "attack").map((a) => a.target), [0]);

  let s2 = newSave();
  for (let i = 0; i < 2; i += 1) { s2 = settle(s2, "trail", true).save; if (s2.offer) s2 = choose(s2, s2.offer[0]); }
  const beforeDe = s2.deck["cowboy-deadeye"];
  const s3 = settle(s2, "trail", true).save;
  assert.equal(s3.collection["cowboy-lasso"], 1);
  assert.equal(s3.deck["cowboy-lasso"], 1);
  assert.equal(s3.deck["cowboy-deadeye"], beforeDe - 1);
  assertCopyCap(s3, "cowboy-lasso", 3, "Uncommon");
});

test("CARD-COWBOY-OUTRIDER-01 CARD-COWBOY-OUTRIDER-02 CARD-COWBOY-OUTRIDER-03 CARD-COWBOY-OUTRIDER-11 CARD-COWBOY-OUTRIDER-15 CARD-COWBOY-OUTRIDER-16 CARD-COWBOY-OUTRIDER-17: Outrider catalog, summon, Hex ride-past cancellation, and campaign rules", () => {
  assert.deepEqual(TYPES["cowboy-outrider"], {
    side: "cowboy", name: "Outrider", kind: "troop", stars: 3, attack: 1, health: 3,
    bounty: false, keys: ["ride"], rarity: "common", tag: "Lawman",
  });
  assert.equal(DECKS.cowboy["cowboy-outrider"], 2);

  const sumSt = stage({hand: ["cowboy-outrider-1"]});
  assert.deepEqual(legalActions(sumSt).filter((a) => a.type === "summon"), [{type: "summon", cardId: "cowboy-outrider-1", tributes: []}]);
  const arr = applyAction(sumSt, {type: "summon", cardId: "cowboy-outrider-1", tributes: []}).state;
  assert.equal(canAttack(arr, arr.sides.cowboy.board[0]), false);

  const hexRide = applyAction(stage({own: [troop("cowboy-outrider", 1)], foe: [troop("wizard-skeleton", 1)], traps: {wizard: ["wizard-hex-1"]}, bases: {wizard: 5}}), {type: "attack", slot: 0, target: "base"});
  assert.equal(hexRide.state.sides.wizard.base, 5);
  assert.equal(hexRide.state.sides.cowboy.board[0].attacked, true);
  assert.equal(canAttack(hexRide.state, hexRide.state.sides.cowboy.board[0]), false);

  let s1 = settle(newSave(), "trail", true).save;
  if (s1.offer) s1 = choose(s1, s1.offer[0]);
  const beforeSh = s1.deck["cowboy-sheriff"];
  const s2 = settle(s1, "trail", true).save;
  assert.equal(s2.collection["cowboy-outrider"], 2);
  assert.equal(s2.deck["cowboy-outrider"], 2);
  assert.equal(s2.deck["cowboy-sheriff"], beforeSh - 2);
  assertCopyCap(s2, "cowboy-outrider", 4, "Common");
});

// Replay the gallery's public starting board against the rules. These examples
// neither draw cards nor spring traps, so their hidden decks do not affect combat.
function replayGallery(example, action, hand = []) {
  const {active, turn, sides} = example.before;
  const enemy = active === "wizard" ? "cowboy" : "wizard";
  const state = stage({active, turn, own: sides[active].board, foe: sides[enemy].board, hand,
    bases: {cowboy: sides.cowboy.base, wizard: sides.wizard.base}});
  const result = applyAction(state, action);
  for (const side of ["cowboy", "wizard"]) {
    assert.deepEqual(result.state.sides[side].board, example.end.sides[side].board);
    assert.equal(result.state.sides[side].base, example.end.sides[side].base);
  }
  return result.events;
}

test("CARD-WIZARD-HELLFIRE-01 CARD-WIZARD-HELLFIRE-02 CARD-WIZARD-HELLFIRE-08 CARD-WIZARD-HELLFIRE-16 CARD-WIZARD-HELLFIRE-17 CARD-WIZARD-HELLFIRE-18: Hellfire catalog, deck counts, graveyards, Ghostly hit, replay grouping, and gallery preview", () => {
  assert.deepEqual(TYPES["wizard-hellfire"], {
    side: "wizard", name: "Hellfire", rarity: "uncommon", kind: "spell", effect: "hellfire", fresh: true,
  });
  assert.equal(EFFECTS.hellfire.target, false);
  assert.equal(CARD_SPECS.some((card) => card.type === "wizard-hellfire"), false);
  assertWizardDecks("wizard-hellfire", {even: 1, "imp-hollow": 2, "dragons-roost": 1, stargazer: 2, coven: 1});

  const st = stage({
    active: "wizard",
    own: [troop("wizard-wizard", 1)],
    foe: [troop("cowboy-captured-wraith", 1, {health: 2}), troop("cowboy-dynamiter", 2, {health: 1}), troop("cowboy-sheriff", 3, {health: 3})],
    hand: ["wizard-hellfire-1"],
  });
  const before = viewFor(st, "wizard");
  const res = applyAction(st, {type: "spell", cardId: "wizard-hellfire-1"});
  assert.deepEqual(res.state.sides.wizard.hand, []);
  assert.deepEqual(res.state.sides.wizard.discard, ["wizard-hellfire-1"]);
  assert.equal(res.state.sides.cowboy.board[0].health, 1);
  // 16: Replay groups all spell events into one hellfire beat after play and before burials
  const beats = presentationBeats([{before, after: viewFor(res.state, "wizard"), events: res.events}]);
  assert.deepEqual(beats.map((b) => b.kind), ["play", "hellfire", "burial", "burial"]);
  assert.deepEqual(beats[1].targets, [0, 1, 2].map((slot) => ({side: "cowboy", slot})));
  assert.deepEqual(beats.slice(2).map((b) => b.cardId).sort(), ["cowboy-dynamiter-2", "wizard-hellfire-1"]);

  // 17 & 18: Card gallery preview
  assert.deepEqual(attackPreviews("wizard-hellfire"), [["cast", "Watch Hellfire"]]);
  const ex = attackExample("wizard-hellfire", "cast");
  assert.deepEqual(ex.before.sides.cowboy.board.map((t) => [t.cardId.replace(/-\d+$/, ""), t.health]), [["cowboy-sheriff", 3], ["cowboy-mounted-billy", 5], ["cowboy-gatling-crew", 4]]);
  assert.deepEqual(ex.end.sides.cowboy.board.map((t) => t.health), [2, 4, 3]);
  assert.deepEqual(ex.trace[0].events, replayGallery(ex, {type: "spell", cardId: "wizard-hellfire-71"}, ["wizard-hellfire-71"]));
});

test("CARD-WIZARD-HEX-01 CARD-WIZARD-HEX-02 CARD-WIZARD-HEX-03 CARD-WIZARD-HEX-04 CARD-WIZARD-HEX-09 CARD-WIZARD-HEX-11 CARD-WIZARD-HEX-13 CARD-WIZARD-HEX-17: Hex catalog, deck counts, set availability, cancelled Sweep/Last Stand, card-play lock, cover non-trigger, and replay beats", () => {
  assert.deepEqual(TYPES["wizard-hex"], {
    side: "wizard", name: "Hex", rarity: "uncommon", kind: "trap", effect: "hex", fresh: true,
  });
  assertWizardDecks("wizard-hex", {even: 1, "hexed-mile": 2, "dragons-roost": 1, stargazer: 2, imp: 1, coven: 1, "lantern-wraith": 1});

  const setSt = stage({active: "wizard", hand: ["wizard-hex-1", "wizard-skeleton-1", "wizard-singularity-1"], foe: [troop("cowboy-sheriff", 1)]});
  assert.deepEqual(legalActions(setSt).filter((a) => a.type === "set"), [{type: "set", cardId: "wizard-hex-1"}]);
  const afterSet = applyAction(setSt, {type: "set", cardId: "wizard-hex-1"}).state;
  assert.equal(legalActions(afterSet).some((a) => a.type === "summon"), true);
  assert.equal(legalActions(afterSet).some((a) => a.type === "spell"), true);

  // 13: Taking cover springs no trap
  const cov = applyAction(stage({own: [troop("cowboy-sheriff", 1)], traps: {wizard: ["wizard-hex-1"]}}), {type: "cover", slot: 0});
  assert.equal(cov.events.some((e) => e.type === "trap"), false);
  assert.equal(cov.state.sides.wizard.traps.length, 1);

  // 09, 11, 17: Cancelled Gatling Crew attack applies no Sweep/hitBack, locks Cowboy card plays, and emits trap -> burial beats
  const atkSt = stage({
    own: [troop("cowboy-gatling-crew", 1, {health: 4})],
    foe: [troop("wizard-wizard", 1, {health: 4}), troop("wizard-jack-o-lantern", 2, {health: 1}), null],
    traps: {wizard: ["wizard-hex-1"]},
    hand: ["cowboy-sheriff-1", "cowboy-deadeye-1", "cowboy-bear-trap-1"],
    bases: {cowboy: 5, wizard: 5},
  });
  const before = viewFor(atkSt, "cowboy");
  const sprung = applyAction(atkSt, {type: "attack", slot: 0, target: 0});
  assert.equal(sprung.state.sides.cowboy.board[0].health, 4);
  assert.equal(sprung.state.sides.wizard.board[0].health, 4);
  assert.equal(sprung.state.sides.wizard.board[1].health, 1);
  assert.equal(sprung.state.sides.cowboy.base, 5);
  assert.equal(sprung.state.sides.wizard.base, 5);
  assert.equal(sprung.events.some((e) => e.type === "sweep" || e.type === "laststand"), false);
  assert.equal(legalActions(sprung.state).some((a) => a.type === "summon" || a.type === "spell" || a.type === "set"), false);

  const beats = presentationBeats([{before, after: viewFor(sprung.state, "cowboy"), events: sprung.events}]);
  assert.deepEqual(beats.map((b) => b.kind), ["trap", "burial"]);
  assert.equal(beats[0].hit.sides.cowboy.board[0].health, 4);
  assert.equal(beats[1].cardId, "wizard-hex-1");
});

test("CARD-WIZARD-SINGULARITY-01 CARD-WIZARD-SINGULARITY-02 CARD-WIZARD-SINGULARITY-03 CARD-WIZARD-SINGULARITY-09 CARD-WIZARD-SINGULARITY-10 CARD-WIZARD-SINGULARITY-11 CARD-WIZARD-SINGULARITY-16 CARD-WIZARD-SINGULARITY-17 CARD-WIZARD-SINGULARITY-18 CARD-WIZARD-SINGULARITY-19 CARD-WIZARD-SINGULARITY-20 CARD-WIZARD-SINGULARITY-21 CARD-WIZARD-SINGULARITY-22: Singularity catalog, sync fields, deck counts, resolution, log, replay beats, and gallery replays", () => {
  assert.deepEqual(TYPES["wizard-singularity"], {
    side: "wizard", name: "Singularity", kind: "spell", stars: undefined, attack: undefined, health: undefined,
    bounty: false, keys: [], rarity: "common", effect: "shot",
  });
  const laneSing = CARD_SPECS.find((s) => s.type === "wizard-singularity");
  const showSing = SHOWDOWN_SPECS.find((s) => s.type === "wizard-singularity");
  assert.equal(laneSing.copies, 2);
  assert.equal(laneSing.relocates, true);
  assert.equal("copies" in showSing, false);
  assert.equal("relocates" in showSing, false);

  assertWizardDecks("wizard-singularity", {even: 1, "bone-fence": 2, "imp-hollow": 2, "hexed-mile": 1,
    "dragons-roost": 1, stargazer: 3, imp: 2, coven: 1, "lantern-wraith": 2, "graveyard-dragon": 1});

  // 09, 10, 11, 16, 17, 18
  const st = stage({
    active: "wizard",
    own: [null, troop("wizard-wizard", 1), null],
    foe: [troop("cowboy-sheriff", 1, {health: 3}), troop("cowboy-billy", 2, {health: 2}), troop("cowboy-dynamiter", 3, {health: 1, gear: [GEAR.cowboy]})],
    hand: ["wizard-singularity-1"],
  });
  const r2 = applyAction(st, {type: "spell", cardId: "wizard-singularity-1", target: 0});
  assert.equal(presentEvent(r2.events[0]), "The Wizards' Singularity hit Sheriff: 2 orbs left.");
  assert.deepEqual(r2.state.sides.cowboy.board.map((t) => [t.cardId, t.health]), [
    ["cowboy-sheriff-1", 2], ["cowboy-billy-2", 2], ["cowboy-dynamiter-3", 1],
  ]);
  assert.deepEqual(r2.state.sides.wizard.board, st.sides.wizard.board);
  assert.deepEqual(r2.state.sides.wizard.hand, []);
  assert.deepEqual(r2.state.sides.wizard.discard, ["wizard-singularity-1"]);
  const r1 = applyAction(st, {type: "spell", cardId: "wizard-singularity-1", target: 1});
  assert.equal(presentEvent(r1.events[0]), "The Wizards' Singularity hit Billy: 1 orb left.");

  const before = viewFor(st, "wizard");
  const r0 = applyAction(st, {type: "spell", cardId: "wizard-singularity-1", target: 2});
  assert.equal(presentEvent(r0.events[0]), "The Wizards' Singularity hit Dynamiter: defeated.");
  assert.ok(r0.state.sides.wizard.discard.includes("wizard-singularity-1"));
  assert.deepEqual(r0.state.sides.cowboy.discard, ["cowboy-dynamiter-3", GEAR.cowboy]);
  const beats = presentationBeats([{before, after: viewFor(r0.state, "wizard"), events: r0.events}]);
  assert.equal(beats[0].kind, "play");
  assert.equal(beats[1].kind, "vortex");
  assert.deepEqual(beats[1].from, {side: "wizard", slot: 1});
  assert.deepEqual(beats[1].targets, [{side: "cowboy", slot: 2}]);
  const burials = beats.slice(2);
  assert.deepEqual(burials.map((beat) => beat.kind), ["burial", "burial", "burial"]);
  assert.deepEqual(burials.map((beat) => beat.cardId).sort(), ["cowboy-dynamiter-3", GEAR.cowboy, "wizard-singularity-1"]);

  // 19, 20, 21, 22: Gallery replays
  assert.deepEqual(attackPreviews("wizard-singularity"), [["sheriffs", "Against three Sheriffs"], ["graveyard", "Against Skeleton and Dragon"]]);
  const exSh = attackExample("wizard-singularity", "sheriffs");
  assert.equal(exSh.summary, "Each Sheriff loses one orb.");
  assert.deepEqual(exSh.end.sides.cowboy.board.map((t) => [t.cardId.replace(/-\d+$/, ""), t.health]),
    [["cowboy-sheriff", 2], ["cowboy-sheriff", 2], ["cowboy-sheriff", 2]]);

  const exGr = attackExample("wizard-singularity", "graveyard");
  assert.equal(exGr.summary, "Skeleton is defeated. The Graveyard Dragon loses one orb and holds its ground.");
  assert.equal(exGr.before.sides.wizard.board[0].health, 1);
  assert.ok(exGr.end.sides.wizard.discard.includes(exGr.before.sides.wizard.board[0].cardId));
  assert.match(exGr.before.sides.wizard.board[0].cardId, /^wizard-skeleton-/);
  assert.equal(exGr.end.sides.wizard.board[0], null);
  assert.match(exGr.end.sides.wizard.board[1].cardId, /^wizard-dragon-/);
  assert.equal(exGr.end.sides.wizard.board[1].health, 4);
  for (const [example, enemy] of [[exSh, "cowboy"], [exGr, "wizard"]]) {
    const hellfire = "wizard-hellfire-71";
    const realEvents = replayGallery(example, {type: "spell", cardId: hellfire}, [hellfire]);
    const caster = example.before.sides[example.before.active].board[0].cardId;
    assert.deepEqual(example.trace[0].events, realEvents.map((e) => ({...e, cardId: "wizard-singularity-71", caster, areaVortex: true})));
    const area = presentationBeats(example.trace).filter((b) => b.kind === "area-vortex");
    assert.equal(area.length, 1);
    assert.deepEqual(area[0].targets, example.before.sides[enemy].board.flatMap((t, slot) => t ? [{side: enemy, slot}] : []));
  }
});

test("CARD-WIZARD-BONE-WALL-21 CARD-WIZARD-BONE-WALL-22 CARD-WIZARD-DRAGON-20 CARD-WIZARD-DRAGON-21 CARD-WIZARD-HEADLESS-HORSEMAN-13 CARD-WIZARD-HEADLESS-HORSEMAN-14 CARD-WIZARD-IMP-11 CARD-WIZARD-JACK-O-LANTERN-12 CARD-WIZARD-JACK-O-LANTERN-13 CARD-WIZARD-LANTERN-WRAITH-16 CARD-WIZARD-RAVEN-FAMILIAR-10 CARD-WIZARD-SKELETON-10 CARD-WIZARD-WIZARD-22: Wizard Card gallery previews and illustrated replay beats", () => {
  // Bone Wall 21 & 22
  assert.deepEqual(attackPreviews("wizard-bone-wall"), [["guard", "Watch Guard"]]);
  const bwEx = attackExample("wizard-bone-wall", "guard");
  const guardEvents = replayGallery(bwEx, {type: "attack", slot: 0, target: 0});
  assert.match(guardEvents[0].cardId, /^cowboy-sheriff-/);
  assert.match(guardEvents[0].target, /^wizard-bone-wall-/);
  assert.deepEqual(bwEx.trace[0].events, guardEvents);
  assert.equal(bwEx.summary, "Guard makes enemies attack Bone Wall first. " + guardEvents.map((event) => presentEvent(event)).join(" "));

  // Dragon 20 & 21: breath on attack & hit-back, sweep beat across other occupied slots
  const dragAtkSt = stage({active: "wizard", own: [troop("wizard-dragon", 1, {health: 5})], foe: [troop("cowboy-sheriff", 1, {health: 3}), troop("cowboy-billy", 2, {health: 4}), troop("cowboy-dynamiter", 3, {health: 1})]});
  const dragAtk = applyAction(dragAtkSt, {type: "attack", slot: 0, target: 0});
  const dragBeats = presentationBeats([{before: viewFor(dragAtkSt, "wizard"), after: viewFor(dragAtk.state, "wizard"), events: dragAtk.events}]);
  assert.equal(dragBeats[0].kind, "breath");
  const sweepBeats = dragBeats.filter((b) => b.kind === "sweep");
  assert.equal(sweepBeats.length, 1);
  const [swBeat] = sweepBeats;
  assert.deepEqual(swBeat.targets, [{side: "cowboy", slot: 1}, {side: "cowboy", slot: 2}]);
  assert.equal(swBeat.hit.sides.cowboy.board[1].health, 3);
  assert.equal(swBeat.hit.sides.cowboy.board[2].health, 0);

  const dragDefSt = stage({own: [troop("cowboy-sheriff", 1, {health: 3})], foe: [troop("wizard-dragon", 1, {health: 5})]});
  const dragDef = applyAction(dragDefSt, {type: "attack", slot: 0, target: 0});
  const defBeats = presentationBeats([{before: viewFor(dragDefSt, "cowboy"), after: viewFor(dragDef.state, "cowboy"), events: dragDef.events}]);
  assert.equal(defBeats[1].kind, "breath");
  assert.equal(defBeats[1].counter, true);

  // Headless Horseman 13 & 14
  assert.deepEqual(attackPreviews("wizard-headless-horseman"), [["attack", "Watch attack"], ["ride", "Watch Ride"]]);
  const hhRide = attackExample("wizard-headless-horseman", "ride");
  const hhBeats = presentationBeats(hhRide.trace);
  assert.ok(hhRide.before.sides.cowboy.board.some(Boolean));
  assert.deepEqual(hhRide.trace[0].events, replayGallery(hhRide, {type: "attack", slot: 0, target: "base"}));
  assert.equal(hhBeats[0].kind, "ride");
  assert.match(hhBeats[0].cardId, /^wizard-headless-horseman-/);

  // Imp 11, Lantern Wraith 16, Raven Familiar 10, Skeleton 10
  for (const id of ["wizard-imp", "wizard-lantern-wraith", "wizard-raven-familiar", "wizard-skeleton"]) {
    assert.deepEqual(attackPreviews(id), [["attack", "Watch attack"]]);
    const ex = attackExample(id, "attack");
    assert.deepEqual(ex.trace[0].events, replayGallery(ex, {type: "attack", slot: 0, target: 0}));
    assert.equal(ex.trace[0].events[0].cardId.replace(/-\d+$/, ""), id);
    assert.equal(ex.trace[0].events[0].type, "attack");
    assert.match(ex.trace[0].events[0].target, /^cowboy-sheriff-/);
  }

  // Jack-o'-Lantern 12 & 13
  assert.deepEqual(attackPreviews("wizard-jack-o-lantern"), [["attack", "Watch attack"], ["laststand", "Watch Last Stand"]]);
  const jackLs = attackExample("wizard-jack-o-lantern", "laststand");
  const jackBeats = presentationBeats(jackLs.trace);
  const lsBeat = jackBeats.find((b) => b.kind === "laststand");
  assert.deepEqual(jackLs.trace[0].events, replayGallery(jackLs, {type: "attack", slot: 0, target: 0}));
  assert.match(jackLs.trace[0].events[0].cardId, /^cowboy-sheriff-/);
  assert.match(lsBeat.cardId, /^wizard-jack-o-lantern-/);
  assert.equal(lsBeat.hit.sides.cowboy.board[0].health, 2);
  assert.equal(jackLs.end.sides.cowboy.board[0].health, 2);

  // Wizard 22: raise beat moves card from graveyard to board slot with 1 orb
  const raiseSt = stage({active: "wizard", own: [troop("wizard-skeleton", 1)], hand: ["wizard-wizard-1"]});
  const raised = applyAction(raiseSt, {type: "summon", cardId: "wizard-wizard-1", tributes: [0]});
  const raiseBeats = presentationBeats([{before: viewFor(raiseSt, "wizard"), after: viewFor(raised.state, "wizard"), events: raised.events}]);
  const rb = raiseBeats.find((b) => b.kind === "raise");
  assert.equal(rb.cardId, "wizard-skeleton-1");
  assert.deepEqual(rb.from, {side: "wizard", at: "discard", slot: undefined});
  assert.deepEqual(rb.targets, [{side: "wizard", slot: 1}]);
  assert.equal(rb.hit.sides.wizard.board[1].health, 1);
});
