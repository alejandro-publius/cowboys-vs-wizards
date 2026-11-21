// The Wizard preview (Fable's ruling): four fixed duels from the Wizard seat, fixed reward swaps and grit,
// then Open range. Its own key holds only {v: 1, wins, losses}; Cowboy keys and the playtest log are never written.
import assert from "node:assert/strict";
import test from "node:test";
import {DECKS, RARITY, TYPES} from "../../src/game/showdown/cards.js";
import {applyAction, createShowdown, legalActions, planTurn, playTurn} from "../../src/game/showdown/rules.js";
import {viewFor} from "../../src/game/showdown/contract.js";
import {deckAfter} from "../../src/game/showdown/trail.js";
import {newSave, settle} from "../../src/game/showdown/progress.js";
import {SAVE_KEY} from "../../src/game/showdown/campaign-store.js";
import {createCampaign} from "../../src/match/showdown-campaign.js";
import {createShowdownSession} from "../../src/match/showdown-session.js";
import {encodeSave} from "../../src/game/showdown/savecode.js";
import {OPEN_RANGE_ID, PREVIEW_LABEL, WIZARD_PREVIEW_KEY, WIZARD_STARTER, WIZARD_TRACK, createWizardPreview, previewUnlocked,
  wizardDeckAfter, wizardFromQuery} from "../../src/match/showdown-wizard-campaign.js";

const memory = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {map, writes: [], getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem(key, value) { this.writes.push(key); map.set(key, String(value)); }, removeItem: (key) => map.delete(key)};
};
const total = (deck) => Object.values(deck).reduce((sum, copies) => sum + copies, 0);

// A careful Wizard player that acts through the session's legal actions only. It plans on a mirror of the duel
// (the same seed and options in the engine; the Cowboy bot replies with the session's own playTurn), and the
// mirror's Wizard view must equal the session's at every step, so the session is the one being played.
// pass: a Wizard who only ever ends the turn (a real, legal way to lose).
function playDuel(duel, seed, {pass = false} = {}) {
  const session = createShowdownSession({seed, duel, seat: duel.seat});
  let mirror = createShowdown(seed, duel.options);
  const bot = () => { while (!mirror.result && mirror.active !== "wizard") mirror = playTurn(mirror, duel.level).state; };
  bot();
  for (let steps = 0; !session.view().result && steps < 400; steps++) {
    assert.deepEqual(session.view(), viewFor(mirror, "wizard"));
    const [action] = pass ? [{type: "end"}] : planTurn(mirror);
    assert.ok(session.legal().some((each) => JSON.stringify(each) === JSON.stringify(action)), "a legal action of the session");
    session.act(action);
    mirror = applyAction(mirror, action).state;
    bot();
  }
  assert.deepEqual(session.view(), viewFor(mirror, "wizard"));
  return session.view().result;
}
// The first seed from 0 whose duel ends the way we want.
function seedFor(duel, wizardWins) {
  for (let seed = 0; seed < 300; seed++) {
    const result = playDuel(duel, seed, {pass: !wizardWins});
    if (result && (result.winner === "wizard") === wizardWins) return {seed, result};
  }
  throw new Error(`no seed in 0..299 gives a ${wizardWins ? "win" : "loss"} for ${duel.name}`);
}

test("the track is Fable's table: names, AI decks, levels, Bases, rewards, Wizards open", () => {
  assert.equal(PREVIEW_LABEL, "Wizard preview");
  assert.deepEqual(WIZARD_TRACK.map((d) => [d.id, d.name, d.level, d.base]),
    [["dry-gulch", "Dry Gulch", 0, 3], ["wagon-ring", "Wagon Ring", 0, 4], ["trapline-pass", "Trapline Pass", 1, 4], ["high-noon", "High Noon", 1.5, 4]]);
  assert.deepEqual(WIZARD_TRACK.map((d) => d.deck), [{"cowboy-sheriff": 16}, deckAfter(2), deckAfter(4), DECKS.cowboy]);
  assert.ok(Object.keys(deckAfter(4)).includes("cowboy-bear-trap"), "Trapline Pass's face-down card is a Bear Trap");
  assert.deepEqual(WIZARD_TRACK.map((d) => d.reward), [
    [["wizard-raven-familiar", "wizard-skeleton", 2]], [["wizard-bone-wall", "wizard-skeleton", 2]],
    [["wizard-imp", "wizard-skeleton", 1], ["wizard-hex", "wizard-singularity", 1]], [["wizard-dragon", "wizard-wizard", 1]]]);
  assert.deepEqual(WIZARD_STARTER, {"wizard-skeleton": 10, "wizard-wizard": 3, "wizard-singularity": 3});
  assert.deepEqual(wizardDeckAfter(4), {"wizard-skeleton": 5, "wizard-wizard": 2, "wizard-singularity": 2, "wizard-raven-familiar": 2,
    "wizard-bone-wall": 2, "wizard-imp": 1, "wizard-hex": 1, "wizard-dragon": 1});
  assert.ok(Object.isFrozen(WIZARD_TRACK) && WIZARD_TRACK.every((d) => Object.isFrozen(d) && Object.isFrozen(d.deck)));
});

test("every Wizard deck on the track is 16 Wizard cards within rarity caps (Fable left this unchecked)", () => {
  for (let wins = 0; wins <= 4; wins++) {
    const deck = wizardDeckAfter(wins);
    assert.equal(total(deck), 16, `after ${wins}`);
    for (const [type, copies] of Object.entries(deck)) {
      assert.equal(TYPES[type].side, "wizard", type);
      assert.ok(copies <= RARITY[TYPES[type].rarity][1], `${type} ×${copies} after ${wins}`);
    }
  }
  for (const duel of WIZARD_TRACK) assert.equal(total(duel.deck), 16, duel.name);
});

test("lesson claims hold on the card table: Raven is not Undead, Imp has Quickdraw, Hex cancels, Bone Wall has Guard", () => {
  assert.equal(TYPES["wizard-skeleton"].tag, "Undead");
  assert.notEqual(TYPES["wizard-raven-familiar"].tag, "Undead");
  assert.ok(TYPES["wizard-raven-familiar"].keys.includes("scout"));
  assert.ok(TYPES["wizard-bone-wall"].keys.includes("guard"));
  assert.ok(TYPES["wizard-imp"].keys.includes("quickdraw"));
  assert.equal(TYPES["wizard-hex"].effect, "hex");
  assert.ok(TYPES["wizard-wizard"].keys.includes("raise"));
});

test("Fable's fixture: tribute [0] raises a 1-orb Skeleton; with all three slots full, nothing rises", () => {
  for (const seed of [0, 1, 60]) {
    const two = createShowdown(seed, {first: "wizard", decks: {wizard: {"wizard-wizard": 16}},
      opening: {wizard: [{type: "wizard-skeleton", health: 1}, {type: "wizard-skeleton", health: 3}]}});
    const summon = legalActions(two).find((a) => a.type === "summon" && a.tributes.length === 1 && a.tributes[0] === 0);
    const {state, events} = applyAction(two, summon);
    assert.deepEqual(events.map((e) => e.type).filter((t) => ["tribute", "summon", "raise"].includes(t)), ["tribute", "summon", "raise"]);
    const board = state.sides.wizard.board.filter(Boolean).map((t) => [t.cardId.replace(/-\d+$/, ""), t.health]).sort();
    assert.deepEqual(board, [["wizard-skeleton", 1], ["wizard-skeleton", 3], ["wizard-wizard", 5]].map(([t, h]) => [t, t === "wizard-wizard" ? TYPES[t].health : h]).sort());
    const three = createShowdown(seed, {first: "wizard", decks: {wizard: {"wizard-wizard": 16}},
      opening: {wizard: [{type: "wizard-skeleton", health: 1}, {type: "wizard-skeleton", health: 3}, {type: "wizard-skeleton", health: 2}]}});
    const full = legalActions(three).find((a) => a.type === "summon" && a.tributes[0] === 0);
    assert.ok(!applyAction(three, full).events.some((e) => e.type === "raise"));
  }
});

test("a fresh preview: duel 1 open, the rest locked, Wizard seat, Base 5, Wizards open, nothing written", () => {
  const storage = memory();
  const preview = createWizardPreview(storage);
  assert.deepEqual(preview.duels().map((d) => [d.id, d.state]), [["wizard:dry-gulch", "open"], ["wizard:wagon-ring", "locked"],
    ["wizard:trapline-pass", "locked"], ["wizard:high-noon", "locked"], [OPEN_RANGE_ID, "locked"]]);
  assert.equal(preview.duels().at(-1).name, "Open range, Wizard seat");
  const duel = preview.trailDuel();
  assert.equal(duel.seat, "wizard");
  assert.deepEqual(duel.options, {decks: {wizard: WIZARD_STARTER, cowboy: {"cowboy-sheriff": 16}}, baseOrbs: {wizard: 5, cowboy: 3}, first: "wizard"});
  assert.equal(preview.duel("wizard:wagon-ring"), null);
  assert.equal(preview.duel(OPEN_RANGE_ID), null);
  assert.equal(preview.duel("trail"), null);
  assert.deepEqual(preview.progress(), {v: 1, wins: 0, losses: 0, deck: WIZARD_STARTER, side: {}, offer: null});
  assert.throws(() => preview.choose("wizard-imp"));
  assert.deepEqual(storage.writes, []);
});

test("real legal journey: loss, grit rematch, four wins with each swap, then Open range that pays nothing", () => {
  const storage = memory();
  let preview = createWizardPreview(storage);
  // A real loss on Dry Gulch, then the rematch has one grit orb.
  const first = preview.trailDuel();
  const lost = seedFor(first, false);
  assert.equal(lost.result.winner, "cowboy");
  const loss = preview.settle(first, false);
  assert.deepEqual(loss, {won: false, earned: {cards: [], packs: 0, captured: null}, intoDeck: [], grit: 1});
  assert.equal(storage.map.get(WIZARD_PREVIEW_KEY), JSON.stringify({v: 1, wins: 0, losses: 1}));
  assert.equal(preview.duel(first.id).options.baseOrbs.wizard, 6);
  preview.settle(preview.duel(first.id), false);
  preview.settle(preview.duel(first.id), false);
  assert.equal(preview.duel(first.id).options.baseOrbs.wizard, 7, "grit caps at 2");

  for (const [i, track] of WIZARD_TRACK.entries()) {
    preview = createWizardPreview(storage); // a reload between duels
    const duel = preview.trailDuel();
    assert.equal(duel.name, track.name);
    assert.deepEqual(duel.options.decks.wizard, wizardDeckAfter(i));
    const {seed, result} = seedFor(duel, true);
    assert.equal(result.winner, "wizard", `${track.name} seed ${seed}`);
    const paid = preview.settle(duel, true);
    assert.deepEqual(paid.intoDeck, track.reward.map(([type, replaced, copies]) => [type, copies, replaced]));
    assert.deepEqual(paid.earned.cards, track.reward.map(([type, , copies]) => [type, copies]));
    assert.deepEqual(preview.progress().deck, wizardDeckAfter(i + 1));
    assert.equal(preview.duel(duel.id), null, "a won duel is not offered again");
  }
  assert.equal(storage.map.get(WIZARD_PREVIEW_KEY), JSON.stringify({v: 1, wins: 4, losses: 0}));
  assert.equal(preview.trailDuel(), null);
  const open = preview.duel(OPEN_RANGE_ID);
  assert.equal(open.name, "Open range, Wizard seat");
  assert.equal(open.level, 2);
  assert.deepEqual(open.options.decks, {wizard: wizardDeckAfter(4), cowboy: DECKS.cowboy});
  assert.ok(playDuel(open, 0));
  const before = storage.writes.length;
  for (const won of [true, false]) assert.deepEqual(preview.settle(open, won), {won, earned: {cards: [], packs: 0, captured: null}, intoDeck: [], grit: 0});
  assert.equal(storage.writes.length, before, "Open range saves nothing");
  assert.ok(preview.duel(OPEN_RANGE_ID), "Open range can be played again");
  assert.deepEqual([...storage.map.keys()], [WIZARD_PREVIEW_KEY]);
});

test("no double pay: a second settle, a reload, a stale tab and a retry of a won duel pay nothing", () => {
  const storage = memory();
  const tabA = createWizardPreview(storage);
  const tabB = createWizardPreview(storage);
  const duel = tabA.trailDuel();
  assert.equal(tabA.settle(duel, true).earned.cards.length, 1);
  assert.deepEqual(tabA.settle(duel, true).earned.cards, [], "the same finished duel settled twice");
  assert.deepEqual(tabB.settle(tabB.trailDuel(), true).earned.cards, [], "a stale tab's Dry Gulch");
  assert.deepEqual(createWizardPreview(storage).settle(duel, true).earned.cards, [], "after a reload");
  assert.deepEqual(tabA.settle({...duel, id: "wizard:wagon-ring"}, true).earned.cards, [], "a forged id with the wrong index");
  assert.deepEqual(tabA.settle({...duel, kind: "trail"}, true).earned.cards, []);
  assert.deepEqual(tabA.settle(null, true).earned.cards, []);
  assert.equal(storage.map.get(WIZARD_PREVIEW_KEY), JSON.stringify({v: 1, wins: 1, losses: 0}));
});

test("invalid stored values start fresh; a valid one loads", () => {
  const bad = ["", "nope", "null", "[]", "{}", '{"v":1,"wins":5,"losses":0}', '{"v":1,"wins":-1,"losses":0}', '{"v":1,"wins":1.5,"losses":0}',
    '{"v":2,"wins":1,"losses":0}', '{"v":1,"wins":1}', '{"v":1,"wins":1,"losses":"2"}', '{"v":1,"wins":1,"losses":0,"deck":{"wizard-dragon":16}}',
    '{"v":1,"wins":"1","losses":0}', '{"__proto__":{"v":1},"wins":1,"losses":0}'];
  for (const text of bad) {
    const preview = createWizardPreview(memory({[WIZARD_PREVIEW_KEY]: text}));
    assert.deepEqual([preview.progress().wins, preview.progress().losses], [0, 0], text);
  }
  const preview = createWizardPreview(memory({[WIZARD_PREVIEW_KEY]: '{"losses":1,"wins":2,"v":1}'}));
  assert.equal(preview.trailDuel().name, "Trapline Pass");
  assert.equal(preview.trailDuel().options.baseOrbs.wizard, 6);
  assert.equal(preview.duel("wizard:open", {"wizard-dragon": 16}), null);
});

test("blocked, missing or full storage: play goes on in memory and saved() says so", () => {
  const throwing = {getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); }};
  for (const storage of [null, undefined, {}, throwing]) {
    const preview = createWizardPreview(storage);
    assert.equal(preview.saved(), true);
    assert.equal(preview.settle(preview.trailDuel(), true).earned.cards.length, 1);
    assert.equal(preview.saved(), false);
    assert.equal(preview.trailDuel().name, "Wagon Ring", "the win is kept in memory");
    assert.equal(preview.reset(), false);
  }
});

test("a best of three's deck copy is used only when it is a legal Wizard deck", () => {
  const preview = createWizardPreview(memory());
  const legal = {"wizard-skeleton": 12, "wizard-wizard": 3, "wizard-singularity": 1};
  assert.deepEqual(preview.duel("wizard:dry-gulch", legal).options.decks.wizard, legal);
  for (const deck of [{"wizard-dragon": 16}, {"cowboy-sheriff": 16}, {"wizard-skeleton": 15}, {"wizard-skeleton": 15.5, "wizard-wizard": 0.5}, "x"]) {
    assert.deepEqual(preview.duel("wizard:dry-gulch", deck).options.decks.wizard, WIZARD_STARTER);
  }
});

test("Start preview over writes only the preview key; Cowboy Start over leaves the preview alone", () => {
  const storage = memory();
  const preview = createWizardPreview(storage);
  preview.settle(preview.trailDuel(), true);
  assert.equal(createCampaign(storage).reset(), true);
  assert.equal(createWizardPreview(storage).progress().wins, 1, "Cowboy reset leaves the preview");
  const cowboyBefore = storage.map.get(SAVE_KEY);
  assert.equal(preview.reset(), true);
  assert.equal(storage.map.get(WIZARD_PREVIEW_KEY), JSON.stringify({v: 1, wins: 0, losses: 0}));
  assert.equal(storage.map.get(SAVE_KEY), cowboyBefore);
});

test("a Cowboy save with a pending offer and 2 packs stays byte-identical after a preview duel 1 win", () => {
  let save = newSave();
  for (let i = 0; i < 6; i++) save = {...settle(save, "trail", true).save, offer: null};
  save = settle(save, "rival:stargazer", true).save;
  save = {...save, packs: 2};
  assert.ok(save.offer);
  const storage = memory();
  createCampaign(storage).replace(save);
  const playtest = '[{"run":"x","won":true}]';
  storage.setItem("cvw-showdown-playtest-v1", playtest);
  const snapshot = new Map(storage.map);
  const code = encodeSave(createCampaign(storage).progress());
  storage.writes.length = 0;

  assert.equal(previewUnlocked(createCampaign(storage).progress()), true);
  const preview = createWizardPreview(storage);
  const duel = preview.trailDuel();
  const {seed} = seedFor(duel, true);
  assert.equal(playDuel(duel, seed).winner, "wizard");
  preview.settle(duel, true);

  assert.deepEqual(storage.writes, [WIZARD_PREVIEW_KEY]);
  for (const [key, value] of snapshot) assert.equal(storage.map.get(key), value, key);
  assert.equal(encodeSave(createCampaign(storage).progress()), code);
});

test("?wizard=1 is the only query that opens the preview; Boot Hill unlocks the Camp section", () => {
  assert.equal(wizardFromQuery("?wizard=1"), true);
  assert.equal(wizardFromQuery("?practice=0&wizard=1"), true, "precedence is the app's");
  for (const search of ["", "?wizard", "?wizard=", "?wizard=0", "?wizard=true", "?wizard=01", "?wizard=1&wizard=1", "?wizard= 1", "?Wizard=1"]) {
    assert.equal(wizardFromQuery(search), false, search);
  }
  assert.equal(previewUnlocked(newSave()), false);
  assert.equal(previewUnlocked({...settle(newSave(), "trail", true).save}), true);
  for (const bad of [null, undefined, {}, {wins: "1"}, {wins: 0}]) assert.equal(previewUnlocked(bad), false);
});
