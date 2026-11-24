// Referee browser audit of the illustrated Showdown page (the staged dist/web/index.html).
// It replays externally supplied referee transcripts through the page's own controls (mouse clicks
// via Playwright) and records what the page visibly shows after every move, read by
// src/ui/showdown-3d/referee-observer.js. No engine or session state is read from the page.
//
// Entry: ?seed=<seed>, Play (#menu-play), Camp > Two players, one screen ([data-two="1"]), then #sd-ready.
// That deal is createShowdown(seed, {decks: DECKS}); a transcript is reachable only when its first side and
// ordered decks equal it. scripts/referee/browser-transcripts.mjs builds reachable transcripts (frozen-corpus
// "primary" ones, or "public" ones played from the public deal) with the frozen referee's result attached.
//
//   node scripts/referee/browser.mjs --transcripts <cohort.jsonl|json> --canary [--seed N]
//   node scripts/referee/browser.mjs --transcripts <cohort.jsonl|json> --cohort
//   node scripts/referee/browser.mjs --transcripts <cohort.jsonl|json> --full
//
// Flags
//   --transcripts <file>  JSON array or JSON Lines of referee transcripts (required)
//   --canary              one duel: the first transcript, or the one named by --seed
//   --cohort              every transcript, 1 to 250 distinct complete duels, primary or public; never a release receipt
//   --full                the release cohort; it must be exactly 250 distinct complete primary duels
//   --seed <n>            with --canary, the transcript to run
//   --page <file>         staged page (default dist/web/index.html)
//   --out <dir>           report directory (default .artifacts/referee-browser-<canary|cohort>, or
//                         .artifacts/referee-browser for --full, the directory the release gate reads)
//   --chrome <path>       Chrome executable (default the macOS Google Chrome app)
//   --jobs <n>            concurrent isolated Chrome contexts, 1 to 8 (default 1)
//   --reduced-motion      emulate prefers-reduced-motion (default: full animation, waited out)
//   --settle-ms <n>       longest wait for one move's animation to settle (default 15000); past it the duel stops, interrupted
//   --compare             refused: comparison comes only from the referee result inside each transcript
//
// A transcript is {duel: {seed, first, decks: {cowboy, wizard}, actions}, ...} or those duel fields at
// the top level. cardNames ({catalogId: printed name}) may be on the transcript or its duel.
// With referee.result (the unchanged proof/referee/referee.py --stream line for that duel), each step is
// judged against it: a step the referee accepted must be taken by the page, a step it rejected must be
// refused through a visible refusal (an absent or disabled control, or a pick the page leaves open) with
// the table unchanged, and after every step the visible public table must equal the referee's state.
// browser.gestureGaps[i], when set, names an action the page has no gesture for; it is never clicked and
// its duel is incomplete. Without referee.result a refused move is incomplete, never a pass.
// A wait that runs out is not a referee decision: a table not at rest within --settle-ms, or a click that never
// lands (Playwright's click timeout), stops the duel at once as incomplete, under an "interrupted.settle" or
// "interrupted.click" field. Nothing after it is clicked, retried or judged. A mismatch is only a disagreement seen
// on a settled table or a visible refusal, so an interruption cannot turn into one and can never count as a pass.
//
// Exit codes: 0 every duel driven to a visible result with no failed assertion; 1 a mismatch or an
// incomplete (including interrupted) duel; 2 bad input or flags; 3 Playwright or Chrome unavailable.
import {createHash} from "node:crypto";
import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {validateManifest} from "../write-build-identity.mjs";
import {canonicalJson, dealDigest} from "./prove.mjs";

export const COHORT_SIZE = 250;
const MAX_JOBS = 8;
export const SIDES = ["cowboy", "wizard"];
export const ACTION_TYPES = ["summon", "spell", "gear", "location", "set", "attack", "cover", "end"];
const OBSERVER = fileURLToPath(new URL("../../src/ui/showdown-3d/referee-observer.js", import.meta.url));
const DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// The page has no control that loads a supplied deal. Named here once so every report uses the same words.
export const MISSING_DEAL_CONTROL = "No public control loads a supplied ordered deck pair and starting side. " +
  "?seed=N with Camp > Two players deals the starter decks through createShowdown, which shuffles them and draws " +
  "the starting side from the seed; a transcript deal is reachable only when it equals that shuffle " +
  "(engine.mjs seededDeal(seed, DECKS); scripts/referee/browser-transcripts.mjs builds such transcripts).";

export const MODES = ["canary", "cohort", "full"];
export const DEFAULT_OUT = Object.freeze({canary: ".artifacts/referee-browser-canary", cohort: ".artifacts/referee-browser-cohort",
  full: ".artifacts/referee-browser"});
// "primary": a frozen corpus duel. "public": played from the public deal by browser-transcripts.mjs, never a release receipt.
export const CORPUS_LABELS = ["primary", "public"];

export function parseArgs(argv) {
  const opts = {mode: null, transcripts: null, seed: null, page: "dist/web/index.html", out: null,
    chrome: DEFAULT_CHROME, reducedMotion: false, settleMs: 15000, compare: false, jobs: 1};
  const value = (i, flag) => {
    if (i + 1 >= argv.length) throw new Error(`${flag} needs a value`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (MODES.includes(flag.slice(2)) && flag.startsWith("--")) {
      if (opts.mode) throw new Error("choose one of --canary, --cohort and --full");
      opts.mode = flag.slice(2);
    } else if (flag === "--reduced-motion") opts.reducedMotion = true;
    else if (flag === "--compare") opts.compare = true;
    else if (["--transcripts", "--page", "--out", "--chrome", "--seed", "--settle-ms", "--jobs"].includes(flag)) {
      const v = value(i++, flag);
      if (flag === "--jobs") {
        opts.jobs = Number(v);
        if (!/^\d+$/.test(v) || opts.jobs < 1 || opts.jobs > MAX_JOBS) throw new Error(`--jobs must be a whole number from 1 to ${MAX_JOBS}`);
      } else if (flag === "--seed" || flag === "--settle-ms") {
        if (!/^\d+$/.test(v)) throw new Error(`${flag} must be a whole number`);
        opts[flag === "--seed" ? "seed" : "settleMs"] = Number(v);
      } else opts[flag.slice(2)] = v;
    } else throw new Error(`unknown flag ${flag}`);
  }
  if (opts.compare) throw new Error("--compare is refused: the referee is frozen, and comparison comes only from the referee result inside each transcript");
  if (!opts.mode) throw new Error("pass --canary (one duel), --cohort (1 to 250 duels) or --full (the 250-duel release cohort)");
  if (!opts.transcripts) throw new Error("pass --transcripts <file>");
  if (opts.seed !== null && opts.mode !== "canary") throw new Error("--seed applies to --canary only");
  opts.out ??= DEFAULT_OUT[opts.mode];
  return opts;
}

// "cowboy-sheriff-2" -> {catalogId: "cowboy-sheriff", copy: 2}.
export function decodeInstanceId(id) {
  const m = /^([a-z]+(?:-[a-z]+)*)-(\d+)$/.exec(String(id));
  return m ? {catalogId: m[1], copy: Number(m[2])} : null;
}

export function parseTranscripts(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) return JSON.parse(trimmed);
  return trimmed.split(/\r?\n/).filter((line) => line.trim()).map((line, n) => {
    try { return JSON.parse(line); } catch (error) { throw new Error(`line ${n + 1}: ${error.message}`); }
  });
}

const actionOf = (entry) => (entry && typeof entry === "object" && entry.action && typeof entry.action === "object" ? entry.action : entry);

// The boundary-contract duel of one transcript, with its problems.
export function duelOf(transcript) {
  const duel = transcript?.duel ?? transcript;
  const problems = [];
  if (!duel || typeof duel !== "object") return {duel: null, problems: ["transcript is not an object"]};
  if (!Number.isInteger(duel.seed) || duel.seed < 0) problems.push("seed must be a non-negative integer");
  if (!SIDES.includes(duel.first)) problems.push("first must be cowboy or wizard");
  for (const side of SIDES) {
    const deck = duel.decks?.[side];
    if (!Array.isArray(deck) || !deck.length) { problems.push(`decks.${side} must be a non-empty list`); continue; }
    const bad = deck.filter((id) => !decodeInstanceId(id));
    if (bad.length) problems.push(`decks.${side} has ids that do not decode: ${bad.slice(0, 3).join(", ")}`);
    if (new Set(deck).size !== deck.length) problems.push(`decks.${side} repeats a card instance id`);
  }
  if (!Array.isArray(duel.actions)) problems.push("actions must be a list");
  else duel.actions.forEach((entry, i) => {
    const a = actionOf(entry);
    if (!ACTION_TYPES.includes(a?.type)) problems.push(`action ${i} has unsupported type ${JSON.stringify(a?.type)}`);
  });
  const cardNames = transcript?.cardNames ?? duel.cardNames ?? null;
  const actions = (duel.actions ?? []).map(actionOf);
  const {referee, problems: refereeProblems} = refereeOf(transcript, actions.length);
  problems.push(...refereeProblems);
  const gaps = transcript?.browser?.gestureGaps ?? null;
  if (gaps !== null && (!Array.isArray(gaps) || gaps.length !== actions.length)) problems.push("browser.gestureGaps must list one entry per action");
  return {duel: {seed: duel.seed, first: duel.first, decks: duel.decks, actions, cardNames, referee, gaps: Array.isArray(gaps) ? gaps : null}, problems};
}

// The frozen referee's verdicts for a transcript: referee.result is its unchanged referee.py --stream line,
// {seed, initial, steps: [{accepted, state, error}], unsupported}. Absent: {referee: null}.
export function refereeOf(transcript, actionCount) {
  const result = transcript?.referee?.result;
  if (result === undefined) return {referee: null, problems: []};
  const problems = [];
  if (!result || typeof result !== "object" || !result.initial || !Array.isArray(result.steps)) problems.push("referee.result has no initial state and steps");
  else if (result.steps.length !== actionCount) problems.push(`referee.result has ${result.steps.length} steps for ${actionCount} actions`);
  else {
    if (Array.isArray(result.unsupported) && result.unsupported.length) problems.push(`referee.result lists unsupported rules: ${result.unsupported.slice(0, 3).join("; ")}`);
    const bad = result.steps.findIndex((s) => typeof s?.accepted !== "boolean" || !s.state?.players);
    if (bad >= 0) problems.push(`referee step ${bad} has no accepted flag and state`);
  }
  if (problems.length) return {referee: null, problems};
  return {referee: {initial: result.initial, steps: result.steps.map((s) => ({accepted: s.accepted, state: s.state, error: s.error ?? null}))}, problems};
}

export const dealKey = (duel) => createHash("sha256").update(JSON.stringify([duel.first, duel.decks.cowboy, duel.decks.wizard])).digest("hex");

// Cohort selection only reads whether the referee marked the duel complete and from which corpus.
// It does not read any referee state for comparison.
export function isComplete(transcript) {
  if (transcript?.complete === true || transcript?.terminal === true) return true;
  const result = transcript?.result ?? transcript?.final?.result ?? transcript?.final;
  return Boolean(result && typeof result === "object" && "winner" in result);
}

export function validateCohort(transcripts, {mode, seed = null}) {
  const errors = [];
  const duels = [];
  transcripts.forEach((t, i) => {
    const {duel, problems} = duelOf(t);
    for (const p of problems) errors.push(`transcript ${i}: ${p}`);
    const corpus = t?.corpus ?? t?.duel?.corpus;
    if (corpus !== undefined && !CORPUS_LABELS.includes(corpus)) errors.push(`transcript ${i}: corpus is ${JSON.stringify(corpus)}, not primary`);
    if (mode === "full" && corpus === "public") errors.push(`transcript ${i}: corpus is "public"; --full takes primary corpus duels only`);
    if (!isComplete(t)) errors.push(`transcript ${i}: not marked complete (complete/terminal flag or a result with a winner)`);
    if (duel) duels.push(duel);
  });
  if (mode === "full" || mode === "cohort") {
    if (mode === "full" && transcripts.length !== COHORT_SIZE) errors.push(`the full cohort must be exactly ${COHORT_SIZE} duels, got ${transcripts.length}`);
    if (mode === "cohort" && (transcripts.length < 1 || transcripts.length > COHORT_SIZE)) errors.push(`a cohort is 1 to ${COHORT_SIZE} duels, got ${transcripts.length}`);
    const seeds = new Map(), deals = new Map();
    duels.forEach((d, i) => {
      if (seeds.has(d.seed)) errors.push(`transcripts ${seeds.get(d.seed)} and ${i} share seed ${d.seed}`);
      else seeds.set(d.seed, i);
      if (!d.decks?.cowboy || !d.decks?.wizard) return;
      const key = dealKey(d);
      if (deals.has(key)) errors.push(`transcripts ${deals.get(key)} and ${i} have the same deal`);
      else deals.set(key, i);
    });
  }
  let selected = duels;
  if (mode === "canary") {
    selected = seed === null ? duels.slice(0, 1) : duels.filter((d) => d.seed === seed).slice(0, 1);
    if (!selected.length) errors.push(seed === null ? "no transcript to run" : `no transcript has seed ${seed}`);
  }
  return {errors, selected, seeds: selected.map((d) => d.seed)};
}

// The page clicks for one action, as selectors in order. The page decides legality; a control that is
// missing or disabled is a visible rejection, recorded with the selector.
export function planControls(action) {
  const card = (id) => ({click: `#sd-hand [data-card="${id}"]`, what: `hand card ${id}`});
  const own = (slot) => ({click: `#sd-board [data-own="${slot}"]`, what: `own troop slot ${slot}`});
  const enemy = (target) => ({click: `#sd-board [data-enemy="${target}"]`, what: target === "base" ? "enemy Base" : `enemy troop slot ${target}`});
  switch (action?.type) {
    case "summon": return {steps: [card(action.cardId), ...(action.tributes ?? []).map(own)]};
    case "spell": return {steps: [card(action.cardId), ...(action.target === undefined || action.target === null ? [] : [enemy(action.target)])]};
    case "gear": return {steps: [card(action.cardId), own(action.slot)]};
    case "location":
    case "set": return {steps: [card(action.cardId)]};
    case "attack": return {steps: [own(action.slot), enemy(action.target)]};
    case "cover": return {steps: [own(action.slot), {click: "#sd-cover", what: "Take cover button"}]};
    case "end": return {steps: [{click: "#sd-end", what: "End turn button"}]};
    default: return {steps: [], unsupported: `action type ${JSON.stringify(action?.type)} has no page control`};
  }
}

// The visible opening hand must be the first cards of the transcript deck of the side shown, in order.
export function checkOpening(duel, obs) {
  const problems = [];
  if (obs?.status?.active !== duel.first) problems.push(`page opens with ${obs?.status?.active ?? "no active side"}, transcript first is ${duel.first}`);
  const side = obs?.viewer;
  const shown = (obs?.hand ?? []).map((c) => c.id);
  const deck = side ? duel.decks[side] ?? [] : [];
  const expected = deck.slice(0, shown.length);
  if (!side) problems.push("no viewing seat on the board");
  else if (!shown.length) problems.push("no hand card visible");
  else if (shown.join() !== expected.join()) problems.push(`visible ${side} hand [${shown.join(", ")}] is not the deck's first ${shown.length} [${expected.join(", ")}]`);
  return problems;
}

// The parts of an observation that a rejected action must leave unchanged (animation state excluded).
export function stableView(obs) {
  if (!obs) return null;
  return JSON.stringify({curtain: obs.curtain, status: obs.status, sides: obs.sides, hand: obs.hand.map((c) => [c.id, c.enabled]),
    location: obs.location, graveyards: obs.graveyards, labels: obs.world?.labels?.map((l) => [l.title, l.count]) ?? null});
}

// Page-internal consistency of one observation: DOM against the 3D labels and the hand list. These are
// assertions on the page, not on the referee. Returns [{name, pass, detail}].
export function selfChecks(obs) {
  const out = [];
  const check = (name, pass, detail) => out.push({name, pass: Boolean(pass), ...(pass ? {} : {detail})});
  if (obs.curtain) {
    check("curtain names a seat", obs.curtain.next !== null, "curtain text names no seat");
    check("curtain ready button shown", obs.curtain.readyShown, "#sd-ready not visible");
    return out;
  }
  check("status turn shown", obs.status?.turn !== null || obs.status?.result, `status "${obs.status?.text}"`);
  for (const side of SIDES) {
    const s = obs.sides[side];
    check(`${side} side shown`, s, `no ${side} row`);
    if (!s) continue;
    check(`${side} base orbs shown`, s.base, "no orb label");
    check(`${side} counts shown`, s.counts, "no Hand · Deck · Graveyard note");
    check(`${side} three troop slots`, s.slots.length === 3, `${s.slots.length} slots`);
    for (const slot of s.slots.filter((x) => !x.empty)) check(`${side} slot ${slot.slot} orbs shown`, slot.orbs, `no orb label on ${slot.name}`);
    if (s.counts && side === obs.viewer && !obs.status?.result) check(`${side} hand list matches count`, obs.hand.length === s.counts.hand, `${obs.hand.length} cards vs Hand ${s.counts.hand}`);
    if (s.counts && side !== obs.viewer && s.backs !== null) check(`${side} card backs match count`, s.backs === s.counts.hand, `${s.backs} backs vs Hand ${s.counts.hand}`);
    if (s.counts) check(`${side} graveyard list matches count`, obs.graveyards[side]?.length === s.counts.graveyard, `${obs.graveyards[side]?.length} names vs Graveyard ${s.counts.graveyard}`);
  }
  const labels = obs.world?.labels ?? [];
  const deckLabels = labels.filter((l) => l.title === "Deck");
  const graveLabels = labels.filter((l) => l.graveSide);
  for (const l of graveLabels) {
    const counts = obs.sides[l.graveSide]?.counts;
    if (counts) check(`${l.graveSide} 3D graveyard label matches`, l.count === counts.graveyard, `3D ${l.count} vs DOM ${counts.graveyard}`);
  }
  if (obs.world?.present && !deckLabels.length) check("3D deck labels present", false, "no 'Deck <n>' world label");
  if (Array.isArray(obs.world?.pawns)) {
    for (const side of SIDES) for (const slot of obs.sides[side]?.slots ?? []) {
      const pawn = obs.world.pawns.find((p) => p.side === side && p.slot === slot.slot);
      check(`${side} slot ${slot.slot} 3D miniature matches`, slot.empty ? !pawn : pawn?.name === slot.name,
        `DOM ${slot.empty ? "empty" : slot.name}, 3D ${pawn?.name ?? "none"}`);
    }
  }
  return out;
}

const sortedText = (list) => [...list].sort().join(" | ");

// The visible public table against one referee state (proof/referee/SCHEMA.md). Only what the page shows is
// compared: result, turn, active seat, location, each Base, hand/deck/graveyard counts, graveyard cards (as a
// set; their order is not documented), trap counts and the viewing seat's trap cards, every troop slot (card,
// effective attack, orbs and, with cardNames, gear), and the viewing seat's hand in order. Returns [{name, pass, detail}].
export function refereeChecks(obs, state, {names = null, at = "state"} = {}) {
  const out = [];
  const check = (name, pass, detail) => out.push({name: `${at}: ${name}`, pass: Boolean(pass), ...(pass ? {} : {detail})});
  if (!state?.players) { check("referee state", false, "the transcript has no referee state here"); return out; }
  if (obs?.curtain) { check("table shown", false, `the hand-over curtain is up (next ${obs.curtain.next})`); return out; }
  const nameOf = (id) => names?.[decodeInstanceId(id)?.catalogId] ?? `?${id}`;
  const shown = obs?.status?.result ?? null;
  if (state.over) {
    check("result", shown !== null && shown.winner === state.winner,
      `page ${shown ? `shows winner ${shown.winner ?? "none (draw)"}` : `shows "${obs?.status?.text}"`}; referee ${state.winner ?? "draw"} (${state.reason})`);
  } else {
    check("no result yet", shown === null, `page shows "${obs?.status?.text}" while the referee game goes on`);
    check("turn", obs?.status?.turn === state.turn, `page turn ${obs?.status?.turn}, referee turn ${state.turn}`);
    check("active seat", obs?.status?.active === state.active && obs?.viewer === state.active,
      `page status ${obs?.status?.active}, seat shown ${obs?.viewer}; referee ${state.active}`);
  }
  check("location", (obs?.location ?? null) === (state.location?.card ?? null), `page ${obs?.location ?? "none"}, referee ${state.location?.card ?? "none"}`);
  for (const side of SIDES) {
    const p = state.players[side];
    const s = obs?.sides?.[side];
    if (!p || !s) { check(`${side} row`, false, `${!s ? "page" : "referee"} has no ${side} side`); continue; }
    check(`${side} base`, s.base?.now === p.base, `page ${s.base?.now}, referee ${p.base}`);
    check(`${side} hand count`, s.counts?.hand === p.hand.length, `page ${s.counts?.hand}, referee ${p.hand.length}`);
    check(`${side} deck count`, s.counts?.deck === p.deck.length, `page ${s.counts?.deck}, referee ${p.deck.length}`);
    check(`${side} graveyard count`, s.counts?.graveyard === p.discard.length, `page ${s.counts?.graveyard}, referee ${p.discard.length}`);
    if (names) {
      const want = sortedText(p.discard.map(nameOf)), seen = sortedText(obs.graveyards?.[side] ?? []);
      check(`${side} graveyard cards`, seen === want, `page [${seen}], referee [${want}]`);
    }
    const traps = p.traps.filter(Boolean);
    check(`${side} trap count`, s.traps?.count === traps.length, `page ${s.traps?.count}, referee ${traps.length}`);
    if (Array.isArray(s.traps?.names)) {
      const want = sortedText(traps.map((t) => t.card)), seen = sortedText(s.traps.names);
      check(`${side} trap cards`, seen === want, `page [${seen}], referee [${want}]`);
    }
    p.troops.forEach((t, slot) => {
      const v = s.slots.find((x) => x.slot === slot);
      const gear = (list) => (names && list.length ? ` gear ${list.join(", ")}` : "");
      const seen = !v ? "no slot" : v.empty ? "empty" : `${v.name}, ${v.attack} attack, ${v.orbs?.now} orbs${gear(v.gear)}`;
      const want = !t ? "empty" : `${t.card}, ${t.attack} attack, ${t.orbs} orbs${gear(t.gear.map(nameOf))}`;
      check(`${side} slot ${slot}`, seen === want, `page ${seen}; referee ${want}`);
    });
  }
  if (!state.over && obs?.viewer && state.players[obs.viewer]) {
    const seen = (obs.hand ?? []).map((c) => c.id), want = state.players[obs.viewer].hand;
    check(`${obs.viewer} hand`, seen.join() === want.join(), `page [${seen.join(", ")}], referee [${want.join(", ")}]`);
  }
  return out;
}

// The page is waiting for another choice of the same gesture (src/ui/showdown-screen.js shows Cancel exactly while it has a pick).
export const pickOpen = (obs) => Boolean(obs && !obs.curtain && (obs.controls?.cancel?.shown || obs.controls?.cancel?.enabled || obs.hand?.some((c) => c.picked)));

// The visible form of a refusal, from press()'s answer.
export function refusalKind(problem) {
  if (problem === "absent") return "control-absent";
  if (problem === "disabled") return "control-disabled";
  if (problem === "not visible") return "control-hidden";
  return "control-unclickable";
}

// The per-move summary kept in the report: what the page shows, compactly.
export function summarize(obs) {
  if (obs.curtain) return {curtain: obs.curtain.next};
  const side = (s) => s && {base: s.base?.now ?? null, baseMax: s.base?.max ?? null, hand: s.counts?.hand ?? null,
    deck: s.counts?.deck ?? null, graveyard: s.counts?.graveyard ?? null, traps: s.traps?.count ?? null,
    troops: s.slots.map((t) => (t.empty ? null : {name: t.name, orbs: t.orbs?.now ?? null, gear: t.gear, statuses: t.statuses}))};
  return {turn: obs.status?.turn ?? null, active: obs.status?.active ?? null, viewer: obs.viewer,
    winner: obs.status?.result ? obs.status.result.winner : undefined, reason: obs.status?.result?.reason,
    cowboy: side(obs.sides.cowboy), wizard: side(obs.sides.wizard), hand: obs.hand.map((c) => c.id),
    available: obs.controls, location: obs.location, motion: obs.world?.motion ?? null};
}

// Every check is counted; the first FAILURE_CAP failures are kept in the record with their details.
const FAILURE_CAP = 50;
function tally(record, checks) {
  for (const c of checks) {
    record.assertions[c.pass ? "passed" : "failed"]++;
    if (!c.pass && record.failures.length < FAILURE_CAP) record.failures.push(c);
  }
}

// ---------- release gate: browserVerdicts(ctx) for scripts/referee/prove.mjs ----------
//
// Reads only artifacts this script and scripts/stage-pages.mjs already write, under ctx.root:
//   dist/web/index.html, dist/web/build.json        staged build (validated by write-build-identity.mjs)
//   .artifacts/referee-browser/report.json          the --full run report written by main()
//   .artifacts/referee-browser/duels/<seed>.json    one record per duel written by main()
//   the transcripts file named in report.json        re-checked with validateCohort({mode: "full"})
// and the frozen corpus (scripts/referee/corpus.mjs with ctx.freeze.recipe, digest-checked against
// ctx.freeze.inputs.sha256) to prove every browser transcript is a frozen duel.
// It never runs a browser, never writes a file and never makes up a verdict. When any of those
// artifacts is missing, foreign, stale or inconsistent, browserVerdicts throws with every issue it found,
// and prove.mjs records the browser section as missing with that message.
export const BROWSER_REPORT = ".artifacts/referee-browser/report.json";
export const STAGED_DIR = "dist/web";
const TOOL = "scripts/referee/browser.mjs";
const HEAD_PATTERN = /^[0-9a-f]{40}$/;
const ISSUE_CAP = 30;
const MARKERS = ["simulated", "synthetic", "fixture", "fake", "dryRun"];

async function readJson(file) {
  let text;
  try { text = await readFile(file, "utf8"); } catch (error) { return {error: error.code === "ENOENT" ? "missing" : error.message}; }
  try { return {value: JSON.parse(text), text}; } catch (error) { return {error: `not JSON (${error.message})`}; }
}

async function digestFile(file) {
  try { return createHash("sha256").update(await readFile(file)).digest("hex"); } catch { return null; }
}

const marked = (obj) => (obj && typeof obj === "object" ? MARKERS.filter((k) => obj[k] !== undefined && obj[k] !== false) : []);
const isoTime = (s) => (typeof s === "string" && !Number.isNaN(Date.parse(s)) ? Date.parse(s) : null);

// The winner the referee transcript claims, read from the same fields isComplete reads:
// "cowboy", "wizard", null (a draw) or undefined (no result recorded).
export function transcriptWinner(t) {
  for (const r of [t?.result, t?.final?.result, t?.final]) {
    if (r && typeof r === "object" && "winner" in r) return r.winner;
  }
  return undefined;
}

const freezeDuelKey = (d) => canonicalJson({seed: d.seed, first: d.first, decks: d.decks, actions: d.actions});

// Stream the frozen corpus once; returns {bySeed, digest, count} or {error}.
async function frozenCorpus(root, freeze) {
  const file = path.join(root, "scripts/referee/corpus.mjs");
  let corpus;
  try { corpus = await import(pathToFileURL(file).href); } catch (error) { return {error: `cannot load ${path.relative(root, file)}: ${error.message}`}; }
  if (typeof corpus.duels !== "function") return {error: "scripts/referee/corpus.mjs exports no duels(recipe)"};
  const hash = createHash("sha256");
  const bySeed = new Map();
  let count = 0;
  try {
    for await (const duel of corpus.duels(freeze.recipe)) {
      hash.update(`${canonicalJson(duel)}\n`);
      bySeed.set(canonicalJson(duel.seed), freezeDuelKey(duel));
      count++;
    }
  } catch (error) { return {error: `frozen corpus failed while streaming: ${error.message}`}; }
  return {bySeed, digest: hash.digest("hex"), count};
}

// Every issue that keeps the browser artifacts from being a genuine frozen-build 250-duel receipt,
// plus the per-duel verdicts when the receipt itself holds up. Pure reading; nothing is written.
export async function inspectBrowserEvidence(ctx = {}) {
  const issues = [];
  const add = (msg) => issues.push(msg);
  const root = ctx.root ? path.resolve(ctx.root) : null;
  const result = {issues, freezeKey: ctx.freezeKey ?? null, build: {commit: null}, verdicts: null, reportPath: null};
  if (!root) { add("ctx.root is missing"); return result; }
  if (typeof ctx.freezeKey !== "string" || !ctx.freezeKey) add("ctx.freezeKey is missing: browser verdicts are judged only against a referee freeze");
  if (!HEAD_PATTERN.test(ctx.head ?? "")) add(`ctx.head ${JSON.stringify(ctx.head ?? null)} is not a 40-hex commit`);
  const freeze = ctx.freeze;
  if (!freeze || typeof freeze !== "object" || !freeze.recipe || typeof freeze.inputs?.sha256 !== "string") add("ctx.freeze has no recipe and inputs.sha256");

  // Staged build identity.
  const staged = path.join(root, STAGED_DIR);
  const indexFile = path.join(staged, "index.html");
  const indexSha = await digestFile(indexFile);
  if (!indexSha) add(`${STAGED_DIR}/index.html is missing: run node scripts/stage-pages.mjs --commit <HEAD>`);
  const buildRead = await readJson(path.join(staged, "build.json"));
  let manifest = null;
  if (buildRead.error) add(`${STAGED_DIR}/build.json is ${buildRead.error}: stage with node scripts/stage-pages.mjs --commit <HEAD>`);
  else {
    try { manifest = validateManifest(buildRead.value); } catch (error) { add(`${STAGED_DIR}/build.json is invalid: ${error.message}`); }
  }
  if (manifest) {
    result.build.commit = manifest.commit;
    if (ctx.head && manifest.commit !== ctx.head) add(`staged build is commit ${manifest.commit}, not HEAD ${ctx.head}`);
    if (indexSha && manifest.indexHtmlSha256 !== indexSha) add(`${STAGED_DIR}/index.html digest ${indexSha} differs from build.json ${manifest.indexHtmlSha256}`);
  }

  // The run report main() writes.
  const reportFile = path.join(root, BROWSER_REPORT);
  result.reportPath = reportFile;
  const reportRead = await readJson(reportFile);
  if (reportRead.error) {
    add(`browser report ${BROWSER_REPORT} is ${reportRead.error}: no --full browser run has been recorded`);
    return result;
  }
  const report = reportRead.value;
  const bad = (msg) => { add(`${BROWSER_REPORT}: ${msg}`); };
  if (!report || typeof report !== "object" || Array.isArray(report)) { bad("is not an object"); return result; }
  for (const k of marked(report)) bad(`is marked ${k}; only a real browser run counts`);
  if (report.tool !== TOOL) bad(`tool is ${JSON.stringify(report.tool)}, not ${TOOL}`);
  if (report.mode !== "full") bad(`mode is ${JSON.stringify(report.mode)}; only a --full run of ${COHORT_SIZE} duels counts`);
  if (typeof report.page !== "string" || path.resolve(report.page) !== indexFile) bad(`page ${JSON.stringify(report.page)} is not the staged ${STAGED_DIR}/index.html`);
  if (report.pageSha256 !== indexSha) bad(`pageSha256 ${report.pageSha256 ?? "none"} is not the staged index.html ${indexSha ?? "(missing)"}`);
  if (manifest && report.pageSha256 !== manifest.indexHtmlSha256) bad(`pageSha256 is not the build.json index.html digest of commit ${manifest.commit}`);
  const started = isoTime(report.startedAt), finished = isoTime(report.finishedAt);
  if (started === null || finished === null) bad("startedAt or finishedAt is missing or not a time; the run did not finish");
  else if (finished < started) bad("finishedAt is before startedAt");
  if (manifest && started !== null && started < Date.parse(manifest.builtAt)) bad(`run started ${report.startedAt}, before the staged build ${manifest.builtAt}`);
  const seeds = report.cohort?.seeds;
  if (report.cohort?.size !== COHORT_SIZE || !Array.isArray(seeds) || seeds.length !== COHORT_SIZE) bad(`cohort is ${report.cohort?.size ?? "missing"}, not ${COHORT_SIZE} duels`);
  if (Array.isArray(seeds) && new Set(seeds.map((s) => canonicalJson(s))).size !== seeds.length) bad("cohort repeats a seed");
  if (!Array.isArray(report.duels) || report.duels.length !== COHORT_SIZE) bad(`lists ${Array.isArray(report.duels) ? report.duels.length : "no"} duels, not ${COHORT_SIZE}`);

  // The transcripts the run was given, re-validated with the run's own cohort rule.
  let transcripts = null;
  if (typeof report.transcripts !== "string") bad("names no transcripts file");
  else {
    try { transcripts = parseTranscripts(await readFile(report.transcripts, "utf8")); } catch (error) { bad(`transcripts ${report.transcripts} cannot be read: ${error.message}`); }
  }
  let cohort = null;
  if (transcripts) {
    cohort = validateCohort(transcripts, {mode: "full"});
    for (const e of cohort.errors.slice(0, 10)) add(`transcripts: ${e}`);
    if (cohort.errors.length > 10) add(`transcripts: ${cohort.errors.length - 10} more cohort errors`);
    if (Array.isArray(seeds) && canonicalJson(cohort.seeds) !== canonicalJson(seeds)) bad("cohort seeds differ from the transcripts file");
  }

  // Frozen corpus binding: every browser transcript must be a duel of the frozen corpus, unchanged.
  if (cohort && !cohort.errors.length && freeze?.recipe && freeze?.inputs?.sha256) {
    const frozen = await frozenCorpus(root, freeze);
    if (frozen.error) add(frozen.error);
    else if (frozen.digest !== freeze.inputs.sha256) add(`frozen corpus streams ${frozen.digest}, not the frozen inputs ${freeze.inputs.sha256}`);
    else {
      const foreign = cohort.selected.filter((d) => frozen.bySeed.get(canonicalJson(d.seed)) !== freezeDuelKey(d)).map((d) => d.seed);
      if (foreign.length) add(`${foreign.length} transcript(s) are not frozen corpus duels (first seeds ${foreign.slice(0, 5).join(", ")})`);
    }
  }

  // Per-duel records. Structural problems are issues; a duel that ran but did not agree is a verdict.
  const verdicts = [];
  if (cohort && !cohort.errors.length && Array.isArray(report.duels)) {
    const summary = new Map(report.duels.map((d) => [canonicalJson(d?.seed), d]));
    const recordIssues = [];
    for (const [i, duel] of cohort.selected.entries()) {
      const file = path.join(path.dirname(reportFile), "duels", `${duel.seed}.json`);
      const read = await readJson(file);
      if (read.error) { recordIssues.push(`duels/${duel.seed}.json is ${read.error}`); continue; }
      const rec = read.value;
      const problems = [];
      if (marked(rec).length) problems.push(`marked ${marked(rec).join(", ")}`);
      if (rec?.seed !== duel.seed) problems.push(`seed ${rec?.seed}`);
      if (rec?.dealKey !== dealKey(duel)) problems.push("dealKey is not the transcript deal");
      if (!["complete", "incomplete", "mismatch"].includes(rec?.status)) problems.push(`status ${JSON.stringify(rec?.status)}`);
      const s = summary.get(canonicalJson(duel.seed));
      if (!s || s.status !== rec?.status) problems.push("report.duels summary disagrees with the record");
      if (rec?.status === "complete") {
        if (rec.assertions?.failed !== 0 || rec.assertions?.incomplete !== 0) problems.push("complete with failed or incomplete assertions");
        if (!Array.isArray(rec.moves) || rec.moves.length !== duel.actions.length) problems.push(`complete after ${rec.moves?.length ?? 0} of ${duel.actions.length} moves`);
      }
      if (problems.length) { recordIssues.push(`duels/${duel.seed}.json: ${problems.join("; ")}`); continue; }
      const expected = transcriptWinner(transcripts[i]);
      const observed = rec.observedResult && typeof rec.observedResult === "object" ? rec.observedResult.winner : undefined;
      const completed = rec.status === "complete" && observed !== undefined;
      const verdict = rec.status === "mismatch" ? "mismatch" : !completed ? "incomplete"
        : expected === undefined ? "no-referee-result" : observed === expected ? "agree" : "disagree";
      verdicts.push({seed: duel.seed, dealDigest: dealDigest(duel), illustrated: true, completed, verdict,
        observedWinner: observed ?? null, refereeWinner: expected ?? null});
    }
    for (const msg of recordIssues.slice(0, 10)) add(msg);
    if (recordIssues.length > 10) add(`${recordIssues.length - 10} more duel record problems`);
    const t = report.totals ?? {};
    const counted = {complete: 0, incomplete: 0, mismatch: 0};
    for (const d of report.duels) if (d?.status in counted) counted[d.status]++;
    if (t.complete !== counted.complete || t.incomplete !== counted.incomplete || t.mismatch !== counted.mismatch) bad("totals disagree with the duel list");
  }
  if (!issues.length) result.verdicts = verdicts;
  return result;
}

const issueText = (issues) => (issues.length > ISSUE_CAP
  ? [...issues.slice(0, ISSUE_CAP), `(+${issues.length - ISSUE_CAP} more)`] : issues).join("; ");

// prove.mjs interface: {freezeKey, build: {commit}, verdicts: [{seed, dealDigest, illustrated, completed, verdict}]}.
// Throws (fails closed) unless a genuine frozen-build 250-duel browser receipt exists.
export async function browserVerdicts(ctx) {
  const evidence = await inspectBrowserEvidence(ctx);
  if (evidence.issues.length || !evidence.verdicts) {
    throw new Error(`no genuine frozen-build ${COHORT_SIZE}-duel browser receipt: ${issueText(evidence.issues)}`);
  }
  return {freezeKey: ctx.freezeKey, build: {commit: evidence.build.commit}, report: evidence.reportPath, verdicts: evidence.verdicts};
}

// ---------- browser run ----------

async function observerScript() {
  const source = (await readFile(OBSERVER, "utf8")).replace(/^export\s+/gm, "");
  return `(() => {\n${source}\nwindow.__refereeObserver = {observeTable};\n})();`;
}

async function settle(page, ms) {
  const deadline = Date.now() + ms;
  let last = null;
  while (Date.now() < deadline) {
    const obs = await page.evaluate(() => window.__refereeObserver.observeTable());
    const key = stableView(obs);
    if (!obs.world?.motion && key === last) return {obs, settled: true};
    last = obs.world?.motion ? null : key;
    await page.waitForTimeout(120);
  }
  return {obs: await page.evaluate(() => window.__refereeObserver.observeTable()), settled: false};
}

// One click through the page. Never forced: a control the user could not click is a finding.
async function press(page, selector) {
  const target = page.locator(selector).first();
  if (!(await target.count())) return "absent";
  if (!(await target.isVisible())) return "not visible";
  if (!(await target.isEnabled())) return "disabled";
  try { await target.click({timeout: 3000}); } catch (error) { return `not clickable: ${error.message.split("\n")[0]}`; }
  return null;
}

// A wait that ran out: the table was not observed at rest, or a click never landed. runDuel stops on it and
// records it as incomplete under `field`; it is never tallied as a failed (mismatch) or passed assertion.
class Interrupted extends Error {
  constructor(field, reason, at) { super(reason); this.field = field; this.at = at; }
}
const unclickable = (problem) => Boolean(problem) && refusalKind(problem) === "control-unclickable";

async function openTwoPlayers(page) {
  const two = '[data-two="1"]';
  if (!(await page.locator(two).first().isVisible().catch(() => false))) {
    const room = page.locator('[data-camp-destination="camp-open-title"]').first();
    if (await room.count()) await room.click({timeout: 3000}).catch(() => {});
  }
  return press(page, two);
}

export async function runDuel(browser, pageUrl, duel, opts, scratch) {
  const record = {seed: duel.seed, first: duel.first, dealKey: dealKey(duel), status: "complete",
    assertions: {passed: 0, failed: 0, incomplete: 0}, failures: [], incomplete: [], unobservable: [], moves: []};
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: opts.reducedMotion ? "reduce" : "no-preference",
    recordVideo: {dir: scratch, size: {width: 960, height: 600}}});
  await context.addInitScript({content: await observerScript()});
  const page = await context.newPage();
  const incomplete = (field, reason, at = null) => { record.incomplete.push({field, reason, at}); record.assertions.incomplete++; };
  // Every observation that is judged comes from here: a table still moving after --settle-ms is never judged.
  const observe = async (at, after) => {
    const {obs: seen, settled} = await settle(page, opts.settleMs);
    if (settled) return seen;
    throw new Interrupted("interrupted.settle", `the table was not at rest ${after} within ${opts.settleMs} ms (canvas motion "${seen.world?.motion ?? "none"}"), so it was not judged`, at);
  };
  try {
    await page.goto(`${pageUrl}?seed=${duel.seed}`);
    const camp = await press(page, "#menu-play");
    if (camp) { incomplete("entry.camp", `#menu-play ${camp}`); return finish(); }
    const two = await openTwoPlayers(page);
    if (two) { incomplete("entry.twoPlayers", `Camp > Two players [data-two="1"] ${two}; Wizard moves need a seat the page lets a person drive`); return finish(); }
    let obs = await observe(null, "at entry");
    record.unobservable = obs.incomplete;
    if (obs.curtain) {
      const ready = await press(page, "#sd-ready");
      if (ready) { incomplete("entry.ready", `#sd-ready ${ready}`); return finish(); }
      obs = await observe(null, "after the opening hand-over");
    }
    const opening = checkOpening(duel, obs);
    record.opening = summarize(obs);
    tally(record, selfChecks(obs));
    if (opening.length) {
      for (const p of opening) incomplete("deal", p);
      incomplete("deal.control", MISSING_DEAL_CONTROL);
      return finish();
    }
    const ref = duel.referee;
    const names = duel.cardNames;
    record.referee = ref ? {compared: true, steps: ref.steps.length, rejected: ref.steps.filter((s) => !s.accepted).length,
      probes: {refused: 0, notSent: 0}} : {compared: false};
    if (ref) tally(record, refereeChecks(obs, ref.initial, {names, at: "opening"}));
    let stopped = false;
    const stop = () => { stopped = true; };
    const cancelPick = async (at) => {
      if (!pickOpen(obs)) return;
      const problem = await press(page, "#sd-cancel");
      // A Cancel that never landed leaves the pick open for the next move's first click.
      if (unclickable(problem)) throw new Interrupted("interrupted.click", `Cancel (#sd-cancel) ${problem}; the open pick was not closed`, at);
      if (!problem) obs = await observe(at, "after Cancel");
    };
    for (const [index, action] of duel.actions.entries()) {
      const expect = ref ? ref.steps[index] : null;
      const move = {index, action, clicks: [], rejected: null, presentations: [], ...(expect ? {referee: {accepted: expect.accepted, error: expect.error}} : {})};
      record.moves.push(move);
      const gap = duel.gaps?.[index] ?? null;
      if (gap) {
        // Never clicked: the first click would make a different move. The step stays unjudged.
        move.rejected = `not sent: ${gap}`;
        incomplete("action.noGesture", gap, index);
        if (ref) record.referee.probes.notSent++;
        if (!expect || expect.accepted) { stop(); break; }
        continue;
      }
      const plan = planControls(action);
      if (plan.unsupported) { incomplete("action", plan.unsupported, index); move.rejected = plan.unsupported; stop(); break; }
      const before = obs;
      const beforeHand = before.hand.map((c) => c.id);
      let early = null;
      for (const [n, step] of plan.steps.entries()) {
        const problem = await press(page, step.click);
        move.clicks.push({...step, problem});
        if (problem) {
          move.rejected = `${step.what} (${step.click}) ${problem}`;
          move.refusal = refusalKind(problem);
          // A click that never landed is no refusal the page showed, whatever the referee decided.
          if (unclickable(problem)) throw new Interrupted("interrupted.click", `${move.rejected}; the page showed no refusal, so the move was not judged`, index);
          break;
        }
        if (n === plan.steps.length - 1) break;
        // Every click but the last must leave the page waiting for the next one of the same gesture.
        const mid = await page.evaluate(() => window.__refereeObserver.observeTable());
        if (!pickOpen(mid)) { early = `the page closed the gesture after ${step.what}, before ${plan.steps[n + 1].what}`; break; }
      }
      obs = await observe(index, `after move ${index}`);
      if (early) {
        await cancelPick(index);
        if (obs.curtain || stableView(obs) !== stableView(before)) {
          // The page made some move from part of the clicks: the table no longer follows the transcript.
          move.rejected = early;
          incomplete("action.partialGesture", `${early}, and the visible table changed`, index);
          move.presentations.push({seat: obs.viewer ?? obs.curtain?.next ?? null, after: "partial gesture", view: summarize(obs)});
          stop();
          break;
        }
        move.rejected = early;
        move.refusal = "pick-closed";
      }
      // A pick left open after the last click means the page did not take the action.
      if (!move.rejected && !obs.curtain && plan.steps.length && pickOpen(obs)) {
        move.rejected = "the page stayed in its pick step after the last control";
        move.refusal = "pick-left-open";
      }
      if (move.rejected) {
        await cancelPick(index);
        const unchanged = stableView(obs) === stableView(before);
        tally(record, [{name: `move ${index} rejection leaves the visible table unchanged`, pass: unchanged, detail: "visible table changed after a rejected move"}]);
        move.presentations.push({seat: obs.viewer, after: "rejection", view: summarize(obs)});
        if (!expect) {
          // Without the frozen referee the run cannot tell an intended illegal move from a missing control.
          incomplete("action.rejected", move.rejected, index);
          continue;
        }
        if (expect.accepted) {
          tally(record, [{name: `move ${index} taken as the referee accepted it`, pass: false, detail: `page refused it: ${move.rejected}`}]);
          stop();
          break;
        }
        tally(record, [{name: `move ${index} refused as the referee rejected it (${expect.error})`, pass: true}]);
        record.referee.probes.refused++;
        tally(record, refereeChecks(obs, expect.state, {names, at: `move ${index}`}));
        continue;
      }
      if (expect && !expect.accepted) {
        tally(record, [{name: `move ${index} refused as the referee rejected it (${expect.error})`, pass: false, detail: "the page took the move"}]);
        move.presentations.push({seat: obs.viewer ?? obs.curtain?.next ?? null, after: "move", view: summarize(obs)});
        stop();
        break;
      }
      if (action.cardId && beforeHand.includes(action.cardId) && obs.hand?.some((c) => c.id === action.cardId))
        tally(record, [{name: `move ${index} played instance ${action.cardId}`, pass: false, detail: "the named copy is still in hand; the page plays copies by printed name"}]);
      tally(record, selfChecks(obs));
      move.presentations.push({seat: obs.viewer ?? obs.curtain?.next ?? null, after: "move", view: summarize(obs)});
      if (obs.curtain) {
        const ready = await press(page, "#sd-ready");
        if (ready) { incomplete("handover", `#sd-ready ${ready}`, index); stop(); break; }
        obs = await observe(index, `after the hand-over following move ${index}`);
        tally(record, selfChecks(obs));
        move.presentations.push({seat: obs.viewer, after: "handover", view: summarize(obs)});
      }
      if (expect) tally(record, refereeChecks(obs, expect.state, {names, at: `move ${index}`}));
      if (obs.status?.result && index < duel.actions.length - 1) {
        tally(record, [{name: `result shown only after the last move`, pass: false, detail: `page shows a result after move ${index} of ${duel.actions.length}`}]);
        stop();
        break;
      }
    }
    const winner = obs.status?.result;
    if (!stopped) tally(record, [{name: "page shows a result after the last move", pass: Boolean(winner), detail: `status "${obs.status?.text}"`}]);
    record.observedResult = winner ?? null;
    return finish();
  } catch (error) {
    if (error instanceof Interrupted) incomplete(error.field, error.message, error.at);
    else incomplete("run", error.stack ?? String(error));
    return finish();
  } finally {
    await context.close();
    record.video = await page.video()?.path().catch(() => null) ?? null;
  }
  function finish() {
    record.status = record.assertions.failed ? "mismatch" : record.assertions.incomplete ? "incomplete" : "complete";
    return record;
  }
}

async function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exit(2); }
  let transcripts;
  try { transcripts = parseTranscripts(await readFile(opts.transcripts, "utf8")); } catch (error) { console.error(`cannot read transcripts: ${error.message}`); process.exit(2); }
  const cohort = validateCohort(transcripts, opts);
  if (cohort.errors.length) { console.error(cohort.errors.slice(0, 40).join("\n")); process.exit(2); }
  const pageFile = path.resolve(opts.page);
  const pageBytes = await readFile(pageFile).catch(() => null);
  if (!pageBytes) { console.error(`no staged page at ${pageFile}; run node scripts/stage-pages.mjs first`); process.exit(2); }
  let chromium;
  try { ({chromium} = await import("playwright")); } catch {
    try { ({chromium} = await import("playwright-core")); } catch {
      console.error("Playwright is not installed in this checkout (neither playwright nor playwright-core resolves)."); process.exit(3);
    }
  }
  const out = path.resolve(opts.out);
  await mkdir(path.join(out, "duels"), {recursive: true});
  const scratch = await mkdtemp(path.join(tmpdir(), "referee-browser-video-"));
  const browser = await chromium.launch({executablePath: opts.chrome, headless: true}).catch((error) => {
    console.error(`cannot launch Chrome at ${opts.chrome}: ${error.message}`); process.exit(3);
  });
  const judged = cohort.selected.filter((d) => d.referee).length;
  const comparison = judged === cohort.selected.length
    ? "referee.result in each transcript (proof/referee/referee.py --stream): per-step acceptance and the visible public table"
    : judged ? `mixed: ${judged} of ${cohort.selected.length} transcripts carry a referee result` : "none: the transcripts carry no referee result";
  const report = {tool: "scripts/referee/browser.mjs", mode: opts.mode, page: pageFile,
    pageSha256: createHash("sha256").update(pageBytes).digest("hex"), transcripts: path.resolve(opts.transcripts),
    entry: "?seed=<seed>, #menu-play, Camp > [data-two=\"1\"] Two players, one screen, #sd-ready",
    startedAt: new Date().toISOString(), comparison, reducedMotion: opts.reducedMotion, jobs: opts.jobs,
    cohort: {size: cohort.selected.length, seeds: cohort.seeds}, totals: {complete: 0, incomplete: 0, mismatch: 0, passed: 0, failed: 0, incompleteFields: 0},
    firstMismatch: null, duels: []};
  await writeFile(path.join(out, "seeds.json"), JSON.stringify(cohort.seeds) + "\n");
  const pageUrl = pathToFileURL(pageFile).href;
  async function recordDuel(duel, record) {
    // record.referee is set once the opening is judged; a duel stopped at entry has none.
    if (duel.referee && record.referee) {
      const last = duel.referee.steps.at(-1)?.state ?? duel.referee.initial;
      Object.assign(record.referee, {winner: last.over ? last.winner : undefined, reason: last.reason});
    }
    const keep = record.status === "mismatch" && !report.firstMismatch;
    if (keep && record.video) {
      const kept = path.join(out, `first-mismatch-seed-${record.seed}.webm`);
      await copyFile(record.video, kept);
      report.firstMismatch = {seed: record.seed, video: kept, failure: record.failures[0]};
    } else if (keep) report.firstMismatch = {seed: record.seed, video: null, failure: record.failures[0]};
    if (record.video) await rm(record.video, {force: true});
    delete record.video;
    await writeFile(path.join(out, "duels", `${record.seed}.json`), JSON.stringify(record, null, 1) + "\n");
    report.totals[record.status]++;
    report.totals.passed += record.assertions.passed;
    report.totals.failed += record.assertions.failed;
    report.totals.incompleteFields += record.assertions.incomplete;
    report.duels.push({seed: record.seed, status: record.status, assertions: record.assertions, moves: record.moves.length,
      incomplete: [...new Set(record.incomplete.map((x) => x.field))],
      ...(record.referee?.compared ? {observedWinner: record.observedResult ? record.observedResult.winner : undefined,
        refereeWinner: record.referee.winner, probesRefused: record.referee.probes.refused, refereeRejected: record.referee.rejected,
        firstFailure: record.failures[0]?.name} : {})});
    console.log(`seed ${record.seed}: ${record.status} (passed ${record.assertions.passed}, failed ${record.assertions.failed}, incomplete ${record.assertions.incomplete}` +
      `${record.referee?.compared ? `; probes refused ${record.referee.probes.refused}/${record.referee.rejected}; winner page ${record.observedResult?.winner ?? "none"}, referee ${record.referee.winner ?? "none"}` : ""})`);
  }
  try {
    for (let offset = 0; offset < cohort.selected.length; offset += opts.jobs) {
      const batch = cohort.selected.slice(offset, offset + opts.jobs);
      const results = await Promise.allSettled(batch.map((duel) => runDuel(browser, pageUrl, duel, opts, scratch)));
      // Preserve transcript order for the report and the first-mismatch video.
      for (const [index, result] of results.entries()) {
        if (result.status === "rejected") throw result.reason;
        await recordDuel(batch[index], result.value);
      }
    }
  } finally {
    await browser.close();
    await rm(scratch, {recursive: true, force: true});
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 1) + "\n");
  console.log(`report: ${path.join(out, "report.json")}`);
  process.exit(report.totals.mismatch || report.totals.incomplete ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
