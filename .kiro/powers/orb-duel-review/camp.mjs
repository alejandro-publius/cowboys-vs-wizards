// Camp-routed Outrider case (K-039 stage 3). Uses the bound game's own K-011 gate (scripts/outrider-gate.mjs) for
// semantic freshness: both arms are replayed in the bound tree and must match the measured results and the gate's
// committed transcript digests. File hashes decide nothing here. A link is issued only for a built page that carries
// this tree's exact build label (no "+local") and this case's exact replay entry in its verified list, so a stale or
// missing page cannot stand in for the current head. Judge-only outcomes are kept apart from the public position.
import {createHash} from "node:crypto";
import {existsSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {pathToFileURL} from "node:url";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const DECISION = "experiments/showdown-outrider/decision/";
// The two pages the build writes; the hosted one is what GitHub Pages serves at the site root.
export const PAGES = [
  {id: "hosted", path: "dist/web/index.html", build: "node scripts/build-graybox.mjs --hosted", serve: "dist/web", at: "/"},
  {id: "standalone", path: "dist/cowboys-vs-wizards-board-duel.html", build: "npm run build", serve: "dist", at: "/cowboys-vs-wizards-board-duel.html"},
];
// Uncommon on purpose: 8765 was already held by an unrelated long-running server on this Mac (K-039 stage 3).
export const LOCAL_PORT = 47391;

// esbuild's minified form of the JSON the build defines (identifier keys unquoted, no spaces).
export function minified(value) {
  if (Array.isArray(value)) return `[${value.map(minified).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).map(([k, v]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}:${minified(v)}`).join(",")}}`;
  return JSON.stringify(value);
}

// Bases and standing troops at the start of each Cowboy decision turn where either changed, after the arm action. Measured from one replay.
function basesLine(createShowdownSession, outriderDuel, entry, arm, continuation) {
  const {seed, duel} = outriderDuel(entry);
  const session = createShowdownSession({seed, duel});
  session.act(entry.arms[arm]);
  const line = [];
  const point = (view) => ({turn: view.turn, bases: [view.sides.cowboy.base, view.sides.wizard.base],
    troops: [view.sides.cowboy.board.filter(Boolean).length, view.sides.wizard.board.filter(Boolean).length]});
  let turn = null;
  for (let n = 0; n < 4000 && !session.view().result; n++) {
    const view = session.view();
    const next = point(view);
    const last = line.at(-1);
    if (view.turn !== turn && (!last || !same([last.bases, last.troops], [next.bases, next.troops]))) line.push(next);
    turn = view.turn;
    session.act(continuation(view, session.legal()));
  }
  line.push(point(session.view()));
  return line;
}

export async function inspectCampCase(root, receipt, gitCommit) {
  const label = receipt.derive.label;
  const at = (rel) => import(pathToFileURL(join(root, rel)).href);
  const [gate, outrider, session, labels] = await Promise.all([at("scripts/outrider-gate.mjs"), at("src/match/showdown-outrider.js"),
    at("src/match/showdown-session.js"), at("scripts/graybox-build-label.mjs")]);
  const reasons = [];
  let verdict = "pass";
  const fail = (v, why) => { if (verdict === "pass") verdict = v; reasons.push(why); };

  // 1. Semantic freshness, by the game's own gate on this tree.
  const decision = await gate.loadDecision(gate.DEFAULT_DIR, root);
  if (decision.missing.length) return {verdict: "absent", reasons: [`decision files missing: ${decision.missing.join(", ")}`]};
  const entry = decision.cases.find((c) => c.id === label);
  if (!entry) return {verdict: "absent", reasons: ["the case is not in the decision files"]};
  const receiptFile = join(root, gate.DEFAULT_RECEIPT);
  const gateReceipt = existsSync(receiptFile) ? JSON.parse(readFileSync(receiptFile, "utf8")) : null;
  const [row] = gate.replayAll({...decision, cases: [entry]});
  const [judged] = gate.judge([row], gateReceipt);
  if (!judged.fresh) fail("stale", `gate: ${judged.problems.join("; ")}`);

  // 2. The public position a fresh session lands on, against the search's public file.
  const {seed, duel} = outrider.outriderDuel(entry);
  const landing = session.createShowdownSession({seed, duel});
  const position = landing.view();
  const shown = JSON.parse(readFileSync(join(root, DECISION, "positions.json"), "utf8")).find((p) => p.label === label);
  if (!shown || !same(shown.view, position)) fail("rejected", "fresh session position differs from positions.json");
  for (const arm of ["ride", "fight"]) if (!landing.legal().some((a) => same(a, entry.arms[arm]))) fail("rejected", `${arm} is not legal at the landing`);
  const positionSha256 = sha(JSON.stringify(position));
  if (receipt.decision?.positionSha256 && receipt.decision.positionSha256 !== positionSha256) fail("rejected", "position differs from the Power receipt");

  // 3. Built pages: this tree's label, not "+local", and this case's exact entry in the page's verified list.
  const game = gitCommit(root);
  const sourceLabel = labels.grayboxBuildLabel(root);
  const shipped = minified({id: entry.id, setup: entry.setup, seed: entry.seed, prefix: entry.prefix, at: entry.at});
  const pages = PAGES.map((page) => {
    const file = join(root, page.path);
    if (!existsSync(file)) return {id: page.id, path: page.path, current: false, problem: `absent: run ${page.build}`};
    const text = readFileSync(file, "utf8");
    const out = {id: page.id, path: page.path, sha256: sha(text)};
    if (!sourceLabel) return {...out, current: false, problem: "the bound tree has no build label (no git)"};
    if (sourceLabel.endsWith("+local")) return {...out, current: false, problem: "the bound tree has uncommitted page sources: a page cannot be tied to a commit"};
    if (!text.includes(`"${sourceLabel}"`) || text.includes(`"${sourceLabel}+local"`)) return {...out, current: false, problem: `page was not built from ${sourceLabel}: rebuild with ${page.build}`};
    if (!text.includes(shipped)) return {...out, current: false, problem: "page does not carry this case in its verified list"};
    return {...out, current: true, label: sourceLabel};
  });
  const query = `?outrider=${encodeURIComponent(label)}`;
  const usable = pages.filter((p) => p.current);
  const local = usable.length ? (() => {
    const page = PAGES.find((p) => p.id === usable[0].id);
    return {verified: "page bytes at this head; open in a browser to see the decision",
      serve: `python3 -m http.server ${LOCAL_PORT} --bind 127.0.0.1 --directory ${join(root, page.serve)}`,
      url: `http://127.0.0.1:${LOCAL_PORT}${page.at}${query}`, file: `${pathToFileURL(join(root, page.path)).href}${query}`};
  })() : null;
  if (!local) fail("stale", `no current built page: ${pages.map((p) => `${p.id} ${p.problem}`).join("; ")}`);
  const mirror = receipt.route.publicMirror;
  const publicLink = {url: `${mirror}${query}`, buildJson: `${mirror}build.json`,
    live: "not checked by this tool (no network)",
    rule: `live for this head only when ${mirror}build.json reports commit ${game.commit}; otherwise the mirror opens the normal menu or an older build`};

  // 4. Judge-only: the measured lines of this one example. Never part of the position.
  const continuation = decision.continuation;
  const measured = verdict === "pass" ? {
    columns: "bases and troops are [Cowboy, Wizard]",
    note: "Judge-only. One deterministic line per choice: the search's continuation policy for the Cowboys and the shipped Bone Fence bot. Not a forced result, not human play, and true of this example only.",
    ride: {winner: row.arms.ride.outcome.winner, turn: row.arms.ride.outcome.turn, line: basesLine(session.createShowdownSession, outrider.outriderDuel, entry, "ride", continuation)},
    decline: {winner: row.arms.fight.outcome.winner, turn: row.arms.fight.outcome.turn, line: basesLine(session.createShowdownSession, outrider.outriderDuel, entry, "fight", continuation)},
  } : null;
  if (measured) {
    const observed = JSON.parse(readFileSync(join(root, DECISION, "results/observed.json"), "utf8"))[label];
    if (!observed || observed.ride.winner !== measured.ride.winner || observed.fight.winner !== measured.decline.winner) fail("rejected", "replayed winners differ from results/observed.json");
  }
  const holdout = JSON.parse(readFileSync(join(root, DECISION, "results/holdout-1200-1299.json"), "utf8"));

  const advice = [];
  if (verdict !== "pass") advice.push(`decision verdict is ${verdict}`);
  if (!local) advice.push("no current built page to open");
  return {
    verdict, reasons,
    game: {commit: game.commit, ref: game.ref, sourceLabel},
    gate: {fresh: judged.fresh, receipt: gate.DEFAULT_RECEIPT},
    pages, links: {local, public: publicLink},
    decision: {turn: position.turn, positionSha256, ride: entry.arms.ride, decline: entry.arms.fight, position},
    judgeOnly: verdict === "pass" ? measured : null,
    advice: {allowed: advice.length === 0, scope: "this example only", general: false,
      generalReason: holdout.supported ? "a holdout-supported cue exists" : "the pre-registered cue failed its holdout test: no general reason to decline is supported",
      reasons: advice},
  };
}
