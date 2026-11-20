// Issue 143 slices 1 and 2: real-browser acceptance check of the graybox Showdown entry and Camp.
//   node scripts/build-graybox.mjs
//   node scripts/browser-showdown-check.mjs dist/cowboys-vs-wizards-board-duel.html [outDir]
// Native headless Chrome with a fresh profile, driven only by mouse events over the DevTools
// protocol (same isolated Chrome launch as browser-menu-check.mjs). It checks that Play on a clean
// profile opens the Camp and Boot Hill, that Trail duels 1 and 2 can be won by clicks alone (?seed=0)
// and pay their designed cards and a one-card choice, that reloads keep the progress, seat privacy,
// action legality and visible feedback at every step, and that ?mode=lanes and ?mode=match still load the lane duel.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTH = 1440, HEIGHT = 900;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!process.argv[2]) throw new Error("Pass the built graybox HTML file");
const page = pathToFileURL(path.resolve(process.argv[2])).href;
const out = path.resolve(process.argv[3] ?? ".artifacts/showdown-143");
await mkdir(out, {recursive: true});

async function launchChrome() {
  const profile = await mkdtemp("/tmp/kiro-showdown-chrome-");
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--mute-audio", "--hide-scrollbars", "--allow-file-access-from-files",
    "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
    `--window-size=${WIDTH},${HEIGHT}`, "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
  let stderr = "";
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no DevTools URL from Chrome in 30 s:\n${stderr}`)), 30000);
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      const found = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (found) { clearTimeout(timer); resolve(found[1]); }
    });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Chrome exited with ${code}:\n${stderr}`)); });
  });
  return {url, async close() {
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await Promise.race([exited, sleep(5000)]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
    await rm(profile, {recursive: true, force: true, maxRetries: 5});
  }};
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const waiting = new Map(), listeners = new Set();
    let next = 0;
    ws.addEventListener("message", ({data}) => {
      const message = JSON.parse(data);
      if (message.id === undefined) { for (const listener of listeners) listener(message); return; }
      const entry = waiting.get(message.id);
      waiting.delete(message.id);
      if (message.error) entry?.reject(new Error(`${entry.method}: ${message.error.message}`));
      else entry?.resolve(message.result);
    });
    ws.addEventListener("error", () => reject(new Error(`WebSocket error on ${url}`)));
    ws.addEventListener("open", () => resolve({
      send(method, params = {}, sessionId) {
        const id = ++next;
        ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
        return new Promise((ok, fail) => waiting.set(id, {resolve: ok, reject: fail, method}));
      },
      on: (listener) => listeners.add(listener),
      close: () => ws.close(),
    }));
  });
}

const chrome = await launchChrome();
const cdp = await connect(chrome.url);
const report = {page, chrome: CHROME, viewport: [WIDTH, HEIGHT], checks: [], errors: [], screenshots: [], clicks: 0};
const check = (name, detail) => { report.checks.push({name, passed: true, ...(detail === undefined ? {} : {detail})}); console.log(`ok - ${name}`); };
let failed = null;
try {
  const {targetId} = await cdp.send("Target.createTarget", {url: "about:blank"});
  const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true});
  const send = (method, params) => cdp.send(method, params, sessionId);
  cdp.on(({method, params, sessionId: id}) => {
    if (id !== sessionId) return;
    if (method === "Runtime.exceptionThrown") report.errors.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
    if (method === "Runtime.consoleAPICalled" && params.type === "error") report.errors.push(params.args.map((a) => a.value ?? a.description).join(" "));
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false});
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const wait = async (expression, ms = 15000) => {
    const stop = Date.now() + ms;
    while (Date.now() < stop) { if (await evaluate(expression)) return; await sleep(100); }
    throw Error(`Timed out: ${expression}`);
  };
  // A real mouse press and release at the element's centre; the element must be the topmost hit there.
  const click = async (selector) => {
    const p = await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)throw Error('Missing: '+${JSON.stringify(selector)});
      n.scrollIntoView({block:'center'});const b=n.getBoundingClientRect();const x=b.x+b.width/2,y=b.y+b.height/2;
      const hit=document.elementFromPoint(x,y);if(!n.contains(hit))throw Error('Covered: '+${JSON.stringify(selector)});return{x,y};})()`);
    await send("Input.dispatchMouseEvent", {type: "mouseMoved", ...p});
    await send("Input.dispatchMouseEvent", {type: "mousePressed", button: "left", clickCount: 1, ...p});
    await send("Input.dispatchMouseEvent", {type: "mouseReleased", button: "left", clickCount: 1, ...p});
    report.clicks += 1;
  };
  const shot = async (name) => {
    const {data} = await send("Page.captureScreenshot", {format: "png", captureBeyondViewport: true});
    await writeFile(path.join(out, `${name}.png`), Buffer.from(data, "base64"));
    report.screenshots.push(`${name}.png`);
  };
  const navigate = async (query) => {
    await send("Page.navigate", {url: page + query});
    await wait(`document.readyState==='complete'&&document.getElementById('menu-play')`);
  };
  const text = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent.trim()??null`);

  // Seat privacy, read from the page itself: no Wizard card id anywhere in the DOM, the Wizard hand
  // only as card backs matching its count, no Wizard trap named, and no hand card that is not a Cowboy card.
  const privacy = () => evaluate(`(()=>{const body=document.getElementById("showdown").outerHTML+document.getElementById("showdown-camp").outerHTML+document.getElementById("title-screen").outerHTML;const ids=body.match(/wizard-[a-z-]+-\\d+/g)||[];
    const base=document.querySelector('#sd-board [data-side=wizard] [data-base=wizard]');const backs=base.querySelectorAll('.sd-backs .card-back').length;
    const count=Number(base.textContent.match(/Hand (\\d+)/)[1]);const label=base.querySelector('.sd-backs').getAttribute('aria-label');
    const hand=[...document.querySelectorAll('#sd-hand [data-card]')].map(n=>n.dataset.card);
    return{ids,backs,count,label,trapLine:base.textContent.match(/▲ ([^\\n]*)/)[1].trim(),handSides:[...new Set(hand.map(id=>id.split('-')[0]))]};})()`);
  let privacyChecks = 0;
  const assertPrivate = async () => {
    const p = await privacy();
    assert.deepEqual(p.ids, [], `Wizard card ids in the page: ${p.ids}`);
    assert.equal(p.backs, p.count, "one card back per Wizard hand card");
    assert.match(p.label, /^Wizard hand: \d+ cards?, face down$/);
    assert.match(p.trapLine, /^(Nothing face down|\d+ cards? face down)$/);
    assert.ok(p.handSides.every((side) => side === "cowboy"), `hand shows ${p.handSides}`);
    privacyChecks += 1;
    return p;
  };

  const shown = (id) => `!document.getElementById('${id}').hidden`;
  const campState = () => evaluate(`({tiles:[...document.querySelectorAll('#camp-trail button')].map(n=>({name:n.querySelector('strong').textContent,on:!n.disabled,note:n.querySelector('.sd-note').textContent})),
    offer:[...document.querySelectorAll('#camp-claim [data-choose]')].map(n=>n.dataset.choose),next:document.getElementById('camp-next')?.textContent??null,
    cards:document.getElementById('camp-collection').textContent.replace(/\\s+/g,' ').trim(),storage:document.getElementById('camp-storage').hidden})`);
  const savedProgress = () => evaluate(`JSON.parse(localStorage.getItem('cvw-showdown-save-v2'))`);
  // The playtest log, under the prototype key, and the Camp's plain-text report of it.
  const savedLog = () => evaluate(`JSON.parse(localStorage.getItem('cvw-showdown-playtest-v1'))`);
  const campReport = () => evaluate(`({text:document.getElementById('camp-report-text').value,unsaved:!document.getElementById('camp-report-storage').hidden})`);

  // 1. Normal entry on a clean profile: Play opens the Camp, and the Camp opens Boot Hill.
  await navigate("");
  assert.equal(await evaluate(`localStorage.length`), 0, "fresh Chrome profile has no saved data");
  const menu = await evaluate(`[...document.querySelectorAll('#title-screen nav > *')].filter(n=>!n.hidden).map(n=>n.textContent.trim())`);
  assert.deepEqual(menu, ["Play", "Lane duel (previous rules)"]);
  check("Normal entry on a clean profile offers Play and the lane duel link only", menu);
  await click("#menu-play");
  await wait(`${shown("showdown-camp")}&&document.getElementById('title-screen').hidden&&document.getElementById('showdown').hidden`);
  const freshCamp = await campState();
  assert.deepEqual(freshCamp.tiles.map((t) => t.on), [true, false, false, false, false, false]);
  assert.equal(freshCamp.tiles[0].name, "Boot Hill");
  assert.equal(freshCamp.tiles[0].note, "Win to earn Covered Wagon ×2");
  assert.match(freshCamp.next, /^Start here: click Boot Hill to play your first duel\.$/);
  assert.deepEqual(freshCamp.offer, []);
  await shot("camp-fresh");
  check("Play on a clean profile opens the Camp: Boot Hill open, the other five Trail duels locked", freshCamp);
  await click("#camp-trail [data-duel=trail]");
  await wait(`${shown("showdown")}&&document.getElementById('showdown-camp').hidden`);
  const opened = {status: await text("#sd-status"), lesson: await text("#sd-lesson")};
  assert.match(opened.status, /^Boot Hill · turn 1 · your turn$/);
  assert.match(opened.lesson, /^Win by removing every orb from the Wizard Base\./);
  assert.equal(await evaluate(`document.getElementById('arena').hidden`), true, "the lane arena stays closed");
  await assertPrivate();
  check("The Camp opens Trail duel 1, Boot Hill (Showdown), not the lane duel", opened);
  await click("#sd-home");
  await wait(`${shown("showdown-camp")}&&document.getElementById('showdown').hidden`);
  assert.equal(await evaluate(`localStorage.getItem('cvw-showdown-save-v2')`), null, "leaving an unfinished duel records nothing");
  assert.equal(await savedLog(), null, "leaving an unfinished duel logs nothing");
  assert.equal((await campReport()).text, "No duel has been finished yet.");
  await click("#camp-home");
  await wait(`${shown("title-screen")}&&document.getElementById('showdown-camp').hidden`);
  check("Back to camp leaves an unfinished duel unrecorded; Main menu returns to the title");

  // 2. Win Boot Hill and Raven Roost by clicks alone on a fixed deal (?seed=0 fixes every deal).
  // Turn loop: play every card the screen enables, attack with every ready troop (the Base when
  // open, else the first target), end the turn. Every step is a mouse click on an enabled button.
  async function winDuel(label, wizardBase) {
    await wait(`${shown("showdown")}&&/ · turn 1 · your turn$/.test(document.getElementById('sd-status').textContent)`);
    assert.match(await evaluate(`document.querySelector('#sd-log li').textContent`), /^Turn 1: the Cowboys\.$/, "each duel starts a clear event log");
    let turns = 0, attacks = 0, sawPreview = false, sawWizardTurn = false;
    const endTurn = async () => {
      await click("#sd-end");
      await wait(`/your turn$/.test(document.getElementById('sd-status').textContent)||document.querySelector('.sd-result')`);
      turns += 1;
      const log = await evaluate(`[...document.querySelectorAll('#sd-log li')].map(n=>n.textContent)`);
      if (log.some((line) => /^Turn \d+: the Wizards\.$/.test(line))) sawWizardTurn = true;
    };
    const over = () => evaluate(`Boolean(document.querySelector('.sd-result'))`);
    while (!(await over()) && turns < 40) {
      await assertPrivate();
      for (let played = 0; played < 4; played += 1) {
        const card = await evaluate(`document.querySelector('#sd-hand [data-card]:not(:disabled)')?.dataset.card??null`);
        if (!card) break;
        await click(`#sd-hand [data-card="${card}"]`);
        for (let i = 0; i < 3 && !(await evaluate(`document.getElementById('sd-cancel').hidden`)); i += 1) {
          const prompt = await text("#sd-prompt");
          if (/as payment|to carry/.test(prompt)) await click("#sd-board [data-side=cowboy] .sd-slot.sd-can[data-own]");
          else if (/Choose an enemy troop/.test(prompt)) await click(".sd-slot[data-enemy]");
          else await click("#sd-cancel");
        }
      }
      for (let i = 0; i < 3; i += 1) {
        const ready = await evaluate(`[...document.querySelectorAll('#sd-board [data-side=cowboy] [data-own]')].find(n=>/Can attack/.test(n.textContent))?.dataset.slot??null`);
        if (!ready) break;
        await click(`#sd-board [data-slot="${ready}"]`);
        const aim = await evaluate(`({base:Boolean(document.querySelector('[data-enemy=base]')),troops:document.querySelectorAll('.sd-slot[data-enemy]').length,
          preview:[...document.querySelectorAll('[data-enemy]')].map(n=>n.querySelector('.sd-note:last-child')?.textContent)})`);
        assert.ok(aim.base || aim.troops > 0, "a ready troop has a target");
        if (aim.preview.every(Boolean)) sawPreview = true;
        const before = await text("#sd-feedback");
        await click(aim.base ? "[data-enemy=base]" : ".sd-slot[data-enemy]");
        await wait(`document.getElementById('sd-feedback').textContent!==${JSON.stringify(before)}`);
        attacks += 1;
        if (await over()) break;
      }
      if (await over()) break;
      await endTurn();
    }
    const finish = await evaluate(`({status:document.getElementById('sd-status').textContent,
      wizardBase:document.querySelector('[data-base=wizard] .sd-orbs').getAttribute('aria-label'),feedback:document.getElementById('sd-feedback').textContent,
      hand:document.querySelectorAll('#sd-hand [data-card]:not(:disabled)').length,end:document.getElementById('sd-end').hidden,targets:document.querySelectorAll('[data-enemy],[data-own]').length,
      restart:document.getElementById('sd-restart').hidden,earned:document.getElementById('sd-result').textContent.match(/You earned ([^.]*)\\./)?.[1]??null,
      offer:[...document.querySelectorAll('#sd-result [data-choose]')].map(n=>n.dataset.choose),again:Boolean(document.getElementById('sd-again'))})`);
    assert.equal(finish.status, "You win: the Wizard Base fell.");
    assert.equal(finish.wizardBase, `0 of ${wizardBase} orbs`);
    assert.match(finish.feedback, /struck the Wizards' Base for \d+/);
    assert.deepEqual([finish.hand, finish.end, finish.targets, finish.restart, finish.again], [0, true, 0, true, false], "nothing is playable after the result");
    assert.ok(sawPreview, "every offered target showed an attack preview");
    assert.ok(sawWizardTurn, "the Wizard turns were shown in the log");
    await assertPrivate();
    check(`${label} (?seed=0) won by clicks alone; inputs close after the result`, {...finish, turns, attacks, clicks: report.clicks});
    return finish;
  }

  await navigate("?seed=0");
  await click("#menu-play");
  await wait(shown("showdown-camp"));
  await click("#camp-trail [data-duel=trail]");
  await wait(shown("showdown"));
  await shot("boot-hill-opening");

  // Legality on the opening turn: nothing attacks, own troops and the Wizard Base are not clickable.
  const opening = await evaluate(`({own:document.querySelectorAll('#sd-board [data-side=cowboy] [data-own]').length,
    enemy:document.querySelectorAll('#sd-board [data-enemy]').length,base:document.querySelector('[data-base=wizard]').disabled,
    playable:[...document.querySelectorAll('#sd-hand [data-card]:not(:disabled)')].map(n=>n.dataset.card),
    prompt:document.getElementById('sd-prompt').textContent})`);
  assert.equal(opening.own, 0); assert.equal(opening.enemy, 0); assert.equal(opening.base, true);
  assert.ok(opening.playable.length > 0);
  assert.match(opening.prompt, /Nobody attacks on the opening turn/);
  check("Turn 1 offers only legal plays: no attacker, no target, Wizard Base disabled", opening);

  // Summon one troop, then the rest of the troop cards are refused with the reason.
  const logBefore = await evaluate(`document.querySelectorAll('#sd-log li').length`);
  const first = opening.playable[0];
  await click(`#sd-hand [data-card="${first}"]`);
  await wait(`!document.querySelector('#sd-hand [data-card="${first}"]')`);
  const afterSummon = await evaluate(`({feedback:document.getElementById('sd-feedback').textContent,log:document.querySelectorAll('#sd-log li').length,
    board:[...document.querySelectorAll('#sd-board [data-side=cowboy] .sd-slot strong')].map(n=>n.textContent),
    refused:[...document.querySelectorAll('#sd-hand [data-card]:disabled')].map(n=>[n.dataset.card,n.querySelector('.sd-warn')?.textContent]),
    slotNote:document.querySelector('#sd-board [data-side=cowboy] .sd-slot[data-frame=troop]')?.textContent})`);
  assert.match(afterSummon.feedback, /^Last: The Cowboys' [A-Za-z ]+ arrived\.$/);
  assert.equal(afterSummon.log, logBefore + 1);
  assert.equal(afterSummon.board.length, 1);
  const troopRefusals = afterSummon.refused.filter(([id]) => /cowboy-(sheriff|billy|deadeye)/.test(id));
  assert.ok(troopRefusals.length > 0 && troopRefusals.every(([, why]) => why === "One troop a turn."), JSON.stringify(afterSummon.refused));
  assert.doesNotMatch(afterSummon.slotNote, /Can attack/, "nothing attacks on the opening turn");
  check("A summon shows its event line, and further troop cards are disabled with 'One troop a turn.'", afterSummon);
  const handBefore = await evaluate(`document.getElementById('sd-hand').innerHTML`);
  await click(`#sd-hand [data-card="${troopRefusals[0][0]}"]`);
  await sleep(150);
  assert.equal(await evaluate(`document.getElementById('sd-hand').innerHTML`), handBefore);
  check("Clicking a disabled card applies nothing");
  await assertPrivate();
  await shot("boot-hill-after-summon");
  // Restart replays the same deal from turn 1, with a clear log, before anything is recorded.
  await click("#sd-restart");
  const won1 = await winDuel("Boot Hill", 3);
  await shot("boot-hill-won");

  // Settled once on the win: the designed reward, saved before any choice is made.
  assert.equal(won1.earned, "Covered Wagon ×2");
  assert.equal(won1.offer.length, 2);
  const afterWin1 = await savedProgress();
  assert.equal(afterWin1.wins, 1);
  assert.equal(afterWin1.collection["cowboy-covered-wagon"], 2);
  assert.deepEqual([afterWin1.deck["cowboy-covered-wagon"], afterWin1.deck["cowboy-sheriff"]], [2, 6]);
  assert.deepEqual(afterWin1.offer, won1.offer);
  check("Boot Hill win pays Covered Wagon ×2 in place of Sheriff ×2, saved with the two-card offer", {earned: won1.earned, offer: won1.offer, deck: afterWin1.deck});
  const log1 = await savedLog();
  assert.equal(log1.length, 1);
  assert.deepEqual([log1[0].name, log1[0].won, log1[0].duel, log1[0].seed, log1[0].rules], ["Boot Hill", true, "trail", 0, false]);
  assert.ok(Number.isInteger(log1[0].turns) && log1[0].turns > 1 && Number.isInteger(log1[0].seconds) && typeof log1[0].run === "string");
  assert.deepEqual(Object.keys(log1[0]).sort(), ["duel", "name", "rules", "run", "seconds", "seed", "turns", "won"], "no other field is stored");
  check("The Boot Hill win is logged once under cvw-showdown-playtest-v1, with no personal fields", log1[0]);
  // Choice in the result panel, then back to the Camp.
  const pick1 = won1.offer[0];
  await click(`#sd-result [data-choose="${pick1}"]`);
  await wait(`!document.querySelector('#sd-result [data-choose]')&&/Added [A-Za-z' -]+: you now own \\d/.test(document.getElementById('sd-result').textContent)`);
  const chose1 = await savedProgress();
  assert.equal(chose1.offer, null);
  assert.equal(chose1.collection[pick1], (afterWin1.collection[pick1] ?? 0) + 1);
  check("Choosing one offered card adds exactly one copy and clears the offer", {pick: pick1});
  await click("#sd-camp");
  await wait(shown("showdown-camp"));
  const camp1 = await campState();
  assert.deepEqual(camp1.tiles.map((t) => t.on), [false, true, false, false, false, false]);
  assert.equal(camp1.tiles[0].name, "✓ Boot Hill");
  assert.equal(camp1.tiles[1].name, "Raven Roost");
  check("The Camp marks Boot Hill won and opens Raven Roost", camp1.tiles.slice(0, 2));
  assert.deepEqual(await savedLog(), log1, "choosing a card and returning to the Camp adds no log line");

  // Reload keeps the progress.
  await navigate("?seed=0");
  await click("#menu-play");
  await wait(shown("showdown-camp"));
  const reloaded1 = await campState();
  assert.deepEqual(reloaded1.tiles, camp1.tiles);
  assert.match(reloaded1.cards, /Covered Wagon ×2/);
  check("After a reload the Camp keeps the Boot Hill win, the reward and the chosen card", reloaded1);
  assert.deepEqual(await savedLog(), log1, "a reload adds no log line");
  await click("#camp-report summary");
  await wait(`document.getElementById('camp-report').open`);
  const report1 = await campReport();
  assert.equal(report1.unsaved, false);
  assert.match(report1.text, new RegExp(`^Showdown playtest report\nFinished 1 duel in \\d+ (s|min) of play: won 1, lost 0\.\nReached: Trail 1 of 6 won,`));
  assert.match(report1.text, new RegExp(`\n1\. Boot Hill: won in ${log1[0].turns} turns, `));
  assert.doesNotMatch(report1.text, /Raven Roost: /);
  await click("#camp-report-copy");
  await wait(`/^(Copied\.|Selected: press Ctrl\+C or Cmd\+C to copy\.)$/.test(document.getElementById('camp-report-copied').textContent)`);
  const copied = await text("#camp-report-copied");
  await shot("camp-report-after-reload");
  check("After a reload the Camp's Playtest report shows the one logged win as plain text; Copy report answers", {report: report1.text, copied});

  await click("#camp-trail [data-duel=trail]");
  const won2 = await winDuel("Raven Roost", 4);
  assert.equal(won2.earned, "Outrider ×2");
  const afterWin2 = await savedProgress();
  assert.equal(afterWin2.wins, 2);
  assert.equal(afterWin2.collection["cowboy-outrider"], 2);
  assert.deepEqual([afterWin2.deck["cowboy-outrider"], afterWin2.deck["cowboy-sheriff"]], [2, 4]);
  check("Raven Roost win pays Outrider ×2 in place of Sheriff ×2", {earned: won2.earned, deck: afterWin2.deck});
  const log2 = await savedLog();
  assert.deepEqual(log2.slice(0, 1), log1);
  assert.equal(log2.length, 2);
  assert.deepEqual([log2[1].name, log2[1].won, log2[1].duel], ["Raven Roost", true, "trail"]);
  assert.notEqual(log2[1].run, log1[0].run);
  // This time leave the choice for the Camp: it is still on offer there, and it blocks every duel.
  await click("#sd-camp");
  await wait(shown("showdown-camp"));
  const camp2 = await campState();
  assert.deepEqual(camp2.offer, afterWin2.offer);
  assert.ok(camp2.tiles.every((t) => !t.on), "no duel starts while a card is on offer");
  await shot("camp-offer");
  check("Back in the Camp the unclaimed offer comes first and every Trail tile is disabled", camp2);
  await navigate("?seed=0");
  await click("#menu-play");
  await wait(shown("showdown-camp"));
  assert.deepEqual((await campState()).offer, afterWin2.offer, "the offer survives a reload unchanged");
  const pick2 = afterWin2.offer[1];
  await click(`#camp-claim [data-choose="${pick2}"]`);
  await wait(`!document.querySelector('#camp-claim [data-choose]')`);
  const camp3 = await campState();
  assert.deepEqual(camp3.tiles.map((t) => t.on), [false, false, true, false, false, false]);
  assert.equal(camp3.tiles[2].name, "The Bone Fence");
  assert.equal((await savedProgress()).collection[pick2], (afterWin2.collection[pick2] ?? 0) + 1);
  await navigate("?seed=0");
  await click("#menu-play");
  await wait(shown("showdown-camp"));
  const reloaded2 = await campState();
  assert.deepEqual(reloaded2.tiles, camp3.tiles);
  assert.ok(reloaded2.storage, "no storage warning while saving works");
  await shot("camp-after-two");
  check("The Camp choice clears the offer and opens The Bone Fence; a reload continues from there", reloaded2);
  assert.deepEqual(await savedLog(), log2, "results, Camp choices and reloads never duplicate a log line");
  const report2 = (await campReport()).text;
  assert.match(report2, /Finished 2 duels in .* won 2, lost 0\./);
  assert.match(report2, /\n1\. Boot Hill: won .*\n2\. Raven Roost: won /);
  check("Two wins, three reloads: the log holds exactly two lines and the report lists both", {lines: log2.length});
  check("Seat privacy held at every checked step", {steps: privacyChecks});

  // 3. The lane duel stays reachable.
  await navigate("?mode=lanes");
  const lanes = await evaluate(`({visible:[...document.querySelectorAll('#title-screen nav > *')].filter(n=>!n.hidden).map(n=>n.textContent.trim()),showdown:document.getElementById('showdown').hidden})`);
  assert.ok(lanes.visible.includes("Wanted") && lanes.visible.includes("Build Deck") && lanes.visible.includes("Showdown (new rules)"), JSON.stringify(lanes));
  assert.ok(!lanes.visible.includes("Lane duel (previous rules)"));
  await click("#menu-play");
  await wait(`!document.getElementById('arena').hidden&&document.querySelector('#match .match-slot')`, 30000);
  assert.equal(await evaluate(`document.getElementById('showdown').hidden`), true);
  await shot("lanes-play");
  check("?mode=lanes shows the lane menu, and Play opens the lane duel", lanes);
  await navigate("?mode=match&deck=starter&seed=0");
  await wait(`!document.getElementById('arena').hidden&&document.querySelector('#match .match-slot')`, 30000);
  check("?mode=match still auto-starts the lane duel used by the existing lane checks");

  assert.deepEqual(report.errors, [], "no page errors");
  check("No page exceptions or console errors");
} catch (error) {
  failed = error;
  report.failure = error.stack;
} finally {
  cdp.close();
  await chrome.close();
  await writeFile(path.join(out, "browser-showdown.json"), `${JSON.stringify(report, null, 2)}\n`);
}
if (failed) { console.error(failed); process.exit(1); }
console.log(`${report.checks.length} checks passed; report in ${path.relative(process.cwd(), path.join(out, "browser-showdown.json"))}`);
