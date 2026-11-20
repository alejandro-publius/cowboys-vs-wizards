// K-049 / K-083: Chrome receipt for one Boot Hill practice opening (?practice=0 or ?practice=60), plus the
// deterministic join that accepts exactly one seed-0 and one seed-60 receipt of the same build.
// QA instrumentation only: no src/ change. Recipe: .kiro/workflows/showdown-practice-replay.workflow.json;
// evidence note: docs/evidence/showdown-practice-workflow.md.
//
//   node scripts/build-graybox.mjs --hosted                      (the site-root page: dist/web/index.html)
//   node scripts/browser-showdown-practice.mjs --seed 0 --page dist/web/index.html --out .artifacts/practice/seed-0.json
//   node scripts/browser-showdown-practice.mjs --join .artifacts/practice/seed-0.json .artifacts/practice/seed-60.json --page dist/web/index.html
//   node scripts/browser-showdown-practice.mjs --join-controls .artifacts/practice/seed-0.json .artifacts/practice/seed-60.json --page dist/web/index.html
//
// One seed: the supplied page is served on loopback (every other host is refused and recorded). In two fresh
// headless Chrome contexts, each holding the same planted advanced career and playtest log, it opens the
// practice deal from the normal entry (root -> Play -> Camp -> open "#camp-practice" -> its seed link) and from
// the direct URL (/?practice=N). Each time it reads the public opening off the page (status, own hand, both
// Bases' orbs and counts, both boards), compares it with the opening the engine in this tree deals for
// Boot Hill with a fresh save and that seed (createShowdownSession -> viewFor, the cowboy seat), plays the
// first enabled hand card with a real click, checks the summon landed, presses Back to camp, and compares
// every localStorage key and the Camp's visible text and playtest report with what they were before.
// The receipt holds only that public opening, its SHA-256 fingerprint, the page's own 12-character build label,
// the HTML file's SHA-256 and digests of the storage dump: no deck order, no Wizard hand, no engine seed state.
//
// Join: refuses on the first failure, in this order: a receipt is missing or unreadable; its keys differ from
// the schema; the receipts are not seed 0 then seed 60; a receipt did not pass; its opening differs from the one
// this tree deals for its seed; its build, revision or HTML digest differ from the page given here or from this
// checkout's HEAD; the two openings share a fingerprint. --join-controls runs the join on the genuine pair and
// on duplicate, swapped, relabelled, missing and stale variants written to a temporary directory; each variant
// must be refused for its own reason. Scripted Chrome: no human played; it says nothing about clarity or fun.
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync} from "node:fs";
import {createServer} from "node:http";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import os from "node:os";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {createShowdownSession, bootHill} from "../src/match/showdown-session.js";
import {choose, newSave, settle} from "../src/game/showdown/progress.js";
import {SAVE_KEY} from "../src/game/showdown/campaign-store.js";
import {TYPES, typeOf} from "../src/game/showdown/cards.js";
import {PLAYTEST_KEY} from "../src/match/showdown-playtest.js";
import {BUILD_LABEL_PATTERN} from "./graybox-build-label.mjs";
import {DIGEST_PATTERN} from "./write-build-identity.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const SEEDS = [0, 60];
// The PR 174 merge this work branches from: the stale control claims that older build.
const BASE = "ce5d2242825f6732626cec365b0847ad40ef91ff";
export const SCHEMA = "showdown-practice-receipt/1";
const USAGE = `usage:
  node scripts/browser-showdown-practice.mjs --seed 0|60 --page FILE.html --out RECEIPT.json
  node scripts/browser-showdown-practice.mjs --join SEED0.json SEED60.json --page FILE.html [--out JOIN.json]
  node scripts/browser-showdown-practice.mjs --join-controls SEED0.json SEED60.json --page FILE.html [--out CONTROLS.json]
Exit 0 on pass, 1 on a failed check or a refused join, 2 on bad arguments.`;

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const git = (...args) => { try { return execFileSync("git", ["-C", root, ...args], {encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]}).trim(); } catch { return null; } };
export const fingerprint = (opening) => sha256(JSON.stringify(opening));

// ---- The public opening -------------------------------------------------------------------------------
// What a player at the cowboy seat can read on the screen: the turn and whose it is, their own hand (card
// types, in order), each Base's orbs and its hand, deck and graveyard counts, and each board slot.
export function expectedOpening(seed) {
  const view = createShowdownSession({seed, duel: bootHill()}).view();
  const side = (s) => ({base: s.base, baseMax: s.baseMax, hand: s.handCount, deck: s.deckCount, graveyard: s.discard.length,
    board: s.board.map((t) => (t ? typeOf(t.cardId) : null))});
  return {turn: view.turn, active: view.active, hand: view.sides.cowboy.hand.map(typeOf),
    cowboy: side(view.sides.cowboy), wizard: side(view.sides.wizard)};
}

// Runs in the page: the same fields, read only from the DOM.
const READ_OPENING = () => {
  const status = document.querySelector("#sd-status")?.textContent.trim() ?? "";
  const m = status.match(/turn (\d+) · (your turn|the Wizards' turn)$/);
  const side = (name) => {
    const base = document.querySelector(`#sd-board [data-side="${name}"] [data-base="${name}"]`);
    const orbs = base?.querySelector(".sd-orbs")?.getAttribute("aria-label")?.match(/^(\d+) of (\d+) orbs$/);
    const counts = base?.textContent.match(/Hand (\d+) · Deck (\d+) · Graveyard (\d+)/);
    const board = [...document.querySelectorAll(`#sd-board [data-side="${name}"] [data-slot^="${name}-"]`)]
      .map((n) => (n.dataset.frame === "troop" ? n.querySelector("strong")?.textContent.trim() ?? "?" : null));
    return {base: Number(orbs?.[1]), baseMax: Number(orbs?.[2]), hand: Number(counts?.[1]), deck: Number(counts?.[2]),
      graveyard: Number(counts?.[3]), board};
  };
  return {status, turn: m ? Number(m[1]) : null, active: m ? (m[2] === "your turn" ? "cowboy" : "wizard") : null,
    handIds: [...document.querySelectorAll("#sd-hand [data-card]")].map((n) => n.dataset.card), cowboy: side("cowboy"), wizard: side("wizard")};
};

// Board slots show card names; the expectation names card types. cards.js maps one to the other.
const cardNames = () => Object.fromEntries(Object.entries(TYPES).map(([id, c]) => [c.name, id]));

function toOpening(read, names) {
  const side = (s) => ({...s, board: s.board.map((n) => (n === null ? null : names[n] ?? `unknown:${n}`))});
  return {turn: read.turn, active: read.active, hand: read.handIds.map(typeOf), cowboy: side(read.cowboy), wizard: side(read.wizard)};
}

// ---- Fixture: an advanced career and one playtest log row (synthetic; nobody's data) -------------------
function fixture() {
  let save = settle(newSave(), "trail", true).save;
  save = choose(save, save.offer[0]);
  return {[SAVE_KEY]: JSON.stringify(save),
    [PLAYTEST_KEY]: JSON.stringify([{name: "Boot Hill", won: true, turns: 9, seconds: 71, rules: false}])};
}

// ---- Browser ------------------------------------------------------------------------------------------
function loadPlaywright() {
  const tryFrom = (base) => { try { return createRequire(base)("playwright-core"); } catch { return null; } };
  const local = tryFrom(path.join(root, "package.json"));
  if (local) return local;
  const bin = (process.env.PATH ?? "").split(path.delimiter).find((dir) => existsSync(path.join(dir, "playwright-core")));
  const found = bin && tryFrom(pathToFileURL(path.join(bin, "..", "x.js")));
  if (found) return found;
  throw new Error("playwright-core not found. Run as: npx -y -p playwright-core@1.64.1 node scripts/browser-showdown-practice.mjs ...");
}

async function serve(html) {
  const server = createServer((req, res) => {
    const {pathname} = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
      res.writeHead(200, {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"}); res.end(html); return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((ok) => server.close(ok))};
}

async function route(browser, {origin, seed, via, expected, names}) {
  const context = await browser.newContext({viewport: {width: 1280, height: 900}});
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [], remote = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await context.route("**/*", (r) => {
    if (/^(http:\/\/127\.0\.0\.1[:/]|data:|blob:|about:)/.test(r.request().url())) return r.continue();
    remote.push(r.request().url()); return r.abort();
  });
  const fail = [];
  let build = null;
  const check = (ok, what) => { if (!ok) fail.push(what); return ok; };
  const dump = () => page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
  const keys = () => page.evaluate(() => Object.keys(localStorage).sort());
  const campText = () => page.evaluate(() => ({text: (document.querySelector("#showdown-camp")?.textContent ?? "").replace(/\s+/g, " ").trim(),
    report: document.querySelector("#camp-report-text")?.value ?? ""}));
  const toCamp = async () => { await page.locator("#menu-play").click(); await page.locator("#showdown-camp").waitFor({state: "visible"}); };
  try {
    await page.goto(origin + "/");
    await page.locator("#menu-play").waitFor({state: "visible"});
    await page.evaluate((f) => { for (const [k, v] of Object.entries(f)) localStorage.setItem(k, v); }, fixture());
    await page.reload();
    await toCamp();
    // Baseline after the page has loaded the planted career once: whatever the page itself normalises is baseline.
    const before = {dump: await dump(), keys: await keys(), camp: await campText()};
    check(before.keys.includes(SAVE_KEY) && before.keys.includes(PLAYTEST_KEY), "planted career and log are in storage");
    // The build the page itself names in the Camp's playtest report (K-087).
    build = before.camp.report.match(/^This report is from game build (\S+)\.$/m)?.[1] ?? null;
    check(build !== null && BUILD_LABEL_PATTERN.test(build), "Camp playtest report names a build label");
    check(await page.locator("#camp-practice").getAttribute("data-build") === build, "#camp-practice[data-build] is the same label");
    const url = `/?practice=${seed}`;
    if (via === "camp") {
      await page.locator("#camp-practice > summary").click();
      const link = page.locator(`#camp-practice-${seed}`);
      check(await link.getAttribute("href") === `?practice=${seed}`, `#camp-practice-${seed} links to ?practice=${seed}`);
      await link.click();
    } else {
      await page.goto(origin + url);
    }
    await page.locator("#showdown").waitFor({state: "visible"});
    await page.locator("#sd-hand [data-card]").first().waitFor({state: "visible"});
    const read = await page.evaluate(READ_OPENING);
    const opening = toOpening(read, names);
    check(JSON.stringify(opening) === JSON.stringify(expected), "opening equals the engine's fresh Boot Hill deal for this seed");
    check(read.status.startsWith("Practice: Boot Hill · turn 1"), "status reads 'Practice: Boot Hill · turn 1 ...'");
    // First action: the first enabled hand card, a real click (Playwright checks it is visible, enabled and on top).
    const card = await page.locator("#sd-hand [data-card]:enabled").first().getAttribute("data-card");
    const logBefore = await page.locator("#sd-log li").count();
    const troopsBefore = await page.locator('#sd-board [data-side="cowboy"] .sd-slot[data-frame="troop"]').count();
    await page.locator(`#sd-hand [data-card="${card}"]`).click();
    await page.waitForFunction(([c, n]) => !document.querySelector(`#sd-hand [data-card="${c}"]`)
      && document.querySelectorAll('#sd-board [data-side="cowboy"] .sd-slot[data-frame="troop"]').length === n + 1, [card, troopsBefore]).catch(() => {});
    const after = await page.evaluate(READ_OPENING);
    const feedback = (await page.locator("#sd-feedback").textContent())?.trim() ?? "";
    const firstAction = {card: typeOf(card), handBefore: read.handIds.length, handAfter: after.handIds.length,
      troopsBefore, troopsAfter: await page.locator('#sd-board [data-side="cowboy"] .sd-slot[data-frame="troop"]').count(),
      logBefore, logAfter: await page.locator("#sd-log li").count(), feedback};
    check(!after.handIds.includes(card) && firstAction.handAfter === firstAction.handBefore - 1, "first card left the hand");
    check(firstAction.troopsAfter === troopsBefore + 1 && toOpening(after, names).cowboy.board.includes(typeOf(card)),
      "that card's troop is on the cowboy board");
    check(firstAction.logAfter > logBefore && /^Last: .* arrived\.$/.test(feedback), "event log grew and feedback reads 'Last: ... arrived.'");
    // Return: the screen's own Back to camp.
    await page.locator("#sd-home").click();
    await page.locator("#showdown-camp").waitFor({state: "visible"});
    if (via === "camp") check(await page.evaluate(() => document.activeElement?.id) === `camp-practice-${seed}`, "Back to camp focuses the link that opened it");
    const back = {dump: await dump(), keys: await keys(), camp: await campText()};
    if (via === "direct") { await page.goto(origin + "/"); await toCamp(); back.reloaded = {dump: await dump(), camp: await campText()}; }
    check(back.dump === before.dump, "every localStorage key and value unchanged on return");
    check(back.camp.text === before.camp.text && back.camp.report === before.camp.report, "Camp text and playtest report unchanged on return");
    if (back.reloaded) check(back.reloaded.dump === before.dump && back.reloaded.camp.report === before.camp.report, "unchanged after a fresh load of the root");
    check(!errors.length, "no page or console errors");
    check(!remote.length, "no request left loopback");
    return {build, url: via === "camp" ? "/ -> Play -> Camp -> #camp-practice -> #camp-practice-" + seed : url, status: read.status,
      opening, fingerprint: fingerprint(opening), firstAction,
      storage: {keys: before.keys, before: sha256(before.dump), after: sha256(back.dump), unchanged: back.dump === before.dump},
      campUnchanged: back.camp.text === before.camp.text && back.camp.report === before.camp.report,
      errors: errors.length, remote: remote.length, failures: fail};
  } catch (e) {
    return {build, url: via, failures: [...fail, `${via} route threw: ${e.message.split("\n")[0]}`], errors: errors.length, remote: remote.length};
  } finally { await context.close(); }
}

export async function pageInfo(file) {
  const html = await readFile(file);
  const text = html.toString("utf8");
  if (!text.includes('id="menu-play"')) throw new Error(`${file} is not the graybox page (no #menu-play); run node scripts/build-graybox.mjs --hosted`);
  return {html, text, info: {file: path.relative(root, path.resolve(file)) || file, bytes: html.length, sha256: sha256(html)}};
}

async function runSeed({seed, page: file, out}) {
  const {html, text, info} = await pageInfo(file);
  const revision = git("rev-parse", "HEAD");
  const failures = [];
  const expected = expectedOpening(seed);
  const names = cardNames();
  const server = await serve(html);
  const {chromium} = loadPlaywright();
  const browser = await chromium.launch({executablePath: CHROME, headless: true});
  let routes;
  try {
    routes = {camp: await route(browser, {origin: server.origin, seed, via: "camp", expected, names}),
      direct: await route(browser, {origin: server.origin, seed, via: "direct", expected, names})};
  } finally { await browser.close(); await server.close(); }
  for (const [via, r] of Object.entries(routes)) failures.push(...r.failures.map((f) => `${via}: ${f}`));
  const builds = Object.values(routes).map((r) => r.build);
  if (builds[0] !== builds[1]) failures.push("Camp and direct loads name different builds");
  if (builds[0] && !text.includes(`"${builds[0]}"`)) failures.push("the named build label is not in the HTML file");
  info.build = builds[0];
  for (const r of Object.values(routes)) delete r.build;
  if (routes.camp.fingerprint && routes.camp.fingerprint !== routes.direct.fingerprint) failures.push("Camp and direct openings differ");
  const receipt = {schema: SCHEMA, seed, revision, page: info, chrome: browser.version(),
    expected: {opening: expected, fingerprint: fingerprint(expected)}, routes, failures, pass: failures.length === 0};
  await mkdir(path.dirname(path.resolve(out)), {recursive: true});
  await writeFile(path.resolve(out), JSON.stringify(receipt, null, 2) + "\n");
  console.log(`seed ${seed}: ${receipt.pass ? "PASS" : "FAIL"} · build ${info.build} · html sha256 ${info.sha256} · fingerprint ${receipt.expected.fingerprint.slice(0, 16)} · receipt ${out}`);
  if (!receipt.pass) console.log(`first failure: ${failures[0]}`);
  return receipt.pass;
}

// ---- Join ---------------------------------------------------------------------------------------------
const ROUTE_KEYS = ["url", "status", "opening", "fingerprint", "firstAction", "storage", "campUnchanged", "errors", "remote", "failures"];
const sameKeys = (o, keys) => o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).sort().join() === [...keys].sort().join();

export async function join(files, {page: file, head = git("rev-parse", "HEAD")}) {
  const {text, info} = await pageInfo(file);
  const refuse = (reason) => ({schema: "showdown-practice-join/1", pass: false, failure: reason, page: info});
  const receipts = [];
  for (const f of files) {
    if (!f || !existsSync(f)) return refuse(`missing receipt: ${f ?? "(none given)"}`);
    try { receipts.push(JSON.parse(await readFile(f, "utf8"))); } catch (e) { return refuse(`unreadable receipt ${f}: ${e.message}`); }
  }
  if (receipts.length !== SEEDS.length) return refuse(`expected ${SEEDS.length} receipts, got ${receipts.length}`);
  for (const [i, r] of receipts.entries()) {
    const at = `receipt ${i + 1} (${files[i]})`;
    if (!sameKeys(r, ["schema", "seed", "revision", "page", "chrome", "expected", "routes", "failures", "pass"]) || r.schema !== SCHEMA
      || !sameKeys(r.page, ["file", "bytes", "sha256", "build"]) || !sameKeys(r.routes, ["camp", "direct"])
      || !sameKeys(r.routes.camp, ROUTE_KEYS) || !sameKeys(r.routes.direct, ROUTE_KEYS) || !sameKeys(r.expected, ["opening", "fingerprint"]))
      return refuse(`${at}: keys differ from ${SCHEMA}`);
    if (r.seed !== SEEDS[i]) return refuse(`${at}: is seed ${r.seed}, expected seed ${SEEDS[i]} in this position`);
    if (r.pass !== true || r.failures.length) return refuse(`${at}: did not pass (${r.failures[0] ?? "pass is not true"})`);
    const want = fingerprint(expectedOpening(r.seed));
    for (const [name, got] of [["expected", r.expected], ["camp", r.routes.camp], ["direct", r.routes.direct]])
      if (fingerprint(got.opening) !== got.fingerprint || got.fingerprint !== want)
        return refuse(`${at}: ${name} opening is not the seed-${r.seed} deal this tree computes`);
    if (!DIGEST_PATTERN.test(r.page.sha256) || r.page.sha256 !== info.sha256) return refuse(`${at}: page sha256 ${r.page.sha256.slice(0, 12)} is not this page's ${info.sha256.slice(0, 12)} (stale or other build)`);
    if (!head || r.revision !== head || r.page.build !== head.slice(0, 12) || !text.includes(`"${r.page.build}"`))
      return refuse(`${at}: revision ${String(r.revision).slice(0, 12)} / page build ${r.page.build} is not this checkout's HEAD ${String(head).slice(0, 12)}`);
  }
  if (receipts[0].expected.fingerprint === receipts[1].expected.fingerprint) return refuse("the two openings share a fingerprint");
  return {schema: "showdown-practice-join/1", pass: true, failure: null, page: info, revision: head,
    seeds: receipts.map((r) => ({seed: r.seed, fingerprint: r.expected.fingerprint, hand: r.expected.opening.hand}))};
}

async function joinControls(files, opts) {
  const [r0, r60] = await Promise.all(files.map(async (f) => JSON.parse(await readFile(f, "utf8"))));
  const dir = await mkdtemp(path.join(os.tmpdir(), "practice-join-controls-"));
  const put = async (name, value) => { const f = path.join(dir, `${name}.json`); await writeFile(f, JSON.stringify(value)); return f; };
  const stale = structuredClone(r60);
  stale.revision = BASE; stale.page.build = BASE.slice(0, 12); stale.page.sha256 = sha256("an older build");
  const relabel = {...structuredClone(r60), seed: 0};
  const cases = [
    {name: "genuine", files, accept: true},
    {name: "duplicate", files: [files[0], files[0]], reason: /is seed 0, expected seed 60/},
    {name: "swapped", files: [files[1], files[0]], reason: /is seed 60, expected seed 0/},
    {name: "relabelled", files: [await put("relabelled", relabel), files[1]], reason: /not the seed-0 deal/},
    {name: "missing", files: [files[0], path.join(dir, "absent.json")], reason: /missing receipt/},
    {name: "stale", files: [files[0], await put("stale", stale)], reason: /stale or other build/},
  ];
  const results = [];
  try {
    for (const c of cases) {
      const r = await join(c.files, opts);
      const ok = c.accept ? r.pass : !r.pass && c.reason.test(r.failure);
      results.push({control: c.name, expected: c.accept ? "accept" : "refuse", joinPass: r.pass, failure: r.failure, ok});
      console.log(`${ok ? "ok  " : "BAD "} ${c.name}: ${r.pass ? "accepted" : `refused: ${r.failure.replace(dir, "<tmp>")}`}`);
    }
  } finally { await rm(dir, {recursive: true, force: true}); }
  return results.map((r) => ({...r, failure: r.failure?.replace(dir, "<tmp>") ?? null}));
}

// ---- CLI ----------------------------------------------------------------------------------------------
async function main(argv) {
  if (argv.includes("--help") || argv.includes("-h") || !argv.length) { console.log(USAGE); return 0; }
  const opt = (name) => { const i = argv.indexOf(name); return i < 0 ? null : argv[i + 1]; };
  const page = opt("--page"), out = opt("--out");
  const bad = (msg) => { console.error(`${msg}\n${USAGE}`); return 2; };
  if (!page) return bad("--page is required");
  for (const mode of ["--join", "--join-controls"]) {
    const i = argv.indexOf(mode);
    if (i < 0) continue;
    const files = argv.slice(i + 1, i + 3);
    if (files.length !== 2 || files.some((f) => f.startsWith("--"))) return bad(`${mode} takes two receipt paths`);
    const result = mode === "--join" ? await join(files, {page}) : await joinControls(files, {page});
    const pass = mode === "--join" ? result.pass : result.every((r) => r.ok);
    if (out) { await mkdir(path.dirname(path.resolve(out)), {recursive: true}); await writeFile(path.resolve(out), JSON.stringify(result, null, 2) + "\n"); }
    if (mode === "--join") console.log(result.pass ? `join: PASS · revision ${result.revision} · html sha256 ${result.page.sha256} · fingerprints ${result.seeds.map((s) => `${s.seed}=${s.fingerprint.slice(0, 16)}`).join(" ")}`
      : `join: REFUSED · ${result.failure}`);
    else console.log(`join controls: ${pass ? "PASS" : "FAIL"} (${result.filter((r) => r.ok).length}/${result.length} as expected)`);
    return pass ? 0 : 1;
  }
  const seed = Number(opt("--seed"));
  if (opt("--seed") === null || !SEEDS.includes(seed) || String(seed) !== opt("--seed")) return bad("--seed must be 0 or 60");
  if (!out) return bad("--out is required");
  return (await runSeed({seed, page, out})) ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await main(process.argv.slice(2));
