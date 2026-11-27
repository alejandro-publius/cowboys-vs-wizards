// Staged illustrated Wanted journey. Only the setup awards are seeded. Chrome earns both captures.
import assert from "node:assert/strict";
import {SAVE_KEY} from "../src/game/showdown/campaign-store.js";
import {TYPES} from "../src/game/showdown/cards.js";
import {BOUNTIES, DECK_SIZE, HUNTS, choose, duelFor, newSave, settle, trailDone, withDeck} from "../src/game/showdown/progress.js";
import {applyAction, createShowdown, planTurn, playTurn} from "../src/game/showdown/rules.js";
import {turnDuel} from "../src/match/showdown-turn.js";
import {attackExample} from "../src/ui/showdown-3d/attack-preview.js";
import {checkBookEntry} from "./check-character-book.mjs";

const paper = id => `[data-wanted-bounty="${id}"]`;
const paperAction = (id, action) => `${action}:is(${paper(id)}, ${paper(id)} *)`;
const build = ".character-book [data-build-book-card]";
const node = selector => `document.querySelector(${JSON.stringify(selector)})`;

// Same paid campaign setup and Cowboy policy as browser-showdown-bounty-journey.
function winAndClaim(save, id) {
  assert.ok(duelFor(save, id), `legal setup duel: ${id}`);
  const win = settle(save, id, true).save;
  return win.offer ? choose(win, win.offer[0]) : win;
}

function winningMoves({duel, seed}, opening) {
  let state = createShowdown(seed, duel.options);
  const scripted = [...(duel.prefix ?? [])];
  if (opening) scripted.push(opening);
  const moves = [];
  while (!state.result) {
    if (state.active === "wizard") {
      state = playTurn(state, duel.level).state;
    } else {
      const action = scripted.shift() ?? planTurn(state)[0];
      moves.push(action);
      state = applyAction(state, action).state;
    }
  }
  assert.equal(state.result.winner, "cowboy", duel.name);
  return moves.slice(duel.prefix?.length ?? 0); // the table has already played the scouting prefix
}

export function wantedFixtures() {
  let trail = newSave();
  while (!trailDone(trail)) trail = winAndClaim(trail, "trail");
  const hunts = BOUNTIES.map(bounty => {
    const id = `hunt:${bounty.id}`;
    const saves = [trail];
    while (saves.length < HUNTS) saves.push(winAndClaim(saves.at(-1), id));
    const before = saves.at(-1);
    const seed = 8;
    const duel = duelFor(before, id);
    const {save: captured, earned} = settle(before, id, true);
    assert.equal(before.collection[bounty.reward] ?? 0, 0);
    assert.equal(earned.captured, bounty.reward);
    assert.equal(captured.collection[bounty.reward], 1);
    assert.ok(captured.offer?.length && !captured.offer.includes(bounty.reward), "a separate bonus is on offer");
    return {bounty, saves, seed, duel, moves: winningMoves({duel, seed}), captured};
  });
  const scout = turnDuel("dragon-c5");
  return {hunts, scout, scoutMoves: winningMoves(scout, {type: "attack", slot: 0, target: 0})};
}

async function winOnTable(click, wait, moves) {
  for (const action of moves) {
    if (action.cardId) await click(`#sd-hand [data-card="${action.cardId}"]`);
    if (action.slot !== undefined) await click(`#sd-board [data-own="${action.slot}"]`);
    for (const slot of action.tributes ?? []) await click(`#sd-board [data-own="${slot}"]`);
    if (action.target !== undefined) await click(`#sd-board [data-enemy="${action.target}"]`);
    if (action.type === "cover") await click("#sd-cover");
    if (action.type === "end") await click("#sd-end");
  }
  await wait(`/You win/.test(document.querySelector('#sd-status .sd-result')?.textContent)`);
}

export async function checkWantedCollection({open, click, tap, press, activateByKey, evaluate, wait, bookIndex}) {
  const {scout, scoutMoves, hunts} = wantedFixtures();
  const career = () => evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}))`);
  const visible = selector => evaluate(`Boolean(${node(selector)}?.checkVisibility())`);
  const room = "#room-for-camp-bounties-title[open]";
  async function checkPaper(id, wins) {
    const selector = `${room} ${paper(id)}`;
    await wait(`${node(selector)}?.checkVisibility()`);
    const state = await evaluate(`(() => {
      const p = ${node(selector)}, r = p.getBoundingClientRect();
      const tally = p.querySelector(".wanted-tally");
      return {wins: p.dataset.wantedWins, marks: tally.childElementCount, filled: tally.querySelectorAll(".won").length,
        painted: getComputedStyle(p.querySelector(".wanted-portrait"), "::before").backgroundImage.includes('url("data:image/webp;'),
        stamped: Boolean(p.querySelector(".wanted-stamp")), fits: r.left >= 0 && r.right <= innerWidth + 1 && p.scrollWidth <= p.clientWidth + 1};
    })()`);
    assert.deepEqual(state, {wins: String(wins), marks: HUNTS, filled: wins, painted: true, stamped: wins === HUNTS, fits: true}, id);
  }
  async function readEntry(id) {
    await wait("document.querySelector('.character-book')?.open");
    assert.deepEqual(await checkBookEntry(evaluate, id), bookIndex.get(id), `${id} opens on its indexed page and spread`);
    const rule = ".character-book .book-rule details";
    if (!await evaluate(`${node(rule)}.open`)) await activateByKey(`${rule} summary`);
    assert.ok(await visible(`${rule} p`), `${id}'s keyword explanation is readable`);
  }
  async function browseTo(id) {
    await click(`.book-tabs [data-side="${TYPES[id].side}"]`);
    const portrait = `.book-portrait[data-id="${id}"]`;
    for (let page = 0; page < bookIndex.size; page++) {
      if (await visible(portrait)) return click(portrait);
      await click(".book-pages button:last-child:not(:disabled)");
    }
    assert.fail(`${id} missing from the book`);
  }
  const dragon = "graveyard-dragon", wraith = "lantern-wraith";
  await open("");
  assert.equal(await evaluate("document.documentElement.clientWidth"), 390, "phone-width layout");
  await activateByKey("#menu-saloon");
  await activateByKey("[data-saloon-wanted]");
  assert.ok(await evaluate(`(() => {
    const action = document.querySelector("#camp-scout-dragon .wanted-action");
    const rect = action.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight;
  })()`), "the free scout is visible before the first scroll on a fresh phone-width board");
  for (const {bounty} of hunts) {
    await checkPaper(bounty.id, 0);
    assert.ok(!await visible(paperAction(bounty.id, "[data-duel]:not(:disabled)")), "fresh careers cannot start paid hunts");
  }
  const beforeScout = await evaluate("({...localStorage})");
  const wraithBook = paperAction(wraith, "button[data-book-card]");
  await tap(wraithBook);
  await readEntry("wizard-lantern-wraith");
  assert.ok(!await visible(build), "a Wizard reference cannot launch the Cowboy builder");
  await browseTo("cowboy-captured-wraith");
  assert.ok(!await visible(build), "browsing an unearned Cowboy form cannot build it");
  await press("Escape", 27);
  await wait(`document.activeElement.matches(${JSON.stringify(wraithBook)})`);

  const scoutButton = paperAction(dragon, ":is(button, a[href]):not(:disabled, [data-book-card])");
  await activateByKey(scoutButton);
  await click('#replay-room [data-branch="dragon"]');
  await click("#replay-room .rr-play");
  assert.match(await evaluate("document.getElementById('sd-status').innerText"), new RegExp(`turn ${scout.duel.at}\\b`, "i"));
  await winOnTable(click, wait, scoutMoves);
  assert.equal(await evaluate("document.querySelectorAll('#sd-result :is([data-choose], [data-open-capture-book], [data-build-capture])').length"), 0);
  assert.equal(await evaluate("document.getElementById('sd-camp').innerText"), "Back to Wanted");
  await activateByKey("#sd-camp");
  await wait(`document.activeElement.matches(${JSON.stringify(scoutButton)})`);
  assert.deepEqual(await evaluate("({...localStorage})"), beforeScout, "even winning the scout preserves all saved keys");

  for (const {bounty, saves, seed, duel, moves, captured} of hunts) {
    const route = `?room=wanted&seed=${seed}`;
    const poster = paper(bounty.id);
    const reward = bounty.reward;
    const capturedBook = paperAction(bounty.id, "button[data-book-card]");
    for (const [wins, save] of saves.entries()) {
      await evaluate(`localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(JSON.stringify(save))})`);
      await open(route);
      await checkPaper(bounty.id, wins);
    }
    await checkPaper(bounty.id === dragon ? wraith : dragon, 0);
    await click(paperAction(bounty.id, `[data-duel="${duel.id}"]`));
    assert.ok((await evaluate("document.getElementById('sd-status').innerText")).includes(duel.name), duel.name);
    if (bounty.id === dragon) {
      await click("#showdown .book-launch");
      await browseTo("cowboy-covered-wagon");
      assert.ok(!await visible(build), "an owned Trail reward cannot leave the live paid hunt for the builder");
      await press("Escape", 27);
      await wait("document.activeElement.matches('#showdown .book-launch')");
    }
    await winOnTable(click, wait, moves);
    const captureButton = `#sd-result [data-open-capture-book="${reward}"]`;
    await wait(`${node(captureButton)}?.checkVisibility()`);
    assert.deepEqual(await career(), captured, "the fifth win pays exactly once, before any bonus choice");
    const offers = await evaluate("[...document.querySelectorAll('#sd-result [data-choose]')].map(b => b.dataset.choose)");
    assert.deepEqual(offers.sort(), [...captured.offer].sort());
    await activateByKey(captureButton);
    await readEntry(reward);
    assert.ok(await visible(build), "the earned Cowboy can be built from its capture");
    const example = attackExample(reward, "attack");
    if (bounty.id === dragon) {
      assert.equal(await evaluate(`${node(".book-watch")}.innerText`), "Watch Sweep");
      assert.ok(example.trace[0].events.some(event => event.type === "sweep"));
    }
    await click(".book-watch");
    await wait("document.querySelector('.sd-gallery.book-replay')?.open");
    const canvas = `.book-replay .sd-attack-world[data-card-art="${reward}"][data-preview-mode="attack"]`;
    await wait(`${node(canvas)}?.checkVisibility()`);
    assert.equal(await evaluate("document.querySelector('.sd-attack-result').innerText"), example.summary);
    await press("Escape", 27);
    await wait("document.activeElement.matches('.book-watch')");
    await readEntry(reward);

    // Build the Dragon at the verdict with its bonus outstanding. Claim the Wraith bonus and build from Camp.
    let expected = captured;
    if (bounty.id === wraith) {
      await press("Escape", 27);
      await wait(`document.activeElement.matches(${JSON.stringify(captureButton)})`);
      await click(`#sd-result [data-choose="${offers[0]}"]`);
      expected = choose(captured, offers[0]);
      await wait(`JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).offer === null`);
      assert.deepEqual(await career(), expected, "taking the bonus retains the separate capture");
      await open(route);
      await checkPaper(bounty.id, HUNTS);
      await tap(capturedBook);
      await readEntry(reward);
    }
    await click(build);
    const deckStep = (type, by) => `[data-zone="deck"][data-type="${type}"][data-by="${by}"]`;
    await wait(`document.activeElement.matches(${JSON.stringify(deckStep(reward, 1))})`);
    await click("#builder-cancel");
    await readEntry(reward);
    await press("Escape", 27);
    const origin = bounty.id === wraith ? capturedBook : captureButton;
    await wait(`document.activeElement.matches(${JSON.stringify(origin)})`);
    assert.deepEqual(await career(), expected, "backing out returns to the same source and leaves its bonus and deck intact");
    await activateByKey(origin);
    await readEntry(reward);
    await click(build);
    await wait(`document.activeElement.matches(${JSON.stringify(deckStep(reward, 1))})`);
    await press("Enter", 13);
    assert.ok(await evaluate("document.getElementById('builder-save').disabled"), "cannot save a seventeenth card");
    assert.deepEqual(await career(), expected, "the draft has not overwritten the equipped deck");
    const replace = Object.keys(expected.deck)[0];
    await click(deckStep(replace, -1));
    expected = withDeck(expected, {...expected.deck, [reward]: 1, [replace]: expected.deck[replace] - 1}, expected.side);
    assert.equal(Object.values(expected.deck).reduce((n, count) => n + count, 0), DECK_SIZE);
    await click("#builder-save");
    await wait(`JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).deck[${JSON.stringify(reward)}] === 1`);
    await open(route);
    await checkPaper(bounty.id, HUNTS);
    assert.deepEqual(await career(), expected, "deck replacement, collection and bonus choice survive reload");
    assert.ok((await evaluate(`${node(poster)}.innerText`)).toLowerCase().includes(TYPES[reward].name.toLowerCase()), "the poster names the captured form");
    assert.ok(!await visible(paperAction(bounty.id, "[data-duel]:not(:disabled)")), "the completed bounty cannot pay again");
    await activateByKey(capturedBook);
    await readEntry(reward);
    assert.match(await evaluate(`${node(".book-ownership")}.innerText`), /\b1\b/, TYPES[reward].name);
    const other = hunts.find(hunt => hunt.bounty.id !== bounty.id).bounty.reward;
    await browseTo(other);
    assert.ok(!await visible(build), "reopening a capture does not authorize building the other bounty");
    await browseTo(bounty.boss);
    await checkBookEntry(evaluate, bounty.boss);
    assert.ok(!await visible(build), "the Wizard original cannot build the owned Cowboy form");
    assert.deepEqual(await career(), expected, "reopening the poster and book pays nothing");
    await press("Escape", 27);
  }
  await activateByKey(paperAction(dragon, "button[data-book-card]"));
  await readEntry("cowboy-captured-dragon");
  const reset = newSave();
  // A second same-origin browsing context changes the persisted campaign while this book is open.
  await evaluate(`(() => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    frame.contentWindow.localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(JSON.stringify(reset))});
    frame.remove();
  })()`);
  await click(build);
  await wait("!document.querySelector('.character-book').open && document.getElementById('camp-changed').checkVisibility()");
  assert.ok(!await visible("#builder-save"), "an expired collection cannot open a draft for a lost card");
  assert.deepEqual(await career(), reset, "the other context's new campaign remains authoritative");
}
