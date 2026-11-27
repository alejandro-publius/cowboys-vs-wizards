// Stage and serve the Pages tree, then run with playwright-core and Chromium installed:
// node scripts/browser-showdown-bounty-journey.mjs http://127.0.0.1:8000/
// CHROME_PATH can point to a local Chrome. Only an isolated browser profile is used.
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {SAVE_KEY} from "../src/game/showdown/campaign-store.js";
import {TYPES} from "../src/game/showdown/cards.js";
import {BOUNTIES, DECK_SIZE, HUNTS, choose, duelFor, newSave, settle, trailDone, withDeck} from "../src/game/showdown/progress.js";
import {applyAction, createShowdown, planTurn, playTurn} from "../src/game/showdown/rules.js";
import {encodeSave} from "../src/game/showdown/savecode.js";
import {turnDuel} from "../src/match/showdown-turn.js";

const require = createRequire(import.meta.url);
const {chromium} = require("playwright-core");
const site = new URL(process.argv[2] ?? "http://127.0.0.1:8000/");
const boss = BOUNTIES.find(({id}) => id === "graveyard-dragon");
const hunt = "hunt:" + boss.id;
const seed = 6;
const wanted = "#room-for-camp-bounties-title";
const scout = "#camp-scout-dragon";
const campWanted = '[data-camp-destination="camp-bounties-title"]';

// Use the same rules and opponent as a normal solo match. Only Cowboy actions are sent to the browser.
function playLine(duel, dealSeed) {
  let state = createShowdown(dealSeed, duel.options);
  const moves = [];
  const prefix = [...(duel.prefix ?? [])];
  while (!state.result) {
    if (state.active === "wizard") {
      state = playTurn(state, duel.level).state;
      continue;
    }
    const scripted = prefix.length > 0;
    const action = scripted ? prefix.shift() : planTurn(state)[0];
    if (!scripted) moves.push(action);
    state = applyAction(state, action).state;
  }
  assert.equal(prefix.length, 0);
  return {moves, winner: state.result.winner};
}

function trailSave() {
  let save = newSave();
  while (!trailDone(save)) {
    const duel = duelFor(save, "trail");
    assert.equal(playLine(duel, 0).winner, "cowboy", duel.name);
    const win = settle(save, duel.id, true).save;
    save = win.offer ? choose(win, win.offer[0]) : win;
  }
  return save;
}

async function playOnTable(page, {moves, winner}) {
  const click = (selector) => page.locator(selector).click();
  for (const action of moves) {
    if (action.cardId) await click(`#sd-hand [data-card="${action.cardId}"]`);
    if (action.slot !== undefined) await click(`#sd-board [data-own="${action.slot}"]`);
    for (const slot of action.tributes ?? []) await click(`#sd-board [data-own="${slot}"]`);
    if (action.target !== undefined) await click(`#sd-board [data-enemy="${action.target}"]`);
    if (action.type === "cover") await click("#sd-cover");
    if (action.type === "end") await click("#sd-end");
  }
  const verdict = page.locator("#sd-status .sd-result");
  await verdict.waitFor();
  assert.match(await verdict.innerText(), winner === "cowboy" ? /You win/ : /You lose/);
}

const progress = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
const stored = (page) => page.evaluate(() => ({...localStorage}));
const focusIs = (page, selector) => page.waitForFunction((s) => document.activeElement?.matches(s), selector);
async function tabTo(page, selector) {
  await page.locator(selector).waitFor();
  for (let tab = 0; tab < 50; tab++) {
    if (await page.locator(selector).evaluate((el) => document.activeElement === el)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Tab could not reach " + selector);
}

async function scoutJourney(page) {
  await page.goto(site.href);
  await tabTo(page, "#menu-saloon");
  await page.keyboard.press("Enter");
  await tabTo(page, "[data-saloon-wanted]");
  await page.keyboard.press("Enter");
  await page.locator(wanted + "[open]").waitFor();
  const papers = page.locator("#camp-bounties [data-wanted-bounty]");
  assert.equal(await papers.count(), BOUNTIES.length);
  for (const paper of await papers.all()) {
    assert.equal(await paper.getAttribute("data-wanted-wins"), "0");
    assert.equal(await paper.getAttribute("data-duel"), null, "a fresh career can inspect or scout each bill");
  }
  const before = await stored(page);
  await tabTo(page, scout);
  await page.keyboard.press("Enter");
  await page.getByRole("button", {name: "Back to Wanted"}).press("Enter");
  await focusIs(page, scout);

  await page.keyboard.press("Enter");
  await page.locator('#replay-room [data-branch="dragon"]').click();
  await page.getByRole("button", {name: "Play this turn yourself"}).click();
  const rehearsal = turnDuel("dragon-c5");
  assert.match(await page.locator("#sd-status").innerText(), /turn 5/);
  await playOnTable(page, playLine(rehearsal.duel, rehearsal.seed));
  assert.equal(await page.locator("#sd-result [data-choose], #sd-result [data-build-capture]").count(), 0);
  assert.equal(await page.locator("#sd-camp").innerText(), "Back to Wanted");
  await page.locator("#sd-camp").press("Enter");
  await focusIs(page, scout);
  assert.deepEqual(await stored(page), before, "scouting and finishing a practice duel must preserve every stored key");
  await page.keyboard.press("Escape");
  await focusIs(page, campWanted);
  console.log("ok - fresh career: Saloon, locked Wanted board, free Dragon turn, return to Wanted and Camp by keyboard; storage unchanged");
}

async function paidHunts(page) {
  let save = trailSave();
  await page.locator('[data-camp-destination="camp-save"]').click();
  await page.locator("#camp-code").fill(encodeSave(save));
  await page.locator("#camp-load").click();
  await page.locator("#camp-code-replace").click();
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key))?.wins > 0, SAVE_KEY);
  assert.deepEqual(await progress(page), save, "publicly imported career equals its completed Trail");
  for (let number = 1; number <= HUNTS; number++) {
    await page.goto(new URL(`?room=wanted&seed=${seed}`, site).href);
    await page.locator(`[data-duel="${hunt}"]`).click();
    const duel = duelFor(save, hunt);
    assert.ok((await page.locator("#sd-status").innerText()).includes(duel.name));
    const line = playLine(duel, seed);
    assert.equal(line.winner, "cowboy");
    await playOnTable(page, line);
    const win = settle(save, hunt, true).save;
    assert.deepEqual(await progress(page), win, "hunt " + number);
    assert.equal(win.collection[boss.reward] ?? 0, number === HUNTS ? 1 : 0);
    assert.equal(await page.locator("#sd-result [data-build-capture]").count(), Number(number === HUNTS));
    if (number < HUNTS && win.offer) {
      await page.locator(`#sd-result [data-choose="${win.offer[0]}"]`).click();
      save = choose(win, win.offer[0]);
      await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).offer === null, SAVE_KEY);
    } else save = win;
    assert.deepEqual(await progress(page), save);
    console.log(`ok - ${duel.name}, seed ${seed}, Cowboys win`);
  }

  const capture = page.locator("#sd-result [data-build-capture]");
  assert.ok((await capture.innerText()).includes(TYPES[boss.reward].name));
  assert.equal(await page.locator(".table-award").innerText(), TYPES[boss.reward].name + " joins your collection");
  const bonus = page.locator("#sd-result section").filter({has: page.getByRole("heading", {name: "Choose one bonus card"})});
  assert.equal(await bonus.locator("[data-choose]").count(), save.offer.length);
  await capture.click();
  const add = `[data-zone="deck"][data-type="${boss.reward}"][data-by="1"]`;
  await focusIs(page, add);
  const rewardRow = page.locator(`[data-row="${boss.reward}"]`);
  assert.match(await rewardRow.innerText(), /one other card removed/);
  await page.keyboard.press("Enter");
  assert.match(await rewardRow.innerText(), /card you can spare/);
  assert.ok(await page.locator("#builder-save").isDisabled(), "17 cards cannot be saved");
  const replace = Object.keys(save.deck).find((type) => save.deck[type] > 0);
  await page.locator(`[data-zone="deck"][data-type="${replace}"][data-by="-1"]`).click();
  const nextDeck = {...save.deck, [boss.reward]: 1, [replace]: save.deck[replace] - 1};
  const expected = withDeck(save, nextDeck, save.side);
  await page.locator("#builder-save").press("Enter");
  await page.waitForFunction(({key, type}) => JSON.parse(localStorage.getItem(key)).deck[type] === 1, {key: SAVE_KEY, type: boss.reward});
  await page.reload();
  assert.deepEqual(await progress(page), expected, "the capture, chosen deck and unclaimed offer survive reload");
  const poster = page.locator(`[data-wanted-bounty="${boss.id}"]`);
  assert.equal(await poster.getAttribute("data-wanted-wins"), String(HUNTS));
  assert.equal(await poster.getAttribute("data-duel"), null, "a completed hunt cannot pay again");
  assert.equal(await poster.getAttribute("data-book-card"), boss.reward);
  assert.match(await poster.innerText(), /captured/i);
  await poster.press("Enter");
  const book = page.locator(".character-book[open]");
  assert.equal(await book.locator("h3").innerText(), TYPES[boss.reward].name);
  await page.keyboard.press("Escape");
  await focusIs(page, `[data-wanted-bounty="${boss.id}"]`);
  await page.keyboard.press("Escape");
  await page.locator("#camp-build").click();
  const count = page.locator(`[data-row="${boss.reward}"] [data-count="deck"]`);
  assert.equal(await count.innerText(), "1", "the re-opened builder shows the captured card in the deck");
  assert.equal(Object.values(expected.deck).reduce((n, c) => n + c, 0), DECK_SIZE);
  console.log(`ok - ${TYPES[boss.reward].name} earned once, saved in a legal ${DECK_SIZE}-card deck, and retained after reload`);
}

const browser = await chromium.launch({executablePath: process.env.CHROME_PATH, args: ["--enable-unsafe-swiftshader"]});
try {
  const page = await browser.newPage({reducedMotion: "reduce", viewport: {width: 1100, height: 800}});
  page.setDefaultTimeout(10000);
  await scoutJourney(page);
  await paidHunts(page);
  await page.goto(new URL("graybox/?room=wanted", site).href);
  await focusIs(page, "#camp-bounties-title");
  await tabTo(page, scout);
  await page.keyboard.press("Enter");
  await page.getByRole("button", {name: "Back to Wanted"}).press("Enter");
  await focusIs(page, scout);
  console.log("ok - the lightweight Wanted link opens scouting and returns keyboard focus to its control");
} finally {
  await browser.close();
}
