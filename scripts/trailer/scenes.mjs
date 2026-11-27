import assert from "node:assert/strict";

const play = "#menu-challenge";
const own = '#sd-board [data-own="0"]';
const troop = '#sd-board [data-enemy="0"]';
const base = '#sd-board [data-enemy="base"]';
const book = '.saloon-book-dock .character-book[open]';
const forge = '.forge-hellfire';
const journal = '[data-saloon-show="journal"]';
const shift = '[data-saloon-show="shift"]';
const step = '.saloon-step';
const decision = '.saloon-decision';
const receipts = new WeakMap();

// A locator's automatic stability wait needs animation frames. Only use that wait during setup.
// During capture, locate the live control immediately and send a normal pointer or keyboard action.
async function activate(page, selector) {
  const point = await page.evaluate(selector => {
    const control = [...document.querySelectorAll(selector)].find(el => el.checkVisibility());
    if (!control || control.matches(':disabled, [aria-disabled="true"]')) throw Error(`Unavailable control: ${selector}`);
    function hitPoint() {
      const r = control.getBoundingClientRect();
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      return control.contains(document.elementFromPoint(x, y)) ? { x, y } : null;
    }
    const original = hitPoint();
    if (original) return original;
    control.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    const scrolled = hitPoint();
    if (scrolled) return scrolled;
    control.focus({ preventScroll: true });
    if (document.activeElement !== control) throw Error(`Cannot reach control: ${selector}`);
    return null;
  }, selector);
  if (point) await page.mouse.click(point.x, point.y);
  else await page.keyboard.press('Enter');
}

async function frameElement(page, selector, block = 'center') {
  await page.evaluate(({selector, block}) => {
    const element = [...document.querySelectorAll(selector)].find(el => el.checkVisibility());
    if (!element) throw Error(`Missing shot subject: ${selector}`);
    element.scrollIntoView({ block, inline: 'nearest', behavior: 'instant' });
  }, {selector, block});
}

async function read(page, selector) {
  return page.evaluate(s => document.querySelector(s)?.textContent.trim() ?? '', selector);
}

async function record(page, key, selector, expected) {
  const value = await read(page, selector);
  assert.match(value, expected, `${key}: ${value}`);
  receipts.get(page)[key] = value;
}

export async function prepareScene(id, {page, baseUrl}) {
  receipts.set(page, {});
  const route = {opening: '?seed=0', outrider: '?seed=0', book: '?saloon=play', forge: '?saloon=play',
    poker: 'poker/?seed=17', journal: '?saloon=play', refusal: '?saloon=play', audit: '?saloon=review'}[id];
  if (!route) throw Error(`Unknown trailer scene: ${id}`);
  const response = await page.goto(new URL(route, baseUrl).href, {waitUntil: 'load'});
  if (!response?.ok()) throw Error(`Game did not load: ${route}`);
  if (id === 'opening' || id === 'outrider') {
    await page.locator(play).waitFor();
    if (id === 'opening') {
      await page.evaluate(async () => {
        for (const [selector, pseudo] of [['.opening-stage', '::before'], ['.opening-billy'], ['.opening-wizard']]) {
          const image = new Image();
          image.src = getComputedStyle(document.querySelector(selector), pseudo).backgroundImage.slice(5, -2);
          await image.decode();
        }
      });
    } else {
      await activate(page, play);
      await page.locator(own).waitFor();
      await record(page, 'attacker', own + ' strong', /Outrider/);
    }
    return;
  }
  if (id === 'poker') {
    await page.locator('button[data-key="1"]').waitFor();
    await record(page, 'deal', '#screen', /Deal 1\s+Seed 17/);
    return;
  }
  await page.locator(book).waitFor();
  if (id === 'book') {
    await record(page, 'firstPage', book + ' .book-entry h3', /Billy/);
    return;
  }
  if (id === 'forge') {
    await activate(page, '[data-saloon-show="forge"]');
    await page.locator(forge + ' button[value="all"]').waitFor();
    return;
  }
  await activate(page, journal);
  await activate(page, shift);
  await page.locator(step).waitFor();
  if (id === 'audit') {
    await page.locator(decision).waitFor();
    await frameElement(page, decision);
  } else {
    if (id === 'refusal') await activate(page, step);
    await frameElement(page, '.saloon-theater');
  }
}

export async function actScene(id, frame, {page}) {
  if (id === 'opening') {
    if (frame === 0 || frame === 75) {
      const pose = await page.evaluate(() => getComputedStyle(document.querySelector('.opening-billy')).backgroundPosition);
      receipts.get(page)[frame === 0 ? 'holstered' : 'drawn'] = pose;
    }
    if (frame === 133) {
      const {x, y} = await page.evaluate(selector => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return {x: box.x + box.width / 2, y: box.y + box.height / 2};
      }, play);
      await page.mouse.move(x, y);
    }
  } else if (id === 'outrider') {
    if (frame === 33 || frame === 325) await activate(page, own);
    if (frame === 112) await activate(page, troop);
    if (frame === 248) await record(page, 'fight', '#sd-feedback', /Outrider attacked/i);
    if (frame === 265) await activate(page, '#sd-restart');
    if (frame === 395) await activate(page, base);
  } else if (id === 'book') {
    if (frame === 26) await activate(page, book + ' .book-pages [aria-label="Next page"]');
    if (frame === 50) await record(page, 'secondPage', book + ' .book-entry h3', /Outrider/);
    if (frame === 67) await activate(page, book + ' .book-pages [aria-label="Previous page"]');
    if (frame === 92) await activate(page, book + ' [data-id="cowboy-billy"]');
    if (frame === 138) await activate(page, book + ' .book-practice');
    if (frame === 202) await activate(page, own);
    if (frame === 253) await activate(page, troop);
  } else if (id === 'forge') {
    if (frame === 44) await activate(page, forge + ' button[value="all"]');
    if (frame === 111) await record(page, 'firstCast', forge + ' [data-verdict]', /fails on this board/);
    if (frame === 161) await activate(page, forge + ' [data-retry]');
    if (frame === 216) await activate(page, forge + ' button[value="enemy"]');
  } else if (id === 'poker') {
    const key = {42: '1', 90: '2', 139: '4', 211: 'Enter'}[frame];
    if (key) await activate(page, `button[data-key="${key}"]`);
  } else if (id === 'journal') {
    if (frame === 34) await activate(page, step);
    if (frame === 37) await frameElement(page, '.saloon-theater');
    if (frame === 119) await activate(page, step);
    if (frame === 205) await activate(page, step);
    if (frame === 210) await frameElement(page, '.saloon-theater');
  } else if (id === 'refusal') {
    if (frame === 53) await activate(page, step);
    if (frame === 56) await frameElement(page, '.saloon-theater');
  } else if (id === 'audit') {
    if (frame === 69) await activate(page, '.saloon-audit > summary');
    if (frame === 72) await frameElement(page, decision);
  }
}

export async function verifyScene(id, {page}) {
  if (id === 'opening') {
    const {holstered, drawn} = receipts.get(page);
    assert.notEqual(holstered, drawn, `Billy should draw on the title screen (${drawn})`);
    await activate(page, play);
    await record(page, 'play', own + ' strong', /Outrider/);
  } else if (id === 'outrider') {
    await record(page, 'ride', '#sd-feedback', /Outrider struck the Wizards' Base for 1/i);
  } else if (id === 'book') {
    await record(page, 'attack', '#sd-log', /Billy attacked Wizard and left it on 2/i);
    assert.equal(await page.locator('#sd-board [data-slot="wizard-0"] .sd-orbs').getAttribute('aria-label'), '2 of 4 orbs');
  } else if (id === 'forge') {
    await record(page, 'result', forge + ' [data-verdict]', /matches this cast/);
    await record(page, 'sheriff', forge + ' [data-cowboy]', /3 → 2/);
    await record(page, 'skeleton', forge + ' [data-wizard]', /3 → 3/);
  } else if (id === 'poker') {
    const screen = await read(page, '#screen');
    const win = screen.match(/The Cowboy wins: Pair of Eights beats Pair of Sevens\./);
    assert.ok(win, screen);
    receipts.get(page).deal = 'Deal 1, seed 17';
    receipts.get(page).result = win[0];
  } else if (id === 'journal' || id === 'refusal') {
    await record(page, 'source', '.saloon-mode-label', /Recorded Kiro shift/);
    await record(page, 'step', '.saloon-progress', id === 'refusal' ? /step 2 of/ : /step 3 of/);
    await record(page, 'event', '.saloon-now', id === 'refusal' ? /refuses a tool call or file write outside the task.s scope/i : /Billy/i);
  } else if (id === 'audit') {
    assert.ok(await page.locator('.saloon-audit[open]').count());
    await record(page, 'status', decision + ' dl dd', /awaits design approval.*has attack 2 in this build/);
    await record(page, 'results', '.saloon-audit dl', /100,000 recorded Node engine duels/);
  }
  return receipts.get(page);
}
