import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {EFFECTS, KEYWORDS, TYPES, tributes} from "../src/game/showdown/cards.js";
import {SAVE_KEY} from "../src/game/showdown/campaign-store.js";
import {replayCards} from "../src/ui/showdown-3d/replay-cards.js";
import {attackExample} from "../src/ui/showdown-3d/attack-preview.js";

const handAtlasHash = readFile(new URL("../assets/cards/showdown-diorama.webp", import.meta.url))
  .then(bytes => createHash("sha256").update(bytes).digest("hex"));

// Also used on arrival from a Wanted paper or capture, before touching the index.
export async function checkBookEntry(evaluate, id) {
  const card = TYPES[id];
  const entry = await evaluate(`(async () => {
    const book = document.querySelector(".character-book[open]");
    const face = book.querySelector(".book-hero .table-card-face .sd-card-art");
    const portrait = book.querySelector('.book-portrait[aria-pressed="true"]');
    const sprite = getComputedStyle(face);
    const thumb = getComputedStyle(portrait.querySelector(".sd-card-art"));
    const data = sprite.backgroundImage.match(/^url\\("data:image[/]webp;base64,([^"]+)"\\)$/);
    if (!data) throw new Error("Missing duel hand atlas");
    const bytes = Uint8Array.from(atob(data[1]), c => c.charCodeAt(0));
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map(n => n.toString(16).padStart(2, "0")).join("");
    return {
      side: book.querySelector('.book-tabs [aria-pressed="true"]').dataset.side,
      portrait: portrait.dataset.id,
      page: book.querySelector(".book-pages span").textContent,
      spread: [...book.querySelectorAll(".book-portrait")].map(button => button.dataset.id),
      name: book.querySelector("h3").textContent,
      hash, cell: sprite.backgroundPosition,
      printed: face.closest(".table-card-face").querySelector(".table-card-title").textContent,
      painted: face.checkVisibility() && portrait.checkVisibility() && sprite.backgroundImage === thumb.backgroundImage && sprite.backgroundPosition === thumb.backgroundPosition,
      fits: book.scrollWidth <= book.clientWidth + 1,
      stats: Object.fromEntries([...book.querySelectorAll(".book-stats div")].map(stat => [stat.firstChild.textContent, Number(stat.lastChild.textContent)])),
      keywords: [...book.querySelectorAll(".book-rule details")].map(rule => [rule.querySelector("summary").textContent, rule.querySelector("p").textContent]),
      effect: book.querySelector(".book-rule").textContent,
      canWatch: !book.querySelector(".book-watch").hidden
    };
  })()`);
  assert.equal(entry.side, card.side, id);
  assert.equal(entry.portrait, id, "the selected portrait is on the current spread");
  assert.equal(entry.name, card.name);
  assert.ok(entry.painted && entry.fits, `${id} shows its painting and fits the spread`);
  const tile = Object.keys(TYPES).indexOf(id);
  assert.equal(entry.hash, await handAtlasHash, `${id} uses the battle hand atlas`);
  assert.equal(entry.cell, `${(tile % 6) * 20}% ${Math.floor(tile / 6) * 20}%`, `${id} shows its own character`);
  assert.equal(entry.printed, card.name);
  if (card.kind === "troop") {
    assert.deepEqual(entry.stats, {Attack: card.attack, Orbs: card.health, Stars: card.stars, Tribute: tributes(id)});
    assert.deepEqual(entry.keywords, card.keys.map(key => KEYWORDS[key]), id);
    assert.ok(entry.canWatch, id);
  } else {
    assert.deepEqual(entry.stats, {});
    assert.equal(entry.effect, EFFECTS[card.effect].text);
  }
  return {page: entry.page, cards: entry.spread};
}

async function checkPracticeFace({click, evaluate, wait}, id) {
  const card = TYPES[id];
  const selector = `#sd-hand [data-card^="${id}-"]`;
  const printed = await evaluate("document.querySelector('.book-hero .table-card-face').innerHTML");
  await click(".book-practice");
  await wait(`document.querySelector('${selector} .sd-card-art')?.checkVisibility()`);
  const hand = await evaluate(`(() => {
    const button = document.querySelector('${selector}');
    const face = button.querySelector('.table-card-face');
    const art = face.querySelector('.sd-card-art');
    const sprite = getComputedStyle(art);
    const book = getComputedStyle(document.querySelector('.book-hero .sd-card-art'));
    const drawn = node => node.checkVisibility({opacityProperty: true, visibilityProperty: true}) &&
      node.getBoundingClientRect().height > 0;
    return {
      printed: face.innerHTML, description: document.getElementById(button.getAttribute('aria-describedby'))?.textContent, copy: face.querySelector('.table-card-copy').innerText,
      rule: face.querySelector('.table-card-rule')?.innerText,
      stats: Object.fromEntries([...face.querySelectorAll('[data-stat]')].filter(drawn)
        .map(stat => [stat.dataset.stat, stat.innerText.match(/[0-9]+/)?.[0]])),
      samePainting: drawn(art) &&
        sprite.backgroundImage === book.backgroundImage && sprite.backgroundPosition === book.backgroundPosition
    };
  })()`);
  assert.equal(hand.printed, printed, `${id} has the exact book face in its real hand`);
  assert.ok(hand.samePainting, `${id} shows its own book painting in the duel`);
  assert.doesNotMatch(hand.copy, /enemy troop|enemy attack|carrier|all (lawman|undead) troops|uncovered|sent to|when it/i, id);
  if (card.kind === "troop") {
    assert.equal(hand.stats.attack, String(card.attack), `${id} shows attack`);
    assert.equal(hand.stats.health, String(card.health), `${id} shows orbs`);
    if (tributes(id)) assert.equal(hand.stats.tribute, String(tributes(id)), `${id} shows tribute cost`);
  } else assert.ok(hand.rule?.trim(), `${id} shows its effect badge`);

  await click(".table-hand-rules > summary");
  const inspected = await evaluate(`[...document.querySelectorAll('.table-hand-rules[open] p')]
    .find(p => p.checkVisibility() && p.querySelector('strong')?.textContent === ${JSON.stringify(card.name)})?.innerText`);
  assert.ok(inspected, `${id} can be inspected from the hand`);
  const rules = card.kind === "troop" ? [
    `${card.attack} attack`, `${card.health} orb`, ...card.keys.map(key => KEYWORDS[key][1]),
    tributes(id) ? `${tributes(id)} of your troops, sent to the graveyard` : "Cost: none"
  ] : [EFFECTS[card.effect].text];
  if (EFFECTS[card.effect]?.target) rules.push("Cannot target Ghostly troops.");
  if (card.kind === "location") rules.push("Applies to both sides.");
  for (const rule of rules) {
    assert.ok(inspected.includes(rule), `${id} hand inspection explains "${rule}"`);
    assert.ok(hand.description?.includes(rule), `${id} accessible description explains "${rule}"`);
  }
  await click("[data-close-hand-rules]");
  if (id === "cowboy-billy") {
    assert.equal(await evaluate("document.querySelector('#sd-home').textContent"), "Back to book");
    await click('#sd-board [data-own="0"]');
    await click('#sd-board [data-enemy="0"]');
    await wait(`document.querySelector('#sd-board [data-slot="wizard-0"] .sd-orbs')?.getAttribute('aria-label') === '2 of 4 orbs'`);
  }
  await click("#sd-home");
  await wait(`document.querySelector('.character-book[open] .book-portrait[aria-pressed=true]')?.dataset.id === "${id}"`);
}

// Play the staged book through its pages and launchers, including a troop a new player does not own.
export async function checkCharacterBook({open, click, press, evaluate, wait}) {
  await open("");
  await wait("document.querySelector('#title-screen details:not([open]) > summary[data-title-more]')?.checkVisibility()");
  await click("#title-screen summary[data-title-more]");
  await click("#title-screen details[open] .book-launch");
  await wait("document.querySelector('.character-book[open] .book-portrait[aria-pressed=true]')?.checkVisibility()");
  await press("Escape", 27);
  await wait("!document.querySelector('.character-book').open && document.activeElement.matches('#title-screen .book-launch')");

  await open("?book=1");
  await wait("document.querySelector('.character-book')?.open");
  const career = () => evaluate(`localStorage.getItem(${JSON.stringify(SAVE_KEY)})`);
  const before = await career();
  const index = new Map();
  for (const side of ["cowboy", "wizard"]) {
    await click(`.book-tabs [data-side="${side}"]`);
    for (;;) {
      const ids = await evaluate("[...document.querySelectorAll('.book-portrait')].map(b => b.dataset.id)");
      assert.ok(ids.length > 0);
      for (const id of ids) {
        assert.ok(!index.has(id), `each spread turns to new cards: ${id}`);
        const card = TYPES[id];
        assert.equal(card.side, side);
        await click(`.book-portrait[data-id="${id}"]`);
        index.set(id, await checkBookEntry(evaluate, id));
        await checkPracticeFace({click, evaluate, wait}, id);
      }
      if (await evaluate("document.querySelector('.book-pages button:last-child').disabled")) break;
      await click(".book-pages button:last-child");
    }
  }
  assert.deepEqual([...index.keys()].sort(), Object.keys(TYPES).sort());
  assert.equal(await career(), before, "book practice leaves the prior campaign intact");

  await click('.book-tabs [data-side="cowboy"]');
  await click('.book-portrait[data-id="cowboy-mounted-billy"]');
  assert.equal(await evaluate("document.querySelector('.book-ownership').textContent"), "Uncollected");
  await click(".book-watch");
  await wait("document.querySelector('.sd-gallery.book-replay')?.open");
  assert.equal(await evaluate("document.getElementById('sd-gallery-heading').textContent"), TYPES["cowboy-mounted-billy"].name);
  await click('.book-replay [data-attack-mode="ride"]');
  const ride = replayCards("cowboy-mounted-billy", attackExample("cowboy-mounted-billy", "ride"));
  await wait(`document.querySelector('.sd-attack-result').textContent === ${JSON.stringify(ride.outcome)}`);
  await press("Escape", 27);
  await wait("!document.querySelector('.sd-gallery').open && document.activeElement.matches('.book-watch')");
  assert.equal(await evaluate("document.querySelector('.book-portrait[aria-pressed=true]').dataset.id"), "cowboy-mounted-billy");
  await press("Escape", 27);
  await wait("!document.querySelector('.character-book').open && document.activeElement.matches('#title-screen .book-launch')");
  assert.equal(await career(), before, "browsing and playing a move keeps the career intact");

  await open("?practice=0");
  await wait("document.querySelector('#sd-hand button[data-card]:not(:disabled)')?.checkVisibility()");
  await click("#sd-hand button[data-card]:not(:disabled)");
  await click('#sd-board [data-own="0"]');
  assert.ok(await evaluate("document.querySelector('#sd-cover').checkVisibility()"), "the Sheriff has a pending cover choice");
  const prompt = () => evaluate("document.getElementById('sd-prompt').textContent");
  const pending = await prompt();
  await click("#showdown .book-launch");
  await click('.book-tabs [data-side="cowboy"]');
  await click('.book-portrait[data-id="cowboy-sheriff"]');
  assert.ok(!await evaluate("document.querySelector('.character-book [data-build-book-card]:not(:disabled)')?.checkVisibility()"),
    "even an owned Cowboy cannot launch the builder from a live duel");
  await press("Escape", 27);
  await wait("!document.querySelector('.character-book').open && document.activeElement.matches('#showdown .book-launch')");
  assert.equal(await prompt(), pending, "closing the book keeps the player's pending action");
  await click("#sd-cover");
  assert.ok(!await evaluate("document.querySelector('#sd-cover').checkVisibility()"), "the pending choice can still be played");
  return index;
}
