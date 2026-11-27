// Run after node scripts/build-graybox.mjs --diorama, with playwright-core and Chromium installed.
// npx -p playwright-core@1.64.1 node tests/match/character-book-replay.browser.mjs [built HTML]
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {createRequire} from "node:module";
import path from "node:path";
import {pathToFileURL} from "node:url";

const bin = process.env.PATH.split(path.delimiter).find(dir => existsSync(path.join(dir, "playwright-core")));
const require = createRequire(bin ? path.join(bin, "..", "package.json") : import.meta.url);
const {chromium} = require("playwright-core");
const site = pathToFileURL(path.resolve(process.argv[2] ?? "dist/cowboys-vs-wizards-showdown-3d.html"));
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH, args: ["--enable-unsafe-swiftshader"]});

async function checkReplay(viewport, {reduced = false, noWebGL = false} = {}) {
  const page = await browser.newPage({viewport, isMobile: true, hasTouch: true, reducedMotion: reduced ? "reduce" : "no-preference"});
  try {
    if (noWebGL) await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return /webgl/i.test(type) ? null : getContext.call(this, type, ...args);
      };
    });
    await page.goto(site.href);
    const launch = page.locator("#title-screen .book-launch");
    await launch.click();
    const book = page.locator(".character-book[open]");
    const billy = book.locator('[data-id="cowboy-mounted-billy"]');
    await billy.click();
    const watch = book.locator(".book-watch");
    if (noWebGL) await page.locator(".sd-replay-cards").evaluate(cards => {
      cards.targetStates = [];
      // Record each visible target change so a slow browser driver cannot miss the contact frame.
      new MutationObserver(() => {
        const target = cards.querySelector("figure:last-child figcaption strong");
        if (!cards.hidden && cards.dataset.state === "before" && target) cards.targetStates.push(target.textContent);
      }).observe(cards, {attributes: true, childList: true, characterData: true, subtree: true});
    });
    await watch.click();

    const dialog = page.locator(".sd-gallery.book-replay[open]");
    assert.equal(await dialog.locator("h2").innerText(), "Mounted Billy");
    assert.equal(await dialog.locator(".sd-gallery-story, .sd-gallery-subject, .sd-gallery-cue").filter({visible: true}).count(), 0);
    const cards = dialog.locator(".sd-replay-cards");
    const world = dialog.locator(".sd-attack-world");
    const result = dialog.locator(".sd-attack-result");
    const again = dialog.locator('[data-attack-mode="attack"]');
    const ride = dialog.locator('[data-attack-mode="ride"]');
    assert.equal(await again.evaluate(button => button === document.activeElement), true);
    assert.equal(await world.evaluate(canvas => canvas.tabIndex < 0 && canvas.getAttribute("aria-hidden") === "true"), true);
    async function checkMove(mode, expected) {
      if (noWebGL || reduced) {
        await dialog.locator('.sd-replay-cards[data-state="after"]').waitFor();
        if (noWebGL) {
          const marks = await cards.evaluate(el => el.targetStates.splice(0));
          assert.equal(marks[0], mode === "ride" ? "5 orbs" : "3 orbs");
          assert.ok(marks.includes(mode === "ride" ? "5 orbs → 4 orbs" : "3 orbs → Defeated"), "target changes at contact");
        }
        assert.equal(await world.isVisible(), false);
        const faces = cards.locator(".sd-card-art");
        assert.equal(await faces.count(), mode === "ride" ? 1 : 2);
        assert.ok(await faces.evaluateAll(items => {
          const first = getComputedStyle(items[0]), hero = getComputedStyle(document.querySelector(".book-hero .sd-card-art"));
          return first.backgroundImage.startsWith('url("data:image/webp;') && first.backgroundImage === hero.backgroundImage &&
            first.backgroundPosition === hero.backgroundPosition;
        }), "the fallback shows the selected battle portrait");
        assert.match(await cards.innerText(), /Mounted Billy/);
        assert.match(await cards.innerText(), mode === "ride" ? /Base/i : /Skeleton/);
        assert.match(await cards.innerText(), mode === "ride" ? /4\s*orbs?/i : /defeated/i);
      } else {
        await dialog.locator(`.sd-attack-world[data-preview-mode="${mode}"][data-motion]`).waitFor();
      }
      await result.filter({hasText: expected}).waitFor();
      assert.equal(await result.innerText(), expected);
      for (const frame of [dialog, dialog.locator(".sd-gallery-main")]) {
        assert.ok(await frame.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1),
          "the replay fits without scrolling");
      }
      const controls = [dialog, dialog.locator(".sd-gallery-main"), reduced || noWebGL ? cards : world,
        result, again, ride, dialog.locator(".sd-gallery-close")];
      for (const element of controls) {
        const box = await element.boundingBox();
        assert.ok(box && box.width > 0 && box.height > 0 && box.x >= -1 && box.y >= -1 &&
          box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1,
          `replay, outcome and controls fit ${viewport.width}×${viewport.height}: ${JSON.stringify(box)}`);
      }
    }
    await checkMove("attack", "Skeleton defeated");
    assert.match(await again.innerText(), /replay/i);
    await again.click();
    await checkMove("attack", "Skeleton defeated");
    await ride.click();
    await checkMove("ride", "Wizard Base 5 → 4");
    if (reduced || noWebGL) await dialog.getByRole("button", {name: /back to book/i}).click();
    else await page.keyboard.press("Escape");
    await dialog.waitFor({state: "hidden"});
    assert.equal(await watch.evaluate(button => button === document.activeElement), true);
    assert.equal(await billy.getAttribute("aria-pressed"), "true");
    await page.keyboard.press("Escape");
    assert.equal(await launch.evaluate(button => button === document.activeElement), true);
    console.log(`ok ${viewport.width}×${viewport.height} ${noWebGL ? "no WebGL" : reduced ? "reduced motion" : "WebGL"}`);
  } finally {
    await page.close();
  }
}

try {
  const portrait = {width: 375, height: 667}, landscape = {width: 740, height: 375};
  await checkReplay(portrait);
  await checkReplay(landscape);
  await checkReplay(portrait, {noWebGL: true});
  await checkReplay(landscape, {reduced: true});
} finally {
  await browser.close();
}
