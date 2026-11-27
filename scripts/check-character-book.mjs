import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {EFFECTS, KEYWORDS, TYPES, tributes} from "../src/game/showdown/cards.js";
import {SAVE_KEY} from "../src/game/showdown/campaign-store.js";
import {attackExample} from "../src/ui/showdown-3d/attack-preview.js";

// Also used on arrival from a Wanted paper or capture, before touching the index.
export async function checkBookEntry(evaluate, id) {
  const card = TYPES[id];
  const entry = await evaluate(`(async () => {
    const book = document.querySelector(".character-book[open]");
    const img = book.querySelector(".book-hero img");
    const portrait = book.querySelector('.book-portrait[aria-pressed="true"]');
    await img.decode();
    return {
      side: book.querySelector('.book-tabs [aria-pressed="true"]').dataset.side,
      portrait: portrait.dataset.id,
      page: book.querySelector(".book-pages span").textContent,
      spread: [...book.querySelectorAll(".book-portrait")].map(button => button.dataset.id),
      name: book.querySelector("h3").textContent,
      painting: img.currentSrc,
      painted: img.checkVisibility() && portrait.checkVisibility() && img.naturalWidth > 0 && img.src === portrait.querySelector("img").src,
      fits: book.scrollWidth <= book.clientWidth + 1,
      stats: Object.fromEntries([...book.querySelectorAll(".book-stats div")].map(stat => [stat.firstChild.textContent, Number(stat.lastChild.textContent)])),
      keywords: [...book.querySelectorAll(".book-rule details")].map(rule => [rule.querySelector("summary").innerText, rule.querySelector("p").textContent]),
      effect: book.querySelector(".book-rule").textContent,
      canWatch: !book.querySelector(".book-watch").hidden
    };
  })()`);
  assert.equal(entry.side, card.side, id);
  assert.equal(entry.portrait, id, "the selected portrait is on the current spread");
  assert.equal(entry.name, card.name);
  assert.ok(entry.painted && entry.fits, `${id} shows its painting and fits the spread`);
  const approved = await readFile(new URL(`../assets/cards/illustrated/${id}.webp`, import.meta.url), "base64");
  assert.ok(entry.painting === "data:image/webp;base64," + approved, `${id} uses its approved portrait`);
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

// Play the staged book through its pages and launchers, including a troop a new player does not own.
export async function checkCharacterBook({open, click, press, evaluate, wait}) {
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
      }
      if (await evaluate("document.querySelector('.book-pages button:last-child').disabled")) break;
      await click(".book-pages button:last-child");
    }
  }
  assert.deepEqual([...index.keys()].sort(), Object.keys(TYPES).sort());

  await click('.book-tabs [data-side="cowboy"]');
  await click('.book-portrait[data-id="cowboy-mounted-billy"]');
  assert.equal(await evaluate("document.querySelector('.book-ownership').textContent"), "Uncollected");
  await click(".book-watch");
  await wait("document.querySelector('.sd-gallery.book-replay')?.open");
  assert.equal(await evaluate("document.getElementById('sd-gallery-heading').textContent"), TYPES["cowboy-mounted-billy"].name);
  await click('.book-replay [data-attack-mode="ride"]');
  assert.equal(await evaluate("document.querySelector('.sd-attack-result').innerText"), attackExample("cowboy-mounted-billy", "ride").summary);
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
