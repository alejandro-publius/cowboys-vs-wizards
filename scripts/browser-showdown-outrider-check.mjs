// K-011: the Outrider turns (src/match/showdown-outrider.js, src/ui/outrider-camp.js) in real headless Chrome, fresh profile.
//   npm run build
//   node scripts/browser-showdown-outrider-check.mjs dist/cowboys-vs-wizards-board-duel.html [outDir]
//   node scripts/build-graybox.mjs --outrider-fixture tests/fixtures/outrider-gate     (test page, .artifacts/ only)
//   node scripts/browser-showdown-outrider-check.mjs .artifacts/outrider-fixture/graybox.html [outDir] --fixture tests/fixtures/outrider-gate
// The cases the page must show are the ones scripts/outrider-gate.mjs verifies now for the same decision directory.
// None verified: the Camp must show no Outrider control and ?outrider=<anything> must open the normal menu, with the
// rest of the Camp usable. Otherwise, per case: Camp control -> landing (public view only, neutral text, both the Base
// and a troop offered once the Outrider is picked), the ride arm by mouse, Restart, the fight arm, play out, Retry,
// Back to camp; then the direct URL, reload and ids outside the list. A saved career written first must be
// byte-identical at the end. Outcomes are not judged here: the gate's Node replay does that.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {readFileSync} from "node:fs";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {DEFAULT_DIR, DEFAULT_RECEIPT, loadDecision, verifiedForBuild} from "./outrider-gate.mjs";
import {comparisonLines, nightWatchLine, researchLine} from "../src/ui/outrider-ledger.js";
import {SAVE_KEY} from "../src/game/showdown/campaign-store.js";
import {newSave} from "../src/game/showdown/progress.js";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const fixtureAt = args.indexOf("--fixture");
const fixture = fixtureAt >= 0 ? args.splice(fixtureAt, 2)[1] : null;
if (!args[0]) throw new Error("Pass the built graybox HTML file or an http(s) URL of the served page");
const page = /^https?:\/\//i.test(args[0]) ? new URL(args[0]).href : pathToFileURL(path.resolve(args[0])).href;
const withQuery = (query) => { const u = new URL(page); u.search = query; return u.href; };
const out = path.resolve(args[1] ?? ".artifacts/showdown-outrider");
await mkdir(out, {recursive: true});
const dir = fixture ? `${fixture}/decision` : DEFAULT_DIR, receiptPath = fixture ? `${fixture}/receipt.json` : DEFAULT_RECEIPT;
const curated = fixture ? JSON.parse(readFileSync(path.join(fixture, "curated.json"), "utf8")) : undefined;
const expected = await verifiedForBuild({dir, receiptPath, curated});
const ledger = expected.ledger;
const decision = expected.cases.length ? await loadDecision(dir) : null;
const armsOf = (id) => decision.cases.find((c) => c.id === id).arms;

const profile = await mkdtemp("/tmp/kiro-showdown-outrider-");
const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
  "--no-default-browser-check", "--mute-audio", "--hide-scrollbars", "--allow-file-access-from-files", "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
let stderr = "";
const wsUrl = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`no DevTools URL in 30 s:\n${stderr}`)), 30000);
  child.stderr.on("data", (chunk) => { stderr += chunk; const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
});
const ws = new WebSocket(wsUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve));
const waiting = new Map(), errors = [];
let next = 0, sessionId;
ws.addEventListener("message", ({data}) => {
  const m = JSON.parse(data);
  if (m.id === undefined) { if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text); return; }
  const entry = waiting.get(m.id);
  waiting.delete(m.id);
  if (m.error) entry.reject(new Error(`${entry.method}: ${m.error.message}`)); else entry.resolve(m.result);
});
const send = (method, params = {}) => { const id = ++next; ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
  return new Promise((resolve, reject) => waiting.set(id, {resolve, reject, method})); };

const report = {page, chrome: CHROME, decision: dir, gate: expected.note, camp: expected.camp, expected: expected.cases.map((c) => c.id), ledgerStatus: ledger.status, checks: [], shots: [], errors};
const ok = (name) => { report.checks.push(name); console.log(`ok - ${name}`); };
let failed = null;
try {
  ({sessionId} = await send("Target.attachToTarget", {targetId: (await send("Target.createTarget", {url: "about:blank"})).targetId, flatten: true}));
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const wait = async (expression, ms = 15000) => {
    const stop = Date.now() + ms;
    while (Date.now() < stop) { if (await evaluate(expression)) return; await sleep(50); }
    throw Error(`Timed out: ${expression}`);
  };
  const q = (s) => JSON.stringify(s);
  const shown = (id) => evaluate(`!document.getElementById(${q(id)}).hidden`);
  const navigate = async (query) => { await send("Page.navigate", {url: withQuery(query)}); await wait(`document.readyState==='complete'&&document.getElementById('camp-experiment')`); };
  const storage = () => evaluate(`JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map((k)=>[k,localStorage.getItem(k)])))`);
  const shot = async (name) => { const {data} = await send("Page.captureScreenshot", {format: "png"}); await writeFile(path.join(out, `${name}.png`), Buffer.from(data, "base64")); report.shots.push(`${name}.png`); };
  const click = async (selector) => {
    const box = await evaluate(`(()=>{const n=document.querySelector(${q(selector)});if(!n||n.disabled)return null;n.scrollIntoView({block:"center"});const r=n.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    assert.ok(box, `no enabled ${selector}`);
    for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", {type, x: box.x, y: box.y, button: "left", clickCount: 1});
    await sleep(30);
  };
  const finish = async () => {
    for (let i = 0; i < 120 && !(await evaluate(`Boolean(document.querySelector('#sd-result .sd-row'))`)); i += 1) {
      if (await evaluate(`!document.getElementById('sd-end').disabled`)) await click("#sd-end"); else await sleep(50);
    }
    await wait(`Boolean(document.querySelector('#sd-result .sd-row'))`);
  };
  const landing = async (label, at) => {
    await wait(`!document.getElementById('showdown').hidden&&document.getElementById('sd-status').textContent.includes('Experiment: an Outrider turn')`);
    assert.match(await evaluate(`document.getElementById('sd-status').textContent`), new RegExp(`turn ${at} · your turn`));
    const lesson = await evaluate(`document.getElementById('sd-lesson').textContent`);
    assert.match(lesson, /^Experiment for review, not advice or a bounty: nothing here is saved/);
    assert.doesNotMatch(lesson, /\bwin|\blose|best|correct|should|better|seed/i);
    const html = await evaluate(`document.getElementById('showdown').innerHTML`);
    assert.ok(!/data-card="wizard-/.test(html), "a Wizard card is in the hand row");
    assert.ok(!/seed/i.test(await evaluate(`document.getElementById('showdown').textContent`)), "the page names a seed");
    ok(`${label}: Cowboy turn ${at}, neutral lesson, no Wizard hand card or seed in the page`);
  };
  const pickOutrider = async (slot) => {
    await click(`[data-slot="cowboy-${slot}"]`);
    assert.ok(await evaluate(`Boolean(document.querySelector('[data-base="wizard"][data-enemy="base"]'))&&Boolean(document.querySelector('[data-slot^="wizard-"][data-enemy]'))`), "both the Base and a troop are offered");
  };

  await navigate("");
  await evaluate(`localStorage.setItem(${q(SAVE_KEY)}, ${q(JSON.stringify({...newSave(), wins: 2}))})`);
  await navigate("");
  await click("#menu-play");
  await wait(`!document.getElementById('showdown-camp').hidden`);
  const before = await storage();
  ok("a saved career is in storage before the experiment");
  const campControls = await evaluate(`[...document.querySelectorAll('#camp-experiment [data-outrider]')].map((b)=>[b.dataset.outrider,b.textContent])`);
  assert.deepEqual(campControls, expected.camp ? [[expected.camp, "Try an Outrider turn"]] : []);
  await shot("01-camp");
  ok(expected.camp ? `Camp shows one neutral Outrider control (${expected.camp})` : `Camp shows no Outrider control (${expected.note})`);
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-duel]:not(:disabled)'))&&Boolean(document.getElementById('camp-turn-dragon'))`), "the rest of the Camp is usable");
  // Live-game privacy: nothing measured is in the DOM before the reader reveals it.
  const noResults = async (where) => assert.ok(!(await evaluate(`/won on turn|fresh reversals|always riding|unsupported/.test([...document.body.querySelectorAll('*')].filter((n)=>n.tagName!=='SCRIPT'&&!n.closest('script')).map((n)=>[...n.childNodes].filter((c)=>c.nodeType===3).map((c)=>c.data).join('')+[...n.attributes].map((a)=>a.value).join(' ')).join(' '))`)), `measured results in the DOM ${where}`);
  await noResults("on the Camp");

  // The Sheriff's Ledger section: collapsed, then opened; neutral before the reveal; links only when fresh.
  assert.equal(await evaluate(`document.getElementById('camp-ledger').open`), false);
  await click("#camp-ledger > summary");
  await wait(`document.getElementById('camp-ledger').open`);
  const section = await evaluate(`(()=>{const s=document.getElementById('ledger-outrider');return {status:s.querySelector('#ledger-outrider-status').dataset.status,
    statusText:s.querySelector('#ledger-outrider-status').textContent,text:s.textContent,links:[...s.querySelectorAll('[data-outrider]')].map((b)=>[b.dataset.outrider,b.textContent]),
    reveal:Boolean(s.querySelector('#ledger-outrider-reveal')),nw:s.querySelector('#ledger-outrider-nightwatch')?.textContent??null,
    right:s.getBoundingClientRect().right,width:innerWidth}})()`);
  report.ledgerSection = section;
  assert.equal(section.status, ledger.status);
  assert.equal(section.statusText, ledger.statusText);
  assert.equal(section.nw, nightWatchLine(ledger));
  assert.doesNotMatch(section.text, /\bwon\b|\bwins?\b|\blose|best|should|better|unsupported|reversal|always riding/i);
  assert.ok(section.right <= section.width + 1, "the Ledger section is wider than the viewport");
  if (ledger.status === "fresh") {
    assert.deepEqual(section.links, ledger.positions.map((p) => [p.id, `Open ${p.label}`]));
    assert.ok(section.reveal);
    await shot("04-ledger-before-reveal");
    await click("#ledger-outrider-reveal");
    const shownText = await evaluate(`document.getElementById('ledger-outrider-results').textContent`);
    for (const line of comparisonLines(ledger)) assert.ok(shownText.includes(line), line);
    if (researchLine(ledger)) assert.ok(shownText.includes(researchLine(ledger)), "research line");
    await shot("05-ledger-revealed");
    ok(`Ledger: ${ledger.positions.map((p) => p.label).join(" and ")} shown neutral; the reveal shows the measured comparison and the search's limits`);
    await click("#ledger-outrider-reveal");
    assert.equal(await evaluate(`document.getElementById('ledger-outrider-results').innerHTML`), "");
    await noResults("after hiding the comparison");
    ok("Hiding the comparison removes it from the DOM");
  } else {
    assert.deepEqual(section.links, []);
    assert.equal(section.reveal, false);
    await shot("04-ledger-stale");
    ok(`Ledger: readable ${ledger.status} status, no results, no reveal and no position links ("${section.statusText.slice(0, 80)}...")`);
  }
  await click("#camp-ledger > summary");
  await wait(`!document.getElementById('camp-ledger').open`);

  for (const [i, c] of expected.cases.entries()) {
    const {ride, fight} = armsOf(c.id);
    const fromCamp = c.id === expected.camp;
    const control = fromCamp ? "#camp-outrider-turn" : `#ledger-outrider [data-outrider="${c.id}"]`;
    const openLedger = async () => { if (!fromCamp && !(await evaluate(`document.getElementById('camp-ledger').open`))) { await click("#camp-ledger > summary"); await wait(`document.getElementById('camp-ledger').open`); } };
    await openLedger();
    await click(control);
    await landing(`case ${i} (${c.id}) from the ${fromCamp ? "Camp" : "Ledger"}`, c.at);
    await noResults("during the duel");
    assert.ok(await evaluate(`document.getElementById('showdown-camp').hidden`), "the Camp and its Ledger stay hidden during the duel");
    await shot(`02-landing-${i}`);
    await pickOutrider(ride.slot);
    await click(`[data-base="wizard"]`);
    ok(`case ${i}: ride arm by mouse (Outrider slot ${ride.slot} -> Wizard Base)`);
    await click("#sd-restart");
    await landing(`case ${i} after Restart (retry during the turn)`, c.at);
    await pickOutrider(fight.slot);
    await click(`[data-slot="wizard-${fight.target}"]`);
    ok(`case ${i}: fight arm by mouse (Outrider slot ${fight.slot} -> Wizard troop ${fight.target})`);
    await finish();
    assert.equal(await evaluate(`document.getElementById('sd-again')?.textContent`), "Retry");
    assert.ok(!(await evaluate(`/collection|earned|Grit/.test(document.getElementById('sd-result').textContent)`)), "the result pays or charges something");
    await click("#sd-again");
    await landing(`case ${i} after Retry`, c.at);
    await click("#sd-home");
    await wait(`!document.getElementById('showdown-camp').hidden`);
    report[`focus-${c.id}`] = await evaluate(`document.activeElement?.id||document.activeElement?.tagName`);
    assert.equal(await evaluate(`document.activeElement?.dataset.outrider`), c.id);
    assert.equal(await storage(), before);
    ok(`case ${i}: played out, Retry, Back to camp (cancel) returns focus to its ${fromCamp ? "Camp control" : "Ledger link"}; saved career byte-identical`);
    await navigate(`?outrider=${encodeURIComponent(c.id)}`);
    await landing(`case ${i} direct URL`, c.at);
    await send("Page.reload");
    await wait(`document.readyState==='complete'&&document.getElementById('sd-status')`);
    await landing(`case ${i} reload of the direct URL`, c.at);
    await navigate("");
    await click("#menu-play");
    await wait(`!document.getElementById('showdown-camp').hidden`);
  }
  for (const bad of ["?outrider=nope", "?outrider=__proto__", `?outrider=${encodeURIComponent('[{"type":"end"}]')}`, `?outrider=${encodeURIComponent(`${expected.cases[0]?.id ?? "x"} `)}`]) {
    await navigate(bad);
    await sleep(100);
    assert.ok(await shown("title-screen") && !(await shown("showdown")), bad);
  }
  ok("a ?outrider value outside the verified list opens the normal main menu");
  await send("Emulation.setDeviceMetricsOverride", {width: 375, height: 740, deviceScaleFactor: 1, mobile: true});
  await navigate("");
  await click("#menu-play");
  await wait(`!document.getElementById('showdown-camp').hidden`);
  assert.ok(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1&&[...document.querySelectorAll('#camp-experiment [data-outrider]')].every((b)=>{const r=b.getBoundingClientRect();return r.width>0&&r.right<=innerWidth+1;})`), "the Camp scrolls sideways at 375 px");
  await shot("03-small-camp");
  ok("375 px: the Camp and every Outrider control fit without sideways scroll");
  assert.equal(await storage(), before);
  assert.deepEqual(errors, []);
  ok("saved career byte-identical at the end; no page errors");
} catch (error) {
  failed = error;
} finally {
  report.passed = !failed;
  report.failure = failed ? String(failed.stack ?? failed) : null;
  await writeFile(path.join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  ws.close();
  child.kill("SIGTERM");
  await sleep(300);
  await rm(profile, {recursive: true, force: true, maxRetries: 5});
}
if (failed) { console.error(failed); process.exit(1); }
console.log(`${report.checks.length} checks passed; report ${path.join(out, "report.json")}`);
