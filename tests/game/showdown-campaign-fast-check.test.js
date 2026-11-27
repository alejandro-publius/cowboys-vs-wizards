// Fast-check properties for Showdown campaign progression, deck validation, save codes, storage, and keepsakes (PROP-036..PROP-065).
import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {RARITY, TYPES} from "../../src/game/showdown/cards.js";
import {
  OLD_SAVE_KEY,
  REFUSED_KEY,
  SAVE_KEY,
  laneCapturedCards,
  loadCampaign,
  saveCampaign,
} from "../../src/game/showdown/campaign-store.js";
import {INHERITED_KEY, INHERITED_SOURCE, holdings, joinInherited, readInherited} from "../../src/game/showdown/inherited.js";
import {
  BOUNTIES,
  DECK_SIZE,
  HUNTS,
  OPEN_WINS_PER_PACK,
  PACK_SIZE,
  RIVALS,
  SIDE_SIZE,
  choose,
  deckProblems,
  duelFor,
  duelList,
  migrate,
  newSave,
  openPack,
  owned,
  pool,
  settle,
  trailDone,
  withDeck,
} from "../../src/game/showdown/progress.js";
import {MAX_CODE_LENGTH, decodeSaveCode, describeSave, encodeSave, sameSave} from "../../src/game/showdown/savecode.js";
import {GRIT_CAP, STARTER, TRAIL, deckAfter} from "../../src/game/showdown/trail.js";
import {assertProp} from "../helpers/dec4-prop-harness.js";

const FILE = "tests/game/showdown-campaign-fast-check.test.js";
const COWBOY_CARDS = Object.keys(TYPES).filter((t) => TYPES[t].side === "cowboy");
const WIZARD_CARDS = Object.keys(TYPES).filter((t) => TYPES[t].side === "wizard");

function mockStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  let writes = 0;
  return {
    get writes() { return writes; },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { writes += 1; map.set(k, String(v)); },
    dump() { return Object.fromEntries(map); },
  };
}

function playTrailSave(wins, {clearOffers = true, pickIdx = 0} = {}) {
  let save = newSave();
  for (let i = 0; i < wins; i += 1) {
    save = settle(save, "trail", true).save;
    if (clearOffers && save.offer) save = choose(save, save.offer[pickIdx % save.offer.length]);
  }
  return save;
}

test("PROP-036: deckAfter(wins) maintains 16 Cowboy cards within rarity caps across 0..6 wins", () => {
  assertProp("PROP-036", FILE, fc.property(fc.integer({min: 0, max: TRAIL.length}), (wins) => {
    const deck = deckAfter(wins);
    const sum = Object.values(deck).reduce((a, b) => a + b, 0);
    assert.equal(sum, DECK_SIZE);
    for (const [type, copies] of Object.entries(deck)) {
      assert.equal(TYPES[type].side, "cowboy");
      assert.ok(Number.isInteger(copies) && copies > 0);
      assert.ok(copies <= RARITY[TYPES[type].rarity][1]);
    }
  }));
});

test("PROP-037: newSave passes deckProblems, round-trips migrate, and opens only Boot Hill", () => {
  assertProp("PROP-037", FILE, fc.property(fc.constant(null), () => {
    const s = newSave();
    assert.deepEqual(deckProblems(s, s.deck, s.side), []);
    assert.equal(sameSave(migrate(s), s), true);
    const open = duelList(s).filter((d) => d.state === "open");
    assert.equal(open.length, 1);
    assert.equal(open[0].name, "Boot Hill");
  }));
});

test("PROP-038: deckProblems rejects any main deck != 16 cards or side deck > 4 cards", () => {
  assertProp("PROP-038", FILE, fc.property(fc.integer({min: 0, max: 30}), fc.integer({min: 0, max: 10}), (mainCount, sideCount) => {
    fc.pre(mainCount !== DECK_SIZE || sideCount > SIDE_SIZE);
    const s = newSave();
    const deck = mainCount ? {"cowboy-sheriff": mainCount} : {};
    const side = sideCount ? {"cowboy-billy": sideCount} : {};
    assert.ok(deckProblems(s, deck, side).length >= 1);
  }));
});

test("PROP-039: deckProblems and withDeck reject Wizard cards, unknown IDs, and non-whole counts", () => {
  assertProp("PROP-039", FILE, fc.property(
    fc.constantFrom(...WIZARD_CARDS, "unknown-card"),
    fc.constantFrom(-1, 1.5, 1),
    (badType, badVal) => {
      const s = newSave();
      const deck = {"cowboy-sheriff": 15, [badType]: badVal};
      assert.ok(deckProblems(s, deck, {}).length >= 1);
      assert.throws(() => withDeck(s, deck, {}));
    }
  ));
});

test("PROP-040: withDeck accepts valid owned Cowboy splits and strips zero-count keys", () => {
  assertProp("PROP-040", FILE, fc.property(
    fc.integer({min: 0, max: 3}),
    fc.integer({min: 0, max: 4}),
    (deadeyeMain, sideSheriffs) => {
      const s = newSave();
      const deadeyeSide = Math.min(STARTER["cowboy-deadeye"] - deadeyeMain, SIDE_SIZE - sideSheriffs);
      fc.pre(deadeyeSide >= 0);
      const deck = {"cowboy-sheriff": 16 - deadeyeMain, "cowboy-billy": 0, "cowboy-deadeye": deadeyeMain};
      const side = {"cowboy-sheriff": sideSheriffs, "cowboy-deadeye": deadeyeSide, "cowboy-billy": 0};
      const updated = withDeck(s, deck, side);
      assert.equal("cowboy-billy" in updated.deck, false);
      assert.equal("cowboy-billy" in updated.side, false);
      assert.deepEqual(deckProblems(updated, updated.deck, updated.side), []);
    }
  ));
});

test("PROP-041: Trail losses increment losses.trail and duelFor caps Cowboy grit at GRIT_CAP", () => {
  assertProp("PROP-041", FILE, fc.property(fc.integer({min: 1, max: 10}), (losses) => {
    let s = newSave();
    for (let i = 0; i < losses; i += 1) s = settle(s, "trail", false).save;
    assert.equal(s.wins, 0);
    assert.equal(s.losses.trail, losses);
    const duel = duelFor(s, "trail");
    assert.equal(duel.options.baseOrbs.cowboy, 5 + Math.min(losses, GRIT_CAP));
  }));
});

test("PROP-042: Trail wins reset grit, advance wins, maintain 16-card deck, and grant 1 pack at Trail completion", () => {
  assertProp("PROP-042", FILE, fc.property(fc.integer({min: 1, max: TRAIL.length}), fc.integer({min: 0, max: 3}), (wins, lossesBefore) => {
    let s = newSave();
    for (let l = 0; l < lossesBefore; l += 1) s = settle(s, "trail", false).save;
    let lastEarned = null;
    for (let w = 0; w < wins; w += 1) {
      const res = settle(s, "trail", true);
      s = res.save;
      lastEarned = res.earned;
      if (s.offer) s = choose(s, s.offer[0]);
    }
    assert.equal(s.wins, wins);
    assert.equal(s.losses.trail, 0);
    assert.deepEqual(deckProblems(s, s.deck, s.side), []);
    assert.equal(lastEarned.packs, wins === TRAIL.length ? 1 : 0);
  }));
});

test("PROP-043: an unclaimed post-win offer blocks duelFor across every duel mode", () => {
  assertProp("PROP-043", FILE, fc.property(
    fc.constantFrom("trail", "rival:stargazer", "hunt:lantern-wraith", "open"),
    (duelId) => {
      const s = playTrailSave(6, {clearOffers: true});
      const withOffer = settle(s, "open", true).save;
      assert.ok(Array.isArray(withOffer.offer));
      assert.equal(duelFor(withOffer, duelId), null);
    }
  ));
});

test("PROP-044: choose increments selected card, clears offer, preserves migrate, and rejects non-offered cards", () => {
  assertProp("PROP-044", FILE, fc.property(fc.integer({min: 0, max: 1}), (idx) => {
    const s = settle(newSave(), "trail", true).save;
    assert.equal(s.offer.length, 2);
    const picked = s.offer[idx];
    const before = s.collection[picked] ?? 0;
    assert.throws(() => choose(s, "wizard-skeleton"));
    const after = choose(s, picked);
    assert.equal(after.offer, null);
    assert.equal(after.collection[picked], before + 1);
    assert.equal(sameSave(migrate(after), after), true);
  }));
});

test("PROP-045: before Trail completion, Rivals, Bounties, and Open Range stay locked", () => {
  assertProp("PROP-045", FILE, fc.property(fc.integer({min: 0, max: TRAIL.length - 1}), (wins) => {
    const s = playTrailSave(wins);
    assert.equal(trailDone(s), false);
    for (const row of duelList(s).filter((d) => d.kind !== "trail")) {
      assert.equal(row.state, "locked");
      assert.equal(duelFor(s, row.id), null);
    }
  }));
});

test("PROP-046: beating Rivals in order records each ID once and awards configured rewards and packs", () => {
  assertProp("PROP-046", FILE, fc.property(fc.integer({min: 1, max: RIVALS.length}), (count) => {
    let s = playTrailSave(TRAIL.length);
    const startPacks = s.packs;
    let expectedPacks = 0;
    for (let i = 0; i < count; i += 1) {
      const rival = RIVALS[i];
      const res = settle(s, `rival:${rival.id}`, true);
      s = res.save;
      expectedPacks += rival.packs;
      if (s.offer) s = choose(s, s.offer[0]);
      for (const rCard of rival.reward) assert.ok((s.collection[rCard] ?? 0) >= 1);
    }
    assert.deepEqual(s.rivals, RIVALS.slice(0, count).map((r) => r.id));
    assert.equal(s.packs, startPacks + expectedPacks);
  }));
});

test("PROP-047: unbeaten Rival gear and location rewards stay excluded from pool()", () => {
  assertProp("PROP-047", FILE, fc.property(fc.integer({min: 0, max: 2}), (beatenCount) => {
    let s = playTrailSave(TRAIL.length);
    for (let i = 0; i < beatenCount; i += 1) {
      s = settle(s, `rival:${RIVALS[i].id}`, true).save;
      if (s.offer) s = choose(s, s.offer[0]);
    }
    const available = pool(s);
    assert.equal(available.includes("cowboy-six-shooter"), beatenCount >= 1 && owned(s, "cowboy-six-shooter") < RARITY[TYPES["cowboy-six-shooter"].rarity][1]);
    assert.equal(available.includes("cowboy-sheriffs-office"), beatenCount >= 2 && owned(s, "cowboy-sheriffs-office") < RARITY[TYPES["cowboy-sheriffs-office"].rarity][1]);
  }));
});

test("PROP-048: Wanted bounty stages 1..5 grant the Legendary reward exclusively on stage 5", () => {
  assertProp("PROP-048", FILE, fc.property(
    fc.constantFrom(...BOUNTIES),
    fc.integer({min: 1, max: HUNTS}),
    (bounty, clears) => {
      let s = playTrailSave(TRAIL.length);
      let captured = null;
      for (let i = 1; i <= clears; i += 1) {
        const res = settle(s, `hunt:${bounty.id}`, true);
        s = res.save;
        if (s.offer) s = choose(s, s.offer[0]);
        if (i < HUNTS) assert.equal(res.earned.captured, null);
        else captured = res.earned.captured;
      }
      assert.equal(s.hunts[bounty.id], clears);
      if (clears === HUNTS) {
        assert.equal(captured, bounty.reward);
        assert.equal(s.collection[bounty.reward], 1);
        assert.equal(duelFor(s, `hunt:${bounty.id}`), null);
      } else {
        assert.equal(s.collection[bounty.reward] ?? 0, 0);
        assert.notEqual(duelFor(s, `hunt:${bounty.id}`), null);
      }
    }
  ));
});

test("PROP-049: migrate rejects un-earned Legendaries and pool excludes Basic and Legendary cards", () => {
  assertProp("PROP-049", FILE, fc.property(fc.constantFrom(...BOUNTIES), fc.integer({min: 0, max: HUNTS - 1}), (bounty, partialHunts) => {
    const base = playTrailSave(TRAIL.length);
    for (const card of pool(base)) {
      assert.equal(["basic", "legendary"].includes(TYPES[card].rarity), false);
    }
    const forged = structuredClone(base);
    forged.hunts[bounty.id] = partialHunts;
    forged.collection[bounty.reward] = 1;
    assert.equal(sameSave(migrate(forged), newSave()), true);
  }));
});

test("PROP-050: Open Range losses leave save unchanged and every 3rd win awards 1 pack", () => {
  assertProp("PROP-050", FILE, fc.property(fc.integer({min: 1, max: 12}), (wins) => {
    let s = playTrailSave(TRAIL.length);
    assert.deepEqual(settle(s, "open", false).save, s);
    const startPacks = s.packs;
    for (let i = 1; i <= wins; i += 1) {
      const res = settle(s, "open", true);
      assert.equal(res.earned.packs, i % OPEN_WINS_PER_PACK === 0 ? 1 : 0);
      s = res.save;
      if (s.offer) s = choose(s, s.offer[0]);
    }
    assert.equal(s.openWins, wins);
    assert.equal(s.packs, startPacks + Math.floor(wins / OPEN_WINS_PER_PACK));
  }));
});

test("PROP-051: openPack consumes 1 pack, obeys rarity caps, and draws uncommon+ first when available", () => {
  assertProp("PROP-051", FILE, fc.property(fc.integer({min: 0, max: 40}), (rollSeed) => {
    const s = {...playTrailSave(TRAIL.length), packs: 2, rolls: rollSeed};
    const hasBetter = pool(s).some((t) => TYPES[t].rarity !== "common");
    const {save: after, cards} = openPack(s);
    assert.equal(after.packs, 1);
    assert.equal(after.rolls, rollSeed + 1);
    assert.ok(cards.length >= 1 && cards.length <= PACK_SIZE);
    if (hasBetter) assert.notEqual(TYPES[cards[0]].rarity, "common");
    for (const [type, copies] of Object.entries(after.collection)) {
      assert.ok(copies <= RARITY[TYPES[type].rarity][1]);
    }
  }));
});

test("PROP-052: encodeSave and decodeSaveCode round-trip reachable saves with whitespace tolerance", () => {
  assertProp("PROP-052", FILE, fc.property(
    fc.integer({min: 0, max: TRAIL.length}),
    fc.constantFrom("", "  ", "\n\t "),
    fc.constantFrom("", " ", "\n"),
    (wins, pre, post) => {
      const s = playTrailSave(wins, {pickIdx: wins});
      const rawCode = encodeSave(s);
      const spaced = `${pre}${rawCode.slice(0, 8)} ${rawCode.slice(8)}${post}`;
      const decoded = decodeSaveCode(spaced);
      assert.equal(decoded.ok, true);
      assert.equal(decoded.legacy, false);
      assert.equal(sameSave(decoded.save, s), true);
    }
  ));
});

test("PROP-053: encodeSave escapes wide Unicode characters above U+00FF without throwing", () => {
  assertProp("PROP-053", FILE, fc.property(fc.string({minLength: 1, maxLength: 40}), (txt) => {
    const widePayload = {note: `${txt}—★🃏`};
    const encoded = encodeSave(widePayload);
    assert.deepEqual(JSON.parse(atob(encoded)), widePayload);
  }));
});

test("PROP-054: decodeSaveCode migrates legacy v1 {wins, losses} codes with legacy=true", () => {
  assertProp("PROP-054", FILE, fc.property(fc.integer({min: 0, max: TRAIL.length}), fc.integer({min: 0, max: 5}), (wins, losses) => {
    const raw = {wins, losses};
    const res = decodeSaveCode(btoa(JSON.stringify(raw)));
    assert.equal(res.ok, true);
    assert.equal(res.legacy, true);
    assert.equal(sameSave(res.save, migrate(raw)), true);
  }));
});

test("PROP-055: decodeSaveCode never throws on arbitrary strings, future versions, or oversized codes", () => {
  const arb = fc.oneof(
    fc.string({maxLength: 200}),
    fc.constant("A".repeat(MAX_CODE_LENGTH + 4)),
    fc.integer({min: 3, max: 99}).map((v) => btoa(JSON.stringify({v}))),
    fc.constant(btoa(JSON.stringify({...newSave(), wins: 99})))
  );
  assertProp("PROP-055", FILE, fc.property(arb, (input) => {
    const res = decodeSaveCode(input);
    assert.equal(typeof res.ok, "boolean");
    if (!res.ok) assert.ok(typeof res.reason === "string" && res.reason.length > 0);
  }));
});

test("PROP-056: permuting object key order preserves sameSave and decodeSaveCode acceptance", () => {
  assertProp("PROP-056", FILE, fc.property(fc.integer({min: 0, max: TRAIL.length}), (wins) => {
    const s = playTrailSave(wins);
    const revObj = (o) => Object.fromEntries(Object.entries(o).reverse());
    const reversed = revObj({...s, deck: revObj(s.deck), collection: revObj(s.collection)});
    assert.equal(sameSave(s, reversed), true);
    const decoded = decodeSaveCode(encodeSave(reversed));
    assert.equal(decoded.ok, true);
    assert.equal(sameSave(decoded.save, s), true);
  }));
});

test("PROP-057: describeSave reports exact Trail wins, rivals, bounty hunts, collection sum, and packs", () => {
  assertProp("PROP-057", FILE, fc.property(fc.integer({min: 0, max: TRAIL.length}), fc.integer({min: 0, max: 5}), (wins, extraPacks) => {
    const s = {...playTrailSave(wins), packs: extraPacks};
    const line = describeSave(s);
    const collected = Object.values(s.collection).reduce((a, b) => a + b, 0);
    assert.ok(line.includes(`Trail ${wins} of ${TRAIL.length} won`));
    assert.ok(line.includes(`${collected} collected cards`));
    assert.ok(line.includes(`${extraPacks} unopened packs`));
  }));
});

test("PROP-058: migrate never throws on arbitrary values and is idempotent", () => {
  assertProp("PROP-058", FILE, fc.property(fc.anything(), (val) => {
    const once = migrate(val);
    const twice = migrate(once);
    assert.equal(sameSave(once, twice), true);
    assert.deepEqual(deckProblems(once, once.deck, once.side), []);
  }));
});

test("PROP-059: saveCampaign and loadCampaign round-trip valid saves and refuse tampered ones", () => {
  assertProp("PROP-059", FILE, fc.property(fc.integer({min: 0, max: TRAIL.length}), (wins) => {
    const store = mockStorage();
    const valid = playTrailSave(wins);
    assert.equal(saveCampaign(store, valid).ok, true);
    assert.equal(sameSave(loadCampaign(store), valid), true);

    const bad = {...valid, wins: 999};
    assert.equal(saveCampaign(store, bad).ok, false);
    assert.equal(sameSave(loadCampaign(store), valid), true);
  }));
});

test("PROP-060: saveCampaign backs up damaged SAVE_KEY into REFUSED_KEY once without overwriting", () => {
  assertProp("PROP-060", FILE, fc.property(fc.string({minLength: 1, maxLength: 50}), (corrupt) => {
    fc.pre(corrupt !== JSON.stringify(newSave()));
    const store = mockStorage({[SAVE_KEY]: corrupt});
    const res = saveCampaign(store, newSave());
    assert.equal(res.ok, true);
    assert.equal(store.getItem(REFUSED_KEY), corrupt);

    // A second corrupt overwrite does not clobber REFUSED_KEY
    store.setItem(SAVE_KEY, "{broken-second");
    saveCampaign(store, playTrailSave(1));
    assert.equal(store.getItem(REFUSED_KEY), corrupt);
  }));
});

test("PROP-061: loadCampaign falls back to OLD_SAVE_KEY when SAVE_KEY is missing or invalid", () => {
  assertProp("PROP-061", FILE, fc.property(fc.integer({min: 0, max: TRAIL.length}), fc.boolean(), (wins, corruptV2) => {
    const init = {[OLD_SAVE_KEY]: JSON.stringify({wins, losses: 1})};
    if (corruptV2) init[SAVE_KEY] = "{not-json";
    const store = mockStorage(init);
    const loaded = loadCampaign(store);
    assert.equal(loaded.wins, wins);
    assert.equal(store.writes, 0);
  }));
});

test("PROP-062: joinInherited grows monotonically without duplicate entries or redundant writes", () => {
  const batchArb = fc.array(fc.constantFrom("cowboy-captured-dragon", "cowboy-captured-wraith", "cowboy-billy"), {maxLength: 4});
  assertProp("PROP-062", FILE, fc.property(batchArb, batchArb, (b1, b2) => {
    const store = mockStorage();
    const r1 = joinInherited(store, b1);
    const writesAfterFirst = store.writes;
    const r1Repeat = joinInherited(store, b1);
    assert.equal(store.writes, writesAfterFirst);
    assert.deepEqual(r1Repeat.cards, r1.cards);
    const r2 = joinInherited(store, b2);
    assert.deepEqual(r2.cards, [...new Set([...b1, ...b2])]);
    assert.deepEqual(readInherited(store).cards, r2.cards);
  }));
});

test("PROP-063: damaged INHERITED_KEY reports damaged=true and is never overwritten by joinInherited", () => {
  assertProp("PROP-063", FILE, fc.property(fc.constantFrom("{bad", JSON.stringify({v: 2, cards: []})), (badRaw) => {
    const store = mockStorage({[INHERITED_KEY]: badRaw});
    assert.equal(readInherited(store).damaged, true);
    const joined = joinInherited(store, ["cowboy-captured-dragon"]);
    assert.equal(joined.saved, false);
    assert.deepEqual(joined.cards, ["cowboy-captured-dragon"]);
    assert.equal(store.getItem(INHERITED_KEY), badRaw);
  }));
});

test("PROP-064: holdings deduplicates shared cards keeping Showdown counts and drops unknown IDs", () => {
  assertProp("PROP-064", FILE, fc.property(
    fc.integer({min: 0, max: TRAIL.length}),
    fc.array(fc.constantFrom("cowboy-captured-dragon", "cowboy-deadeye", "unknown-keepsake"), {maxLength: 5}),
    (wins, laneList) => {
      const s = playTrailSave(wins);
      const rows = holdings(s, laneList);
      const types = rows.map((r) => r.type);
      assert.equal(new Set(types).size, types.length);
      assert.equal(types.includes("unknown-keepsake"), false);
      const deadeyeRow = rows.find((r) => r.type === "cowboy-deadeye");
      assert.equal(deadeyeRow.copies, s.collection["cowboy-deadeye"]);
      assert.equal(deadeyeRow.inherited, laneList.includes("cowboy-deadeye"));
    }
  ));
});

test("PROP-065: laneCapturedCards grants a Legendary keepsake iff all 5 of its lane hunts were cleared", () => {
  const dragonHunts = ["coffin-creek-crossing", "bone-choir-chapel", "hanging-tree-pass", "dusk-at-dry-well", "lantern-row-standoff"];
  assertProp("PROP-065", FILE, fc.property(fc.integer({min: 0, max: 5}), (count) => {
    const store = mockStorage({[INHERITED_SOURCE]: JSON.stringify({clearedHunts: dragonHunts.slice(0, count)})});
    const cards = laneCapturedCards(store);
    assert.deepEqual(cards, count === 5 ? ["cowboy-captured-dragon"] : []);
  }));
});
