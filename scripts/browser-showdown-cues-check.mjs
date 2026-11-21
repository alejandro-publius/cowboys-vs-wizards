// Placeholder cues before any 3D work: real-Chrome check of src/ui/showdown-cues.js on the Showdown screen.
//   node scripts/build-graybox.mjs
//   node scripts/browser-showdown-cues-check.mjs dist/cowboys-vs-wizards-board-duel.html [outDir]
// Native headless Chrome with a fresh profile, driven by mouse events over the DevTools protocol
// (launch as in browser-showdown-check.mjs). A MutationObserver records every cue the page paints.
//   1. The built page: Boot Hill (?seed=1) played by clicks at the real 700 ms step. Its decks can
//      give cover, burned draws and fatigue; each painted cue is checked against its log line.
//   2. A harness page built here from the same screen module, mounted on a duel whose decks hold
//      every card type (gear and locations added to the even decks) at a shorter step, so the
//      remaining cue kinds and their payload subcases occur in real play by clicks.
//   3. Rapid actions: a second action inside a sequence cancels the first sequence's later steps.
//   4. Reduced motion (emulated): a whole batch shows at once with no animation.
// Every observation also checks that no Wizard card id is in the page.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {build} from "esbuild";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTH = 1440, HEIGHT = 900;
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!process.argv[2]) throw new Error("Pass the built graybox HTML file");
const page = pathToFileURL(path.resolve(process.argv[2])).href;
const out = path.resolve(process.argv[3] ?? ".artifacts/showdown-cues");
await mkdir(out, {recursive: true});

// The harness: the graybox template and styles with an entry that mounts the real Showdown screen.
const HARNESS_STEP = 150;
async function buildHarness() {
  const read = (name) => readFile(path.join(ROOT, name), "utf8");
  const entry = `import {mountShowdown} from "./src/ui/showdown-screen.js";
    import {DECKS} from "./src/game/showdown/cards.js";
    const decks = {cowboy: {...DECKS.cowboy, "cowboy-six-shooter": 2, "cowboy-sheriffs-office": 2, "cowboy-captured-dragon": 1},
      wizard: {...DECKS.wizard, "wizard-bone-armor": 2, "wizard-boneyard": 2}};
    document.getElementById("title-screen").hidden = true;
    const root = document.getElementById("showdown");
    root.hidden = false;
    const seed = Number(new URLSearchParams(location.search).get("seed") ?? 0);
    const step = Number(new URLSearchParams(location.search).get("step") ?? ${HARNESS_STEP});
    // Slice 2: the screen settles a finished duel through a campaign; the harness duel is outside the Trail and pays nothing.
    const campaign = {settle: (duel, won) => ({won, earned: {cards: [], packs: 0, captured: null}, intoDeck: [], grit: 0}),
      progress: () => ({offer: null}), trailDuel: () => null, duel: () => null, owned: () => 0, choose() {}};
    mountShowdown(root, {onHome() {}, campaign, cueOptions: {step}}).start({name: "Cue harness", lesson: "Every card type in play.", level: 1, options: {decks}}, seed);`;
  const [template, style, showdownStyle, bundle] = await Promise.all([read("src/ui/graybox.html"), read("src/ui/graybox.css"), read("src/ui/showdown.css"),
    build({stdin: {contents: entry, resolveDir: ROOT, sourcefile: "cue-harness.js"}, bundle: true, write: false, platform: "browser", target: "es2022", format: "iife"})]);
  const file = path.join(out, "cue-harness.html");
  await writeFile(file, template.replace("@@STYLE@@", () => `${style}\n${showdownStyle}`)
    .replace("@@SCRIPT@@", () => bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")));
  return pathToFileURL(file).href;
}

async function launchChrome() {
  const profile = await mkdtemp("/tmp/kiro-showdown-cues-chrome-");
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

// Installed in the page: records each painted cue state with what it marked and the log lines it lit.
const OBSERVER = `(() => {
  if (window.__cues) return;
  window.__cues = [];
  const banner = document.getElementById("sd-cue");
  const where = (n) => n.dataset.slot ? {slot: n.dataset.slot, name: n.querySelector("strong")?.textContent ?? null}
    : n.dataset.base ? {base: n.dataset.base} : n.classList.contains("sd-side") ? {row: n.dataset.side} : {id: n.id};
  new MutationObserver(() => {
    const labels = [...banner.querySelectorAll(".sd-cue-label")].map((l) => ({kind: l.dataset.cue, variant: l.dataset.variant ?? null, label: l.textContent}));
    const marked = [...document.querySelectorAll("#sd-board .sd-cue, #sd-location.sd-cue")];
    const lines = [...document.querySelectorAll("#sd-log li.sd-cue")];
    const html = document.getElementById("showdown").outerHTML;
    window.__cues.push({t: performance.now(), labels,
      marks: marked.map((n) => ({...where(n), cue: n.dataset.cue, still: n.classList.contains("sd-cue-still"), animation: getComputedStyle(n).animationName})),
      lines: lines.map((l) => ({line: Number(l.dataset.line), kind: l.dataset.cueKind, text: l.textContent})),
      wizardIds: html.match(/wizard-[a-z-]+-\\d+/g) ?? []});
  }).observe(banner, {childList: true, subtree: true, characterData: true});
})()`;

const chrome = await launchChrome();
const cdp = await connect(chrome.url);
const report = {page, chrome: CHROME, viewport: [WIDTH, HEIGHT], checks: [], errors: [], clicks: 0};
const check = (name, detail) => { report.checks.push({name, passed: true, ...(detail === undefined ? {} : {detail})}); console.log(`ok - ${name}`); };
let failed = null;
try {
  const harness = await buildHarness();
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
  const wait = async (expression, ms = 20000) => {
    const stop = Date.now() + ms;
    while (Date.now() < stop) { if (await evaluate(expression)) return; await sleep(25); }
    throw Error(`Timed out: ${expression}`);
  };
  const click = async (selector) => {
    const p = await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)throw Error('Missing: '+${JSON.stringify(selector)});
      n.scrollIntoView({block:'center'});const b=n.getBoundingClientRect();const x=b.x+b.width/2,y=b.y+b.height/2;
      const hit=document.elementFromPoint(x,y);if(!n.contains(hit))throw Error('Covered: '+${JSON.stringify(selector)});return{x,y};})()`);
    await send("Input.dispatchMouseEvent", {type: "mouseMoved", ...p});
    await send("Input.dispatchMouseEvent", {type: "mousePressed", button: "left", clickCount: 1, ...p});
    await send("Input.dispatchMouseEvent", {type: "mouseReleased", button: "left", clickCount: 1, ...p});
    report.clicks += 1;
  };
  const exists = (selector) => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const logLength = () => evaluate(`document.querySelectorAll('#sd-log li').length`);
  // With reduced motion a batch stays shown, still, until the next one: there is no sequence to wait for.
  let reduced = false;
  const idle = () => (reduced ? sleep(50) : wait(`!document.querySelector('#sd-cue .sd-cue-label')`));
  const over = () => exists(".sd-result");
  // One click that applies an action: waits for its log lines and, unless rapid, for its cue sequence to end.
  const actBy = async (selector, {rapid = false} = {}) => {
    const before = await logLength();
    await click(selector);
    await wait(`document.querySelectorAll('#sd-log li').length>${before}`);
    if (!rapid) await idle();
  };

  // Plays one turn by clicks: cards first (any prompt answered with the first offered place), then
  // every troop that can act, attacking or (with `cover`) taking cover, then End turn.
  let spread = 0;
  async function playTurn({cover = false} = {}) {
    const skipped = new Set();
    for (let tries = 0; tries < 8 && !(await over()); tries += 1) {
      const card = await evaluate(`[...document.querySelectorAll('#sd-hand [data-card]:not(:disabled)')].map(n=>n.dataset.card).find(id=>!${JSON.stringify([...skipped])}.includes(id))??null`);
      if (!card) break;
      const before = await logLength();
      await click(`#sd-hand [data-card="${card}"]`);
      for (let i = 0; i < 3 && (await logLength()) === before && !(await evaluate(`document.getElementById('sd-cancel').hidden`)); i += 1) {
        const prompt = await evaluate(`document.getElementById('sd-prompt').textContent`);
        if (/as payment|to carry/.test(prompt)) await click("#sd-board [data-side=cowboy] .sd-slot.sd-can[data-own]");
        else if (/Choose an enemy troop/.test(prompt)) await click(".sd-slot[data-enemy]");
        else break;
      }
      if ((await logLength()) === before) { skipped.add(card); if (!(await evaluate(`document.getElementById('sd-cancel').hidden`))) await click("#sd-cancel"); }
      else await idle();
    }
    for (let tries = 0; tries < 3 && !(await over()); tries += 1) {
      const slot = await evaluate(`document.querySelector('#sd-board [data-side=cowboy] [data-own]')?.dataset.slot??null`);
      if (!slot) break;
      await click(`#sd-board [data-slot="${slot}"]`);
      if ((cover || !(await exists("[data-enemy]"))) && !(await evaluate(`document.getElementById('sd-cover').hidden`))) await actBy("#sd-cover");
      else if (await exists(".sd-slot[data-enemy]")) {
        // Targets taken in turn, so attacks run from and to every slot.
        const aims = await evaluate(`[...document.querySelectorAll('.sd-slot[data-enemy]')].map(n=>n.dataset.enemy)`);
        await actBy(`.sd-slot[data-enemy="${aims[spread++ % aims.length]}"]`);
      }
      else if (await exists("[data-enemy=base]")) await actBy("[data-enemy=base]");
      else { await click("#sd-cancel"); break; }
    }
    if (!(await over())) await actBy("#sd-end");
  }

  const records = () => evaluate("window.__cues.splice(0)");
  const LABEL = {cover: "Take cover", trap: "Trap revealed", gear: "Gear attached", location: "Location changed", raise: "Troop raised",
    sweep: "Sweep", laststand: "Last Stand", set: "Set face down", burn: "Burned draw", fatigue: "Fatigue"};
  // What each kind marks, by place: s = a slot, b = a Base, r = a row, l = the location line.
  const SHAPE = {cover: "s", trap: "bs", gear: "s", location: "l", raise: "s", sweep: "rs", laststand: "ss", set: "b", burn: "b", fatigue: "b"};
  const shape = (marks) => marks.map((m) => (m.slot ? "s" : m.base ? "b" : m.row ? "r" : "l")).sort().join("");
  const sideOf = (m) => (m.slot ? m.slot.split("-")[0] : m.base ?? m.row);
  // Checks one painted state and returns its cue key ("kind" or "kind:variant").
  function checkPaint(rec, {still = false} = {}) {
    assert.deepEqual(rec.wizardIds, [], `Wizard card ids in the page: ${rec.wizardIds}`);
    if (!rec.labels.length) { assert.deepEqual(rec.marks, []); assert.deepEqual(rec.lines, []); return []; }
    if (!still) {
      assert.equal(rec.labels.length, 1, "one cue at a time");
      const [{kind}] = rec.labels;
      assert.equal(rec.labels[0].label, LABEL[kind]);
      assert.equal(rec.lines.length, 1, `${kind}: one log line lit`);
      assert.equal(rec.lines[0].kind, kind, `${kind}: lit line is tagged ${rec.lines[0].kind}`);
      assert.equal(shape(rec.marks), SHAPE[kind].split("").sort().join(""), `${kind} marks ${JSON.stringify(rec.marks)}`);
      assert.ok(rec.marks.every((m) => m.cue === kind && !m.still && m.animation === "sd-cue-flash"), `${kind}: marks flash`);
      const text = rec.lines[0].text;
      const sides = rec.marks.map(sideOf);
      if (kind === "trap" || kind === "laststand" || kind === "sweep") assert.equal(new Set(sides).size, 2, `${kind} spans both sides`);
      // The event's own side leads the line ("The Cowboys' ..." / "The Wizards' ..."), except for Last Stand and the trap,
      // where the line names the cards: the trap's owner holds the Base mark and the attacker the slot.
      if (["cover", "gear", "raise", "set", "burn", "fatigue"].includes(kind)) assert.match(text, sides[0] === "cowboy" ? /Cowboys/ : /Wizards/, `${kind} side`);
      // A troop that is still on the board where it was cued must be the troop the line names.
      for (const m of rec.marks) if (m.slot && m.name && ["cover", "gear", "raise"].includes(kind)) assert.ok(text.includes(m.name), `${kind} slot ${m.slot} holds ${m.name}: ${text}`);
      if (kind === "trap") {
        const v = rec.labels[0].variant;
        // Each subcase has its own wording (.kiro/specs/showdown-bear-trap-log/bugfix.md): a fatal Bear Trap
        // (left 0, checked before stopped) reads "defeated before it struck" (2.1, 2.2); a Bear Trap the troop
        // survives reads "it dropped to N and attacked anyway", N > 0 (3.2); Hex reads "its attack was cancelled" (3.1).
        // In the card catalog (card-specs.generated.js) Bear Trap is the Cowboys' only trap and Hex the Wizards' only trap.
        const TRAP_LINE = {
          defeated: [/Trap! The Cowboys' Bear Trap caught .+: defeated before it struck\.$/, "cowboy"],
          through: [/Trap! The Cowboys' Bear Trap caught .+: it dropped to [1-9]\d* and attacked anyway\.$/, "cowboy"],
          cancelled: [/Trap! The Wizards' Hex caught .+: its attack was cancelled\.$/, "wizard"],
        };
        assert.ok(Object.hasOwn(TRAP_LINE, v), `trap variant ${v}`);
        const [line, owner] = TRAP_LINE[v];
        assert.match(text, line, `trap ${v}`);
        assert.equal(rec.marks.find((m) => m.base).base, owner, `trap ${v}: the trap owner's Base is marked`);
        assert.notEqual(rec.marks.find((m) => m.base).base, sideOf(rec.marks.find((m) => m.slot)), "the trap's owner is not the attacker");
      }
      if (kind === "laststand") assert.equal(/, defeating it\.$/.test(text), rec.labels[0].variant === "defeated", `last stand ${text}`);
      return [rec.labels[0].variant ? `${kind}:${rec.labels[0].variant}` : kind];
    }
    assert.ok(rec.marks.every((m) => m.still && m.animation === "none"), "reduced motion: no flash");
    assert.equal(rec.lines.length, rec.labels.length, "reduced motion: every cue's line lit");
    return rec.labels.map((l) => (l.variant ? `${l.kind}:${l.variant}` : l.kind));
  }
  const pairs = new Set();
  const notePairs = (rec) => {
    const kind = rec.labels[0]?.kind;
    if (rec.labels.length === 1 && (kind === "trap" || kind === "laststand")) {
      const slots = rec.marks.filter((m) => m.slot).map((m) => m.slot);
      if (kind === "laststand") pairs.add(`laststand ${slots.sort().join(" & ")}`);
      else pairs.add(`trap on ${slots[0]}`);
    }
  };

  // 1. The built page, Boot Hill by clicks at the real step.
  await send("Page.navigate", {url: `${page}?seed=1`});
  await wait(`document.readyState==='complete'&&document.getElementById('menu-play')`);
  await click("#menu-play");
  // Slice 2: Play opens the Camp; Boot Hill is its open Trail tile.
  await wait(`document.querySelector('#showdown-camp [data-duel=trail]')`);
  await click("#showdown-camp [data-duel=trail]");
  await wait(`document.querySelector('#sd-board [data-side=cowboy]')`);
  await evaluate(OBSERVER);
  const bootMet = new Set();
  let bootTurns = 0, steps = [];
  for (; bootTurns < 60 && !(await over()); bootTurns += 1) {
    await playTurn({cover: true});
    for (const rec of await records()) { for (const key of checkPaint(rec)) bootMet.add(key); steps.push(rec.t); }
  }
  const result = await evaluate(`document.getElementById('sd-status').textContent`);
  assert.ok(["cover", "burn", "fatigue"].every((k) => bootMet.has(k)), `Boot Hill met ${[...bootMet]}`);
  check("Boot Hill (?seed=1) by clicks at the 700 ms step: cover, burned draw and fatigue cues each mark their place and light their log line", {turns: bootTurns, met: [...bootMet].sort(), result});

  // 2. The harness: every card type in play, short step. Seeds until every kind and subcase has painted.
  const want = ["cover", "trap:cancelled", "trap:through", "trap:defeated", "gear", "location", "raise", "sweep", "laststand:defeated", "laststand:wounded", "set", "burn", "fatigue"];
  const met = new Set(), bySeed = {};
  for (let seed = 0; seed < 60 && want.some((k) => !met.has(k)); seed += 1) {
    await send("Page.navigate", {url: `${harness}?seed=${seed}`});
    await wait(`document.readyState==='complete'&&document.querySelector('#sd-board [data-side=cowboy]')`);
    await evaluate(OBSERVER);
    bySeed[seed] = new Set();
    for (let turn = 0; turn < 60 && !(await over()); turn += 1) {
      await playTurn({cover: seed % 3 === 2});
      for (const rec of await records()) { for (const key of checkPaint(rec)) { met.add(key); bySeed[seed].add(key); } notePairs(rec); }
    }
    bySeed[seed] = [...bySeed[seed]].sort();
  }
  const missing = want.filter((k) => !met.has(k));
  assert.deepEqual(missing, [], `harness never painted ${missing}`);
  check("harness duel (every card type, 150 ms step) by clicks: all ten cue kinds and every trap and Last Stand subcase painted, each checked against its log line", {met: [...met].sort(), bySeed});
  check("trap and Last Stand cues landed on these slot pairs in real play", [...pairs].sort());

  // 3. Rapid actions at the real 700 ms step: a cover, then at once a second cover. The first batch's
  //    later painting must never light a line older than the second batch.
  let rapid = null;
  for (let seed = 0; seed < 30 && !rapid; seed += 1) {
    await send("Page.navigate", {url: `${harness}?seed=${seed}&step=700`});
    await wait(`document.readyState==='complete'&&document.querySelector('#sd-board [data-side=cowboy]')`);
    await evaluate(OBSERVER);
    for (let turn = 0; turn < 12 && !rapid && !(await over()); turn += 1) {
      const ready = await evaluate(`[...document.querySelectorAll('#sd-board [data-side=cowboy] [data-own]')].map(n=>n.dataset.slot)`);
      if (ready.length >= 2) {
        await records();
        const firstLine = await logLength();
        await click(`#sd-board [data-slot="${ready[0]}"]`);
        await actBy("#sd-cover", {rapid: true});
        const secondLine = await logLength();
        await click(`#sd-board [data-slot="${ready[1]}"]`);
        await actBy("#sd-cover", {rapid: true});
        await sleep(1600);
        const recs = await records();
        const after = recs.findIndex((r) => r.lines.some((l) => l.line >= secondLine));
        assert.ok(after >= 0, "second cover painted");
        const stale = recs.slice(after).filter((r) => r.lines.some((l) => l.line < secondLine));
        assert.deepEqual(stale, [], "an older batch painted after a newer one began");
        assert.ok(recs.slice(0, after).some((r) => r.lines.some((l) => l.line === firstLine)), "first cover painted first");
        assert.equal(recs.at(-1).labels.length, 0, "the sequence clears itself");
        rapid = {seed, turn, firstLine, secondLine, paints: recs.length};
      } else await playTurn();
    }
  }
  assert.ok(rapid, "no position with two troops ready to take cover");
  check("two actions inside one 700 ms step: the newer cue replaces the older at once and the older batch never paints again", rapid);

  // 4. Reduced motion: the whole batch at once, outlined, with no animation.
  await send("Emulation.setEmulatedMedia", {features: [{name: "prefers-reduced-motion", value: "reduce"}]});
  reduced = true;
  const still = new Set();
  let batches = 0;
  for (let seed = 0; seed < 10 && batches < 3; seed += 1) {
    await send("Page.navigate", {url: `${harness}?seed=${seed}&step=700`});
    await wait(`document.readyState==='complete'&&document.querySelector('#sd-board [data-side=cowboy]')`);
    await evaluate(OBSERVER);
    for (let turn = 0; turn < 40 && !(await over()) && batches < 3; turn += 1) {
      const before = await logLength();
      await playTurn();
      for (const rec of await records()) {
        for (const key of checkPaint(rec, {still: true})) still.add(key);
        if (rec.labels.length > 1) batches += 1;
      }
      assert.ok((await logLength()) > before);
    }
  }
  assert.ok(batches >= 1, "reduced motion: no batch with more than one cue");
  check("with prefers-reduced-motion: reduce, each batch shows all its cues at once with no flash and every line lit", {multiCueBatches: batches, met: [...still].sort()});
  await send("Emulation.setEmulatedMedia", {features: []});
} catch (error) {
  failed = error;
  report.failure = String(error.stack ?? error);
} finally {
  cdp.close();
  await chrome.close();
}
if (!failed && report.errors.length) failed = new Error(`page errors: ${report.errors.join(" | ")}`);
report.passed = !failed;
await writeFile(path.join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`report: ${path.join(out, "report.json")}`);
if (failed) { console.error(failed); process.exit(1); }
