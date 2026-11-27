import assert from "node:assert/strict";
import {EFFECTS, TYPES, tributes} from "../src/game/showdown/cards.js";
import {SAVE_KEY} from "../src/game/showdown/campaign-store.js";
import {attackExample} from "../src/ui/showdown-3d/attack-preview.js";

// Play the staged book through its pages and launchers, including a troop a new player does not own.
export async function checkCharacterBook({open, click, press, evaluate, wait}) {
  await open("?book=1");
  await wait("document.querySelector('.character-book')?.open");
  const career = () => evaluate(`localStorage.getItem(${JSON.stringify(SAVE_KEY)})`);
  const before = await career();
  const seen = [];
  for (const side of ["cowboy", "wizard"]) {
    await click(`.book-tabs [data-side="${side}"]`);
    for (;;) {
      const ids = await evaluate("[...document.querySelectorAll('.book-portrait')].map(b => b.dataset.id)");
      assert.ok(ids.length > 0 && ids.every(id => !seen.includes(id)), "each spread turns to new cards");
      for (const id of ids) {
        const card = TYPES[id];
        assert.equal(card.side, side);
        await click(`.book-portrait[data-id="${id}"]`);
        const entry = await evaluate(`(async () => {
          const book = document.querySelector(".character-book");
          const img = book.querySelector(".book-hero img");
          await img.decode();
          return {
            name: book.querySelector("h3").textContent,
            painted: img.naturalWidth > 0 && img.src === book.querySelector('.book-portrait[aria-pressed="true"] img').src,
            stats: Object.fromEntries([...book.querySelectorAll(".book-stats div")].map(stat => [stat.firstChild.textContent, Number(stat.lastChild.textContent)])),
            effect: book.querySelector(".book-rule").textContent,
            canWatch: !book.querySelector(".book-watch").hidden
          };
        })()`);
        assert.equal(entry.name, card.name);
        assert.ok(entry.painted, id);
        assert.ok(await evaluate("document.querySelector('.character-book').scrollWidth <= document.querySelector('.character-book').clientWidth + 1"), `${id} fits the spread`);
        if (card.kind === "troop") {
          assert.deepEqual(entry.stats, {Attack: card.attack, Orbs: card.health, Stars: card.stars, Tribute: tributes(id)});
          assert.ok(entry.canWatch, id);
        } else {
          assert.deepEqual(entry.stats, {});
          assert.equal(entry.effect, EFFECTS[card.effect].text);
        }
        seen.push(id);
      }
      if (await evaluate("document.querySelector('.book-pages button:last-child').disabled")) break;
      await click(".book-pages button:last-child");
    }
  }
  assert.deepEqual(seen.sort(), Object.keys(TYPES).sort());

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
  const prompt = () => evaluate("document.getElementById('sd-prompt').textContent");
  const pending = await prompt();
  await click("#showdown .book-launch");
  await press("Escape", 27);
  await wait("!document.querySelector('.character-book').open && document.activeElement.matches('#showdown .book-launch')");
  assert.equal(await prompt(), pending, "closing the book keeps the player's pending action");
}
