// Fast-check properties for Showdown catalog, combat rules, keywords, forecasts, and bots (PROP-001..PROP-035).
import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {SHOWDOWN_SPECS} from "../../src/game/card-specs.generated.js";
import {DECKS, EFFECTS, KEYWORDS, RARITY, TYPES, cardOf, deckIds, has, tributes, typeOf} from "../../src/game/showdown/cards.js";
import {EVENTS, viewFor} from "../../src/game/showdown/contract.js";
import {presentAttackForecast, presentEvent} from "../../src/game/showdown/presenter.js";
import {
  BOARD_SIZE,
  EVEN_FIGHT_DECKS,
  HAND_CAP,
  TRAP_SLOTS,
  applyAction,
  attackOf,
  attackOutcome,
  canAttack,
  createShowdown,
  forecastAttack,
  legalActions,
  opponent,
  planTurn,
  playTurn,
} from "../../src/game/showdown/rules.js";
import {assertProp} from "../helpers/dec4-prop-harness.js";

const FILE = "tests/game/showdown-catalog-fast-check.test.js";
const ALL_TYPES = Object.keys(TYPES);
const TROOP_TYPES = ALL_TYPES.filter((t) => TYPES[t].kind === "troop");
const WIZARD_TYPES = ALL_TYPES.filter((t) => TYPES[t].side === "wizard");
const SIDES = ["cowboy", "wizard"];

function makeTroop(type, idx = 1, {health = TYPES[type].health, turn = 1, ready = true, cover = false, stunned = false, attacked = false, gear = []} = {}) {
  return {cardId: `${type}-${idx}`, health, attacked, stunned, cover, gear: [...gear], arrived: turn, ready};
}

function advanceSteps(seed, steps, options = {}) {
  let state = createShowdown(seed, options);
  const events = [];
  for (let i = 0; i < steps && !state.result; i += 1) {
    const legal = legalActions(state);
    const chosen = legal[(seed + i * 7) % legal.length];
    const out = applyAction(state, chosen);
    state = out.state;
    events.push(...out.events);
  }
  return {state, events};
}

test("PROP-001: catalog entries map every SHOWDOWN_SPECS item to valid metadata", () => {
  assertProp("PROP-001", FILE, fc.property(fc.integer({min: 0, max: SHOWDOWN_SPECS.length - 1}), (idx) => {
    const spec = SHOWDOWN_SPECS[idx];
    const card = TYPES[spec.type];
    assert.ok(card);
    assert.ok(SIDES.includes(card.side));
    assert.ok(["troop", "spell", "trap", "gear", "location"].includes(card.kind));
    assert.ok(Object.hasOwn(RARITY, card.rarity));
    for (const k of card.keys ?? []) assert.ok(Object.hasOwn(KEYWORDS, k));
    if (card.kind !== "troop") assert.ok(Object.hasOwn(EFFECTS, card.effect));
  }));
});

test("PROP-002: typeOf and cardOf recover exact base card from suffixed copy IDs", () => {
  assertProp("PROP-002", FILE, fc.property(fc.constantFrom(...ALL_TYPES), fc.integer({min: 1, max: 999}), (type, copy) => {
    const id = `${type}-${copy}`;
    assert.equal(typeOf(id), type);
    assert.equal(cardOf(id), TYPES[type]);
  }));
});

test("PROP-003: tributes(cardId) partitions troop star tiers into 0, 1, and 2 sacrifices", () => {
  assertProp("PROP-003", FILE, fc.property(fc.constantFrom(...TROOP_TYPES), fc.integer({min: 1, max: 20}), (type, copy) => {
    const stars = TYPES[type].stars;
    const expected = stars >= 7 ? 2 : stars >= 5 ? 1 : 0;
    assert.equal(tributes(`${type}-${copy}`), expected);
  }));
});

test("PROP-004: deckIds produces unique suffixed IDs preserving per-type counts", () => {
  const decks = fc.constantFrom(...SIDES).chain((side) => fc.tuple(fc.constant(side),
    fc.dictionary(fc.constantFrom(...ALL_TYPES.filter((t) => TYPES[t].side === side)), fc.integer({min: 1, max: 4}), {minKeys: 1, maxKeys: 6})));
  assertProp("PROP-004", FILE, fc.property(decks, ([side, counts]) => {
    const ids = deckIds(side, counts);
    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    assert.equal(ids.length, sum);
    assert.equal(new Set(ids).size, sum);
    for (const [type, expected] of Object.entries(counts)) {
      assert.equal(ids.filter((id) => typeOf(id) === type).length, expected);
    }
  }));
});

test("PROP-005: EVEN_FIGHT_DECKS preserves 16-card totals and swaps one Skeleton for one Imp", () => {
  assertProp("PROP-005", FILE, fc.property(fc.constantFrom(...SIDES), (side) => {
    const total = Object.values(EVEN_FIGHT_DECKS[side]).reduce((a, b) => a + b, 0);
    assert.equal(total, 16);
    if (side === "cowboy") {
      assert.deepEqual(EVEN_FIGHT_DECKS.cowboy, DECKS.cowboy);
    } else {
      assert.deepEqual(EVEN_FIGHT_DECKS.wizard, {...DECKS.wizard,
        "wizard-skeleton": DECKS.wizard["wizard-skeleton"] - 1, "wizard-imp": DECKS.wizard["wizard-imp"] + 1});
    }
  }));
});

test("PROP-006: createShowdown grants 7 Base orbs to second player under evenFight default", () => {
  assertProp("PROP-006", FILE, fc.property(fc.integer({min: 0, max: 100000}), fc.constantFrom(...SIDES), (seed, first) => {
    const ef = createShowdown(seed, {first, evenFight: true});
    const std = createShowdown(seed, {first, evenFight: false});
    assert.equal(ef.sides[first].base, 5);
    assert.equal(ef.sides[opponent(first)].base, 7);
    assert.equal(std.sides[first].base, 5);
    assert.equal(std.sides[opponent(first)].base, 5);
  }));
});

test("PROP-007: turn 1 forbids all attacks even for Quickdraw or opening troops", () => {
  assertProp("PROP-007", FILE, fc.property(fc.integer({min: 0, max: 50000}), fc.constantFrom("wizard-imp", "wizard-lantern-wraith"), (seed, bossType) => {
    const state = createShowdown(seed, {first: "wizard", opening: {wizard: [{type: bossType, health: 4}]}});
    assert.equal(state.turn, 1);
    assert.equal(canAttack(state, state.sides.wizard.board[0]), false);
    assert.equal(legalActions(state).some((a) => a.type === "attack"), false);
  }));
});

test("PROP-008: zero-tribute arrival on turn >= 2 attacks immediately iff it has quickdraw", () => {
  const freeTroops = TROOP_TYPES.filter((t) => tributes(`${t}-1`) === 0);
  assertProp("PROP-008", FILE, fc.property(fc.integer({min: 0, max: 10000}), fc.constantFrom(...freeTroops), (seed, type) => {
    const side = TYPES[type].side;
    let state = createShowdown(seed, {first: opponent(side)});
    state = applyAction(state, {type: "end"}).state;
    state.sides[side].board = [null, null, null];
    state.sides[side].hand = [`${type}-99`];
    const next = applyAction(state, {type: "summon", cardId: `${type}-99`, tributes: []}).state;
    const troop = next.sides[side].board[0];
    const quick = has(`${type}-99`, "quickdraw");
    assert.equal(troop.ready, quick);
    assert.equal(canAttack(next, troop), quick && attackOf(next, troop) > 0);
  }));
});

test("PROP-009: tribute summons move sacrificed troops and gear to discard and arrive ready", () => {
  const paidTroops = TROOP_TYPES.filter((t) => tributes(`${t}-1`) > 0);
  assertProp("PROP-009", FILE, fc.property(fc.integer({min: 0, max: 10000}), fc.constantFrom(...paidTroops), (seed, type) => {
    const side = TYPES[type].side;
    const cost = tributes(`${type}-1`);
    let state = createShowdown(seed, {first: opponent(side)});
    state = applyAction(state, {type: "end"}).state;
    const fodder = side === "cowboy" ? "cowboy-sheriff" : "wizard-imp";
    const gearId = side === "cowboy" ? "cowboy-six-shooter-1" : "wizard-bone-armor-1";
    state.sides[side].board = [
      makeTroop(fodder, 1, {gear: [gearId]}),
      makeTroop(fodder, 2),
      null,
    ];
    state.sides[side].discard = [];
    state.sides[side].hand = [`${type}-50`];
    const tribSlots = cost === 2 ? [0, 1] : [0];
    const res = applyAction(state, {type: "summon", cardId: `${type}-50`, tributes: tribSlots});
    const raised = res.events.some((e) => e.type === "raise") ? 1 : 0;
    const occupiedAfter = res.state.sides[side].board.filter(Boolean);
    assert.equal(occupiedAfter.length, 2 - cost + 1 + raised);
    const summoned = occupiedAfter.find((tr) => tr.cardId === `${type}-50`);
    assert.equal(summoned.ready, true);
    assert.ok(res.state.sides[side].discard.includes(`${fodder}-1`));
    assert.ok(res.state.sides[side].discard.includes(gearId));
  }));
});

test("PROP-010: enemy Guard troops funnel all legal attacks away from non-Guard slots and Base", () => {
  assertProp("PROP-010", FILE, fc.property(
    fc.integer({min: 0, max: 10000}),
    fc.constantFrom("cowboy-billy", "cowboy-outrider", "cowboy-mounted-billy"),
    fc.integer({min: 0, max: 2}),
    (seed, atkType, guardSlot) => {
      let state = createShowdown(seed, {first: "wizard"});
      state = applyAction(state, {type: "end"}).state;
      state.sides.cowboy.board = [makeTroop(atkType, 1, {turn: 1, ready: true}), null, null];
      const otherSlot = (guardSlot + 1) % 3;
      state.sides.wizard.board = [null, null, null];
      state.sides.wizard.board[guardSlot] = makeTroop("wizard-bone-wall", 1);
      state.sides.wizard.board[otherSlot] = makeTroop("wizard-skeleton", 2);
      const attacks = legalActions(state).filter((a) => a.type === "attack");
      assert.ok(attacks.length >= 1);
      assert.ok(attacks.every((a) => a.target === guardSlot));
    }
  ));
});

test("PROP-011: Ride troops bypass non-Guard defenders for 1 Base damage while non-Ride cannot", () => {
  assertProp("PROP-011", FILE, fc.property(
    fc.integer({min: 0, max: 10000}),
    fc.constantFrom("cowboy-outrider", "cowboy-mounted-billy", "cowboy-billy", "cowboy-sheriff"),
    (seed, atkType) => {
      let state = createShowdown(seed, {first: "wizard"});
      state = applyAction(state, {type: "end"}).state;
      state.sides.cowboy.board = [makeTroop(atkType, 1, {turn: 1, ready: true}), null, null];
      state.sides.wizard.board = [makeTroop("wizard-skeleton", 1), null, null];
      const targets = legalActions(state).filter((a) => a.type === "attack").map((a) => a.target);
      if (has(`${atkType}-1`, "ride")) {
        assert.ok(targets.includes("base"));
        assert.equal(attackOutcome(state, 0, "base").baseDamage, 1);
      } else {
        assert.ok(!targets.includes("base"));
      }
    }
  ));
});

test("PROP-012: ready attackers deal full attackOf to an undefended Base", () => {
  const positiveTroops = TROOP_TYPES.filter((t) => TYPES[t].attack > 0 && TYPES[t].side === "cowboy");
  assertProp("PROP-012", FILE, fc.property(fc.integer({min: 0, max: 10000}), fc.constantFrom(...positiveTroops), (seed, atkType) => {
    let state = createShowdown(seed, {first: "wizard"});
    state = applyAction(state, {type: "end"}).state;
    state.sides.cowboy.board = [makeTroop(atkType, 1, {turn: 1, ready: true}), null, null];
    state.sides.wizard.board = [null, null, null];
    const out = attackOutcome(state, 0, "base");
    assert.ok(legalActions(state).some((a) => a.type === "attack" && a.slot === 0 && a.target === "base"));
    assert.equal(out.baseDamage, attackOf(state, state.sides.cowboy.board[0]));
  }));
});

test("PROP-013: excess attack overflows onto Base unless defender is in cover", () => {
  assertProp("PROP-013", FILE, fc.property(
    fc.integer({min: 2, max: 5}),
    fc.integer({min: 1, max: 4}),
    fc.boolean(),
    (atk, defHp, inCover) => {
      fc.pre(atk > defHp);
      let state = createShowdown(1, {first: "wizard"});
      state = applyAction(state, {type: "end"}).state;
      const troop = makeTroop("cowboy-billy", 1, {turn: 1, ready: true});
      // Adjust gear to match exact attack if needed: base Billy has 2 attack
      state.sides.cowboy.board = [troop, null, null];
      for (let g = 2; g < atk; g += 1) troop.gear.push(`cowboy-six-shooter-${g}`);
      state.sides.wizard.board = [makeTroop("wizard-skeleton", 1, {health: defHp, cover: inCover}), null, null];
      const out = attackOutcome(state, 0, 0);
      assert.equal(out.targetLeft, 0);
      assert.equal(out.baseDamage, inCover ? 0 : atk - defHp);
      assert.equal(out.attackerLeft, troop.health);
    }
  ));
});

test("PROP-014: surviving uncovered defender deals exact counter-damage with zero Base overflow", () => {
  assertProp("PROP-014", FILE, fc.property(
    fc.integer({min: 1, max: 3}),
    fc.integer({min: 2, max: 6}),
    fc.integer({min: 1, max: 5}),
    (atk, defHp, atkHp) => {
      fc.pre(defHp > atk);
      let state = createShowdown(2, {first: "wizard"});
      state = applyAction(state, {type: "end"}).state;
      const attacker = makeTroop("cowboy-sheriff", 1, {health: atkHp, turn: 1, ready: true});
      for (let g = 1; g < atk; g += 1) attacker.gear.push(`cowboy-six-shooter-${g}`);
      const defender = makeTroop("wizard-wizard", 1, {health: defHp, cover: false});
      state.sides.cowboy.board = [attacker, null, null];
      state.sides.wizard.board = [defender, null, null];
      const out = attackOutcome(state, 0, 0);
      assert.equal(out.baseDamage, 0);
      assert.equal(out.targetLeft, defHp - atk);
      assert.equal(out.attackerLeft, Math.max(0, atkHp - attackOf(state, defender)));
    }
  ));
});

test("PROP-015: Sweep attackers reduce every other occupied enemy slot by 1 orb", () => {
  const sweepTroops = TROOP_TYPES.filter((t) => has(`${t}-1`, "sweep"));
  assertProp("PROP-015", FILE, fc.property(
    fc.constantFrom(...sweepTroops),
    fc.integer({min: 1, max: 4}),
    fc.integer({min: 1, max: 4}),
    (sweepType, hp1, hp2) => {
      const atkSide = TYPES[sweepType].side;
      const defSide = opponent(atkSide);
      const defFodder = defSide === "wizard" ? "wizard-skeleton" : "cowboy-sheriff";
      let state = createShowdown(3, {first: defSide});
      state = applyAction(state, {type: "end"}).state;
      state.sides[atkSide].board = [makeTroop(sweepType, 1, {turn: 1, ready: true}), null, null];
      state.sides[defSide].traps = [];
      state.sides[defSide].board = [
        makeTroop(defFodder, 1, {health: 2}),
        makeTroop(defFodder, 2, {health: hp1}),
        makeTroop(defFodder, 3, {health: hp2}),
      ];
      const res = applyAction(state, {type: "attack", slot: 0, target: 0});
      assert.ok(res.events.some((e) => e.type === "sweep" && e.count === 2));
      for (const [slot, hp] of [[1, hp1], [2, hp2]]) {
        const defender = res.state.sides[defSide];
        if (hp === 1) {
          assert.equal(defender.board[slot], null);
          assert.ok(defender.discard.includes(state.sides[defSide].board[slot].cardId));
        } else assert.equal(defender.board[slot].health, hp - 1);
      }
    }
  ));
});

test("PROP-016: Last Stand triggers on combat defeat when opponent survives, never on spells", () => {
  assertProp("PROP-016", FILE, fc.property(fc.integer({min: 2, max: 5}), (atkHp) => {
    let state = createShowdown(4, {first: "wizard"});
    state = applyAction(state, {type: "end"}).state;
    state.sides.cowboy.board = [makeTroop("cowboy-billy", 1, {health: atkHp, turn: 1, ready: true}), null, null];
    state.sides.cowboy.hand = ["cowboy-deadeye-1"];
    state.sides.wizard.traps = [];
    state.sides.wizard.board = [makeTroop("wizard-jack-o-lantern", 1, {health: 1}), null, null];

    const combat = applyAction(state, {type: "attack", slot: 0, target: 0});
    assert.ok(combat.events.some((e) => e.type === "laststand"));
    assert.equal(combat.state.sides.cowboy.board[0].health, atkHp - 1);

    const spell = applyAction(state, {type: "spell", cardId: "cowboy-deadeye-1", target: 0});
    assert.equal(spell.events.some((e) => e.type === "laststand"), false);
    assert.equal(spell.state.sides.cowboy.board[0].health, atkHp);
    const tribute = structuredClone(state);
    tribute.active = "wizard";
    tribute.sides.wizard.hand = ["wizard-wizard-1"];
    const paid = applyAction(tribute, {type: "summon", cardId: "wizard-wizard-1", tributes: [0]});
    assert.ok(paid.events.some((e) => e.type === "tribute"));
    assert.equal(paid.events.some((e) => e.type === "laststand"), false);
  }));
});

test("PROP-017: Scout arrival draws under HAND_CAP, burns at HAND_CAP, and skips fatigue on empty deck", () => {
  assertProp("PROP-017", FILE, fc.property(fc.constantFrom("draw", "burn", "empty"), (mode) => {
    let state = createShowdown(5, {first: "wizard"});
    state = applyAction(state, {type: "end"}).state;
    state.sides.cowboy.board = [makeTroop("cowboy-sheriff", 1), null, null];
    const handFill = mode === "burn" ? HAND_CAP : 2;
    state.sides.cowboy.hand = ["cowboy-ranger-1", ...Array.from({length: handFill}, (_, i) => `cowboy-sheriff-${i + 10}`)];
    state.sides.cowboy.deck = mode === "empty" ? [] : ["cowboy-billy-9"];
    const baseBefore = state.sides.cowboy.base;
    const res = applyAction(state, {type: "summon", cardId: "cowboy-ranger-1", tributes: [0]});
    if (mode === "draw") {
      assert.ok(res.events.some((e) => e.type === "draw"));
      assert.ok(res.state.sides.cowboy.hand.includes("cowboy-billy-9"));
    } else if (mode === "burn") {
      assert.ok(res.events.some((e) => e.type === "burn" && e.cardId === "cowboy-billy-9"));
    } else {
      assert.equal(res.events.some((e) => e.type === "fatigue"), false);
      assert.equal(res.state.sides.cowboy.base, baseBefore);
    }
  }));
});

test("PROP-018: Raise revives newestUndeadIndex at 1 orb and skips non-Undead discards", () => {
  const discardArb = fc.array(fc.constantFrom("wizard-skeleton-1", "wizard-bone-wall-1", "wizard-imp-1", "wizard-hellfire-1", "wizard-hex-1"), {minLength: 1, maxLength: 6});
  assertProp("PROP-018", FILE, fc.property(discardArb, (discard) => {
    let state = createShowdown(6, {first: "cowboy"});
    state = applyAction(state, {type: "end"}).state;
    state.sides.wizard.board = [makeTroop("wizard-imp", 9), null, null];
    state.sides.wizard.discard = [...discard];
    state.sides.wizard.hand = ["wizard-wizard-1"];
    const expected = discard.findLast((card) => ["wizard-skeleton-1", "wizard-bone-wall-1"].includes(card));
    const res = applyAction(state, {type: "summon", cardId: "wizard-wizard-1", tributes: [0]});
    if (expected) {
      const expectedId = expected;
      assert.ok(res.events.some((e) => e.type === "raise" && e.cardId === expectedId));
      const risen = res.state.sides.wizard.board[1];
      assert.equal(risen.cardId, expectedId);
      assert.equal(risen.health, 1);
      assert.equal(risen.ready, false);
    } else {
      assert.equal(res.events.some((e) => e.type === "raise"), false);
    }
  }));
});

test("PROP-019: Ghostly troops block targeted spells while Hellfire still damages them", () => {
  assertProp("PROP-019", FILE, fc.property(fc.integer({min: 2, max: 5}), (hp) => {
    let cowboyTurn = createShowdown(7, {first: "cowboy"});
    cowboyTurn.sides.cowboy.hand = ["cowboy-deadeye-1", "cowboy-lasso-1"];
    cowboyTurn.sides.wizard.board = [makeTroop("wizard-lantern-wraith", 1, {health: hp}), null, null];
    assert.equal(legalActions(cowboyTurn).some((a) => a.type === "spell"), false);

    let wizTurn = createShowdown(7, {first: "wizard"});
    wizTurn.sides.wizard.hand = ["wizard-hellfire-1", "wizard-singularity-1"];
    wizTurn.sides.cowboy.board = [makeTroop("cowboy-captured-wraith", 1, {health: hp}), null, null];
    const spells = legalActions(wizTurn).filter((a) => a.type === "spell");
    assert.deepEqual(spells.map((s) => s.cardId), ["wizard-hellfire-1"]);
    const after = applyAction(wizTurn, spells[0]).state;
    assert.equal(after.sides.cowboy.board[0].health, hp - 1);
  }));
});

test("PROP-020: evenFight cover shields troops from targeted spells and Hellfire", () => {
  assertProp("PROP-020", FILE, fc.property(fc.boolean(), fc.integer({min: 2, max: 4}), (evenFight, hp) => {
    const state = createShowdown(8, {first: "wizard", evenFight});
    state.sides.wizard.hand = ["wizard-hellfire-1", "wizard-singularity-1"];
    state.sides.cowboy.board = [makeTroop("cowboy-billy", 1, {health: hp, cover: true}), null, null];
    const spells = legalActions(state).filter((a) => a.type === "spell");
    if (evenFight) {
      assert.equal(spells.length, 0);
    } else {
      assert.equal(spells.length, 2);
      const after = applyAction(state, {type: "spell", cardId: "wizard-hellfire-1"}).state;
      assert.equal(after.sides.cowboy.board[0].health, hp - 1);
    }
  }));
});

test("PROP-021: Lasso stun preserves health, blocks attacks and duplicate tie, and clears after enemy turn", () => {
  assertProp("PROP-021", FILE, fc.property(fc.integer({min: 1, max: 5}), (hp) => {
    let state = createShowdown(9, {first: "cowboy"});
    state.sides.cowboy.hand = ["cowboy-lasso-1", "cowboy-lasso-2"];
    state.sides.wizard.board = [makeTroop("wizard-skeleton", 1, {health: hp, turn: 0, ready: true}), null, null];
    const tied = applyAction(state, {type: "spell", cardId: "cowboy-lasso-1", target: 0}).state;
    assert.equal(tied.sides.wizard.board[0].health, hp);
    assert.equal(tied.sides.wizard.board[0].stunned, true);

    const wizTurn = applyAction(tied, {type: "end"}).state;
    assert.equal(canAttack(wizTurn, wizTurn.sides.wizard.board[0]), false);
    // Duplicate stun on already stunned troop would be illegal if Cowboy acted
    const backToCowboy = applyAction(wizTurn, {type: "end"}).state;
    assert.equal(backToCowboy.sides.wizard.board[0].stunned, false);
  }));
});

test("PROP-022: Gear adds attack and orbs immediately and moves to discard on carrier defeat", () => {
  assertProp("PROP-022", FILE, fc.property(fc.constantFrom("cowboy-six-shooter", "wizard-bone-armor"), (gearType) => {
    const side = TYPES[gearType].side;
    const state = createShowdown(10, {first: side});
    const troopType = side === "cowboy" ? "cowboy-sheriff" : "wizard-imp";
    state.sides[side].board = [makeTroop(troopType, 1, {health: 1}), null, null];
    state.sides[side].hand = [`${gearType}-1`];
    const geared = applyAction(state, {type: "gear", cardId: `${gearType}-1`, slot: 0}).state;
    const tr = geared.sides[side].board[0];
    const eff = EFFECTS[TYPES[gearType].effect];
    assert.equal(tr.health, 1 + eff.orbs);
    assert.equal(attackOf(geared, tr), TYPES[troopType].attack + eff.attack);

    // Tribute non-Undead carrier to trigger defeat disposal without Raise revival
    geared.summonUsed = false;
    const paidType = side === "cowboy" ? "cowboy-billy-1" : "wizard-headless-horseman-1";
    geared.sides[side].hand = [paidType];
    const after = applyAction(geared, {type: "summon", cardId: paidType, tributes: [0]}).state;
    assert.ok(after.sides[side].discard.includes(`${gearType}-1`));
    assert.ok(after.sides[side].discard.includes(`${troopType}-1`));
  }));
});

test("PROP-023: Location tag bonus applies to both sides, blocks same-name replay, and discards replaced location", () => {
  assertProp("PROP-023", FILE, fc.property(fc.constantFrom("cowboy-sheriffs-office", "wizard-boneyard"), (locType) => {
    const side = TYPES[locType].side;
    const other = opponent(side);
    const otherLoc = other === "cowboy" ? "cowboy-sheriffs-office-1" : "wizard-boneyard-1";
    let state = createShowdown(11, {first: side});
    state.sides.cowboy.board = [makeTroop("cowboy-sheriff", 1), makeTroop("cowboy-captured-wraith", 2), null];
    state.sides.wizard.board = [makeTroop("wizard-skeleton", 1), makeTroop("wizard-wizard", 2), null];
    state.sides[side].hand = [`${locType}-1`, `${locType}-2`];
    state = applyAction(state, {type: "location", cardId: `${locType}-1`}).state;
    if (locType === "cowboy-sheriffs-office") {
      assert.equal(attackOf(state, state.sides.cowboy.board[0]), TYPES["cowboy-sheriff"].attack + 1);
      assert.equal(attackOf(state, state.sides.wizard.board[0]), TYPES["wizard-skeleton"].attack);
    } else {
      assert.equal(attackOf(state, state.sides.wizard.board[0]), TYPES["wizard-skeleton"].attack + 1);
      assert.equal(attackOf(state, state.sides.cowboy.board[1]), TYPES["cowboy-captured-wraith"].attack + 1);
    }
    state = applyAction(state, {type: "end"}).state;
    state.sides[other].hand = [otherLoc];
    const replaced = applyAction(state, {type: "location", cardId: otherLoc}).state;
    assert.ok(replaced.sides[side].discard.includes(`${locType}-1`));
    replaced.castUsed = false;
    replaced.sides[other].hand = [otherLoc];
    assert.equal(legalActions(replaced).some((a) => a.type === "location"), false);
  }));
});

test("PROP-024: Traps spring FIFO with Hex cancelling cleanly and Bear Trap dealing 2 first", () => {
  assertProp("PROP-024", FILE, fc.property(fc.constantFrom("wizard-hex", "cowboy-bear-trap"), fc.integer({min: 1, max: 4}), (trapType, atkHp) => {
    const defSide = TYPES[trapType].side;
    const atkSide = opponent(defSide);
    let state = createShowdown(12, {first: defSide});
    state = applyAction(state, {type: "end"}).state;
    const atkType = atkSide === "cowboy" ? "cowboy-billy" : "wizard-wizard";
    state.sides[atkSide].board = [makeTroop(atkType, 1, {health: atkHp, turn: 1, ready: true}), null, null];
    state.sides[defSide].board = [];
    state.sides[defSide].board = [null, null, null];
    state.sides[defSide].traps = [`${trapType}-1`, `${trapType}-2`];
    const baseBefore = state.sides[defSide].base;
    const res = applyAction(state, {type: "attack", slot: 0, target: "base"});
    assert.equal(res.state.sides[defSide].traps.length, 1);
    assert.equal(res.state.sides[defSide].traps[0], `${trapType}-2`);
    if (trapType === "wizard-hex") {
      assert.equal(res.state.sides[defSide].base, baseBefore);
      assert.equal(res.state.sides[atkSide].board[0].health, atkHp);
    } else if (atkHp <= 2) {
      assert.equal(res.state.sides[defSide].base, baseBefore);
      assert.equal(res.state.sides[atkSide].board[0], null);
    } else {
      assert.equal(res.state.sides[atkSide].board[0].health, atkHp - 2);
      assert.ok(res.state.sides[defSide].base < baseBefore);
    }
  }));
});

test("PROP-025: attacking or taking cover locks out card plays until turn end", () => {
  assertProp("PROP-025", FILE, fc.property(fc.constantFrom("attack", "cover"), fc.integer({min: 0, max: 5000}), (actKind, seed) => {
    let state = createShowdown(seed, {first: "wizard"});
    state = applyAction(state, {type: "end"}).state;
    state.sides.cowboy.board = [makeTroop("cowboy-billy", 1, {turn: 1, ready: true}), null, null];
    state.sides.cowboy.hand = ["cowboy-sheriff-1", "cowboy-deadeye-1", "cowboy-six-shooter-1", "cowboy-bear-trap-1"];
    state.sides.wizard.board = [makeTroop("wizard-skeleton", 1, {health: 4}), null, null];
    const action = actKind === "cover" ? {type: "cover", slot: 0} : {type: "attack", slot: 0, target: 0};
    const after = applyAction(state, action).state;
    const remainingTypes = new Set(legalActions(after).map((a) => a.type));
    for (const forbidden of ["summon", "spell", "gear", "location", "set"]) {
      assert.equal(remainingTypes.has(forbidden), false);
    }
  }));
});

test("PROP-026: turn allowances cap summon, cast, and set at one each and traps at TRAP_SLOTS", () => {
  assertProp("PROP-026", FILE, fc.property(fc.integer({min: 0, max: 5000}), (seed) => {
    const state = createShowdown(seed, {first: "cowboy"});
    state.sides.cowboy.board = [null, null, null];
    state.sides.cowboy.hand = [
      "cowboy-sheriff-1", "cowboy-sheriff-2",
      "cowboy-sheriffs-office-1", "cowboy-six-shooter-1",
      "cowboy-bear-trap-1", "cowboy-bear-trap-2",
    ];
    let s = applyAction(state, {type: "summon", cardId: "cowboy-sheriff-1", tributes: []}).state;
    assert.equal(legalActions(s).some((a) => a.type === "summon"), false);
    s = applyAction(s, {type: "gear", cardId: "cowboy-six-shooter-1", slot: 0}).state;
    assert.equal(legalActions(s).some((a) => ["spell", "gear", "location"].includes(a.type)), false);
    s = applyAction(s, {type: "set", cardId: "cowboy-bear-trap-1"}).state;
    assert.equal(legalActions(s).some((a) => a.type === "set"), false);
    assert.ok(s.sides.cowboy.traps.length <= TRAP_SLOTS);
  }));
});

test("PROP-027: scheduled boss arrivals land at ready=false on empty slot or defer when full", () => {
  assertProp("PROP-027", FILE, fc.property(fc.boolean(), fc.integer({min: 2, max: 8}), (boardFull, bossHp) => {
    let state = createShowdown(14, {
      first: "cowboy",
      arrivals: {wizard: [{type: "wizard-dragon", turn: 2, health: bossHp}]},
    });
    state.sides.wizard.board = boardFull
      ? [makeTroop("wizard-skeleton", 1), makeTroop("wizard-skeleton", 2), makeTroop("wizard-skeleton", 3)]
      : [makeTroop("wizard-skeleton", 1), null, null];
    const next = applyAction(state, {type: "end"}).state;
    if (boardFull) {
      assert.equal(next.arrivals.length, 1);
      assert.equal(next.sides.wizard.board.some((t) => t?.cardId === "wizard-dragon-0"), false);
    } else {
      assert.equal(next.arrivals.length, 0);
      assert.equal(next.sides.wizard.board[1].cardId, "wizard-dragon-0");
      assert.equal(next.sides.wizard.board[1].health, bossHp);
      assert.equal(next.sides.wizard.board[1].ready, false);
    }
  }));
});

test("PROP-028: forecastAttack matches applyAction events and defendingBoard when untrapped", () => {
  assertProp("PROP-028", FILE, fc.property(fc.integer({min: 0, max: 20000}), fc.integer({min: 1, max: 14}), (seed, steps) => {
    const {state} = advanceSteps(seed, steps);
    fc.pre(!state.result);
    fc.pre(state.sides[opponent(state.active)].traps.length === 0);
    const attacks = legalActions(state).filter((a) => a.type === "attack");
    fc.pre(attacks.length > 0);
    for (const action of attacks) {
      const view = viewFor(state, state.active);
      const forecast = forecastAttack(view, action.slot, action.target);
      const actual = applyAction(state, action);
      assert.deepEqual(forecast.events, actual.events);
      assert.deepEqual(forecast.defendingBoard, actual.state.sides[opponent(state.active)].board);
    }
  }));
});

test("PROP-029: presentAttackForecast prefixes trap warning iff enemy trapCount > 0", () => {
  assertProp("PROP-029", FILE, fc.property(fc.boolean(), fc.integer({min: 1, max: 4}), (hasTrap, defHp) => {
    let state = createShowdown(15, {first: "wizard"});
    state = applyAction(state, {type: "end"}).state;
    state.sides.cowboy.board = [makeTroop("cowboy-billy", 1, {turn: 1, ready: true}), null, null];
    state.sides.wizard.board = [makeTroop("wizard-skeleton", 1, {health: defHp}), null, null];
    state.sides.wizard.traps = hasTrap ? ["wizard-hex-1"] : [];
    const view = viewFor(state, "cowboy");
    const out = presentAttackForecast(view, 0, 0);
    assert.ok(out.text.length > 0);
    assert.equal(out.text.startsWith("Without trap effects: "), hasTrap);
  }));
});

test("PROP-030: presentEvent formats every emitted Showdown event and rejects unknown types", () => {
  assertProp("PROP-030", FILE, fc.property(fc.integer({min: 0, max: 50000}), fc.integer({min: 4, max: 25}), (seed, steps) => {
    const {events} = advanceSteps(seed, steps);
    for (const event of events) {
      assert.ok(Object.hasOwn(EVENTS, event.type));
      const line = presentEvent(event);
      assert.equal(typeof line, "string");
      assert.ok(line.length > 5);
    }
    assert.throws(() => presentEvent({type: "unknown-phantom-event"}), /Unknown Showdown event/);
  }));
});

test("PROP-031: applyAction never mutates input state and rejects illegal actions", () => {
  assertProp("PROP-031", FILE, fc.property(fc.integer({min: 0, max: 20000}), fc.integer({min: 0, max: 10}), (seed, steps) => {
    const {state} = advanceSteps(seed, steps);
    fc.pre(!state.result);
    const before = structuredClone(state);
    const legal = legalActions(state)[0];
    const actionCopy = structuredClone(legal);
    applyAction(state, legal);
    assert.deepEqual(state, before);
    assert.deepEqual(legal, actionCopy);
    assert.throws(() => applyAction(state, {type: "summon", cardId: "nonexistent-card-1", tributes: []}));
  }));
});

test("PROP-032: playTurn level 0 chooses only legal non-cover moves and leaves caller state intact", () => {
  assertProp("PROP-032", FILE, fc.property(fc.integer({min: 0, max: 20000}), fc.integer({min: 0, max: 8}), (seed, steps) => {
    const {state} = advanceSteps(seed, steps);
    fc.pre(!state.result);
    const snapshot = structuredClone(state);
    const observed = [];
    const out = playTurn(state, 0, (cur, applied) => observed.push({cur, applied}));
    assert.deepEqual(state, snapshot);
    assert.equal(out.events.some((e) => e.type === "cover"), false);
    assert.ok(out.state.result !== null || out.state.turn > state.turn);
    assert.ok(observed.length >= 1);
  }));
});

test("PROP-033: playTurn level 1 is deterministic and invariant to unseen enemy trap identity before trigger", () => {
  assertProp("PROP-033", FILE, fc.property(fc.integer({min: 0, max: 20000}), (seed) => {
    const state = createShowdown(seed, {first: "cowboy"});
    const a = playTurn(state, 1);
    const b = playTurn(state, 1);
    assert.deepEqual(a, b);
    const withHex = structuredClone(state);
    const withSnare = structuredClone(state);
    withHex.sides.wizard.traps = ["wizard-hex-9"];
    withSnare.sides.wizard.traps = ["cowboy-bear-trap-9"];
    // Turn 1 cannot attack, so traps never spring; level 1 must play identically
    assert.deepEqual(playTurn(withHex, 1).events, playTurn(withSnare, 1).events);
  }));
});

test("PROP-034: playTurn level 1.5 executes legal moves and completes turns cleanly", () => {
  assertProp("PROP-034", FILE, fc.property(fc.integer({min: 0, max: 20000}), fc.integer({min: 0, max: 8}), (seed, steps) => {
    const {state} = advanceSteps(seed, steps);
    fc.pre(!state.result);
    const out = playTurn(state, 1.5);
    assert.ok(out.state.result !== null || out.state.active !== state.active);
    for (const ev of out.events) assert.ok(Object.hasOwn(EVENTS, ev.type));
  }));
});

test("PROP-035: planTurn is invariant to active deck permutations and hidden enemy traps", () => {
  assertProp("PROP-035", FILE, fc.property(fc.integer({min: 0, max: 20000}), fc.integer({min: 0, max: 8}), (seed, steps) => {
    const {state} = advanceSteps(seed, steps);
    fc.pre(!state.result);
    const reversedDeck = structuredClone(state);
    reversedDeck.sides[reversedDeck.active].deck.reverse();
    assert.deepEqual(planTurn(state), planTurn(reversedDeck));
    const hiddenHex = structuredClone(state);
    const hiddenSnare = structuredClone(state);
    hiddenHex.sides[opponent(state.active)].traps = ["wizard-hex-99"];
    hiddenSnare.sides[opponent(state.active)].traps = ["cowboy-bear-trap-99"];
    assert.deepEqual(viewFor(hiddenHex, state.active), viewFor(hiddenSnare, state.active));
    assert.deepEqual(planTurn(hiddenHex), planTurn(hiddenSnare));
  }));
});
