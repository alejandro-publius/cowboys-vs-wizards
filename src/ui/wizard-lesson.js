// Wizard lesson: the player path after a finished solo Cowboy duel, or from an episode file (for example the bait that
// proof/wizard-lesson/find-bait.mjs found). The player marks one Wizard move as bait, sees what the original Wizard did
// that turn, exports the episode for the native trainer, imports the receipt it writes, and may opt in to a rematch of
// the identical deal against the revised Wizard. Without opting in, the rematch Wizard is the original one.
//
// One schema with the engine and the trainer (src/game/showdown/wizard-lesson-policy.js, scripts/wizard-lesson/):
//   Episode {version: 1, seed, setup: {first, cpu: {side: "wizard", level: 2}, baseOrbs?, decks?, opening?},
//            actions: [{side, action}], markedIndex, tag: "bait"}
//   Receipt {schema: "wizard-lesson-receipt/2", status, episodeKey, runs, lesson, ...} from train.mjs. The page re-runs
//            verifyLessonBundle(receipt.lesson, episode) on the engine; a receipt is matched to an episode by episodeKey.
// The page never trains or invents a lesson, and no receipt text is executed: a revised policy is validated JSON that
// only the policy module's wizardTurn reads, and every Wizard action it picks is checked against legalActions there.
// Receipt and episode text is untrusted: it is escaped when shown.
import {DECKS} from "../game/showdown/cards.js";
import {viewFor} from "../game/showdown/contract.js";
import {presentEvent} from "../game/showdown/presenter.js";
import {isDealSeed} from "../game/showdown/seed.js";
import {applyAction, createShowdown, legalActions} from "../game/showdown/rules.js";
import {
  CPU_SIDE, PLAYER_SIDE, baitReport, createEpisodeState, episodeKey, loadRematchPolicy, replayEpisode, validateEpisode, validateSetup,
  verifyLessonBundle, wizardTurn,
} from "../game/showdown/wizard-lesson-policy.js";

export const EPISODE_VERSION = 1;
export const RECEIPT_SCHEMA = "wizard-lesson-receipt/2";
export const STORE_KEY = "cvw-wizard-lesson-v2";
export const MAX_IMPORT_BYTES = 256 * 1024;
export const TRAIN_COMMAND = "node scripts/wizard-lesson/train.mjs --episode EPISODE.json --out receipt.json";
const STEP_CAP = 5000;
const SETUP_OPTIONS = ["decks", "baseOrbs", "first", "opening"];

export class LessonError extends Error {}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clip = (value, n = 240) => { const text = String(value ?? ""); return text.length > n ? `${text.slice(0, n)}…` : text; };
const engine = (fn, why) => { try { return fn(); } catch (error) { throw new LessonError(`${why}: ${clip(error?.message, 160)}`); } };

// The setup of a duel as the trainer and the policy take it, frozen when the duel is dealt, or null when this duel cannot
// be trained: the lesson policy runs only on the level-2 Wizard, and bosses that land mid-duel (arrivals) are not supported.
export function lessonSetup(duel, seed) {
  if (duel?.level !== 2 || !isDealSeed(seed)) return null;
  const options = duel.options ?? {};
  if (Object.keys(options).some((key) => !SETUP_OPTIONS.includes(key))) return null;
  try {
    const first = createShowdown(seed, options).first;
    const picked = Object.fromEntries(SETUP_OPTIONS.filter((key) => key !== "first" && key in options).map((key) => [key, structuredClone(options[key])]));
    return validateSetup({first, cpu: {side: CPU_SIDE, level: 2}, ...picked});
  } catch {
    return null;
  }
}

// The text the duel showed for each action, replayed from the deal through the canonical presenter.
const lineFor = (action, events) => (action.type === "end" ? "Ended the turn."
  : events.filter((event) => event.type !== "turn").map((event) => presentEvent(event)).join(" ") || "Made a move.");
function linesOf(seed, setup, actions) {
  let state = createEpisodeState(seed, setup);
  return actions.map(({action}) => {
    const applied = applyAction(state, action);
    state = applied.state;
    return lineFor(action, applied.events);
  });
}

// After a finished duel: replays it from its setup, the Cowboy's actions in order and the original Wizard, and checks it
// ends the same way. record: {seed, setup, cowboyActions, expected: {result, turn}}. Returns an unmarked draft.
export function captureEpisode({seed, setup, cowboyActions, expected}) {
  if (!setup || !isDealSeed(seed)) throw new LessonError("This duel cannot be reviewed.");
  let state = engine(() => createEpisodeState(seed, setup), "This duel cannot be reviewed");
  const actions = [];
  let next = 0;
  try {
    for (let guard = 0; !state.result; guard += 1) {
      if (guard > STEP_CAP) throw new LessonError("The duel did not finish when replayed.");
      if (state.active === CPU_SIDE) {
        state = wizardTurn(state, {onAction: (_before, _applied, action) => actions.push({side: CPU_SIDE, action})}).state;
        continue;
      }
      if (next >= cowboyActions.length) break;
      const action = legalActions(state).find((each) => same(each, cowboyActions[next]));
      next += 1;
      if (!action) throw new LessonError(`Cowboy move ${next} is not legal in this deal.`);
      actions.push({side: PLAYER_SIDE, action});
      state = applyAction(state, action).state;
    }
  } catch (error) {
    throw error instanceof LessonError ? error : new LessonError("This duel could not be replayed for review.");
  }
  if (next !== cowboyActions.length || !state.result || !same(state.result, expected?.result) || state.turn !== expected?.turn) {
    throw new LessonError("This duel could not be reproduced from its deal, so it cannot be reviewed.");
  }
  return {draft: {seed, setup, actions}, lines: linesOf(seed, setup, actions), selected: null};
}

// An episode file: a bare episode or a find-bait.mjs output ({search, episode, ...}). It must replay in this build with
// the original Wizard. The file's marked move is preselected; the player still marks it.
export function draftFromFile(raw) {
  const input = raw && typeof raw === "object" && raw.episode && typeof raw.episode === "object" && "search" in raw ? raw.episode : raw;
  const episode = engine(() => validateEpisode(input), "That is not a Wizard lesson episode");
  engine(() => replayEpisode(episode), "The episode does not replay in this build");
  const draft = {seed: episode.seed, setup: episode.setup, actions: episode.actions};
  return {draft, lines: linesOf(draft.seed, draft.setup, draft.actions), selected: episode.markedIndex};
}

// Indices a player may mark: the Wizard's own moves, not its End turn.
export const markable = (draft) => draft.actions.flatMap((entry, i) => (entry.side === CPU_SIDE && entry.action.type !== "end" ? [i] : []));

// A marked episode, checked on the engine: it replays with the original Wizard. report says whether it is a Hellfire bait.
export function markEpisode(draft, index) {
  if (!markable(draft).includes(index)) throw new LessonError("Only a Wizard move can be marked.");
  const episode = engine(() => validateEpisode({version: EPISODE_VERSION, seed: draft.seed, setup: draft.setup, actions: draft.actions, markedIndex: index, tag: "bait"}),
    "This episode cannot be marked");
  const {turnStart} = engine(() => replayEpisode(episode), "The episode does not replay in this build");
  return {episode, key: episodeKey(episode), report: baitReport(episode), turnStart};
}

// What a Wizard plays for its whole turn from the start of the marked turn: the original (policy null) or a lesson policy.
export function turnAdvice(turnStart, policy = null) {
  const out = [];
  wizardTurn(turnStart, {policy, onAction: (_before, applied, action) => out.push(lineFor(action, applied.events))});
  return out;
}

const RUN_ROLES = ["coach", "rival", "reviser"];
// What a receipt means for this episode. state: "mismatch" (not for this episode; the lesson stays as it was), "rejected"
// or "accepted". source: "imported" (a train.mjs receipt) or "simulated" (a test fixture that says no Kiro run made it).
export function checkReceipt(receipt, {episode, key}) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt) || receipt.schema !== RECEIPT_SCHEMA) {
    return {state: "mismatch", reasons: ["That file is not a Wizard lesson receipt from scripts/wizard-lesson/train.mjs."]};
  }
  if (receipt.episodeKey !== key) return {state: "mismatch", reasons: ["That receipt names a different episode: its episode key does not match this one."]};
  const source = receipt.fixture === "simulated" ? "simulated" : "imported";
  const runs = (Array.isArray(receipt.runs) ? receipt.runs : []).filter((run) => run && typeof run === "object").slice(0, 8)
    .map((run) => ({role: clip(run.role, 20), runId: clip(run.runId, 80), sessionId: run.sessionId == null ? null : clip(run.sessionId, 80),
      model: clip(run.model, 60), cliVersion: run.cliVersion == null ? null : clip(run.cliVersion, 40), exit: run.exit, error: run.error == null ? null : clip(run.error, 60)}));
  const base = {source, runs};
  if (receipt.status !== "validated") {
    const why = Array.isArray(receipt.reasons) && receipt.reasons.length ? clip(receipt.reasons.at(-1)) : `The trainer finished as ${clip(receipt.status, 20)}.`;
    return {...base, state: "rejected", reasons: [why]};
  }
  const missing = RUN_ROLES.filter((role) => !runs.some((run) => run.role === role && run.exit === 0 && run.error === null));
  if (missing.length) return {...base, state: "rejected", reasons: [`The receipt records no successful ${missing.join(", ")} run.`]};
  let verdict;
  try { verdict = verifyLessonBundle(receipt.lesson, episode); } catch (error) {
    return {...base, state: "rejected", reasons: [`The lesson failed the engine check: ${clip(error?.message, 160)}`]};
  }
  if (!verdict.ok) return {...base, state: "rejected", reasons: ["The lesson failed the engine check here: its counterexample or revised policy does not hold up."]};
  return {...base, state: "accepted", reasons: [], policy: verdict.revised, proposal: receipt.lesson.proposal.policy};
}

// The words shown for a lesson's state.
export function lessonLabel(check) {
  if (check.state === "pending") return "Pending: no lesson for this exact episode yet.";
  const status = check.state === "accepted" ? "Accepted" : "Rejected";
  if (check.source === "simulated") return `${status} simulated fixture: checked here on the engine, but no Kiro run produced it.`;
  return `${status} lesson from an imported train.mjs receipt for this exact episode${check.state === "accepted" ? ", re-checked here on the engine" : ""}. The receipt records native Kiro CLI runs; this page cannot confirm they happened.`;
}

// A rematch duel for the screen: the episode's own deal, with nothing to settle (kind "lesson").
export function lessonDuel(episode, revised) {
  const decks = episode.setup.decks ?? {};
  return {id: "lesson", kind: "lesson", level: 2, name: `Lesson rematch, ${revised ? "lesson" : "original"} Wizard`,
    options: {decks: {cowboy: decks.cowboy ?? DECKS.cowboy, wizard: decks.wizard ?? DECKS.wizard}},
    lesson: `Same deal, decks and start as the episode you marked. The Wizard plays its ${revised ? "lesson" : "original"} strategy. Nothing here is saved or paid.`};
}

// The rematch session, with the same surface as createShowdownSession for a solo Cowboy seat. policy null: the original
// Wizard. If the Wizard strategy fails, the duel stops and failure() says why; there is no fallback to another strategy.
export function createLessonSession({episode, policy = null}) {
  let state = createEpisodeState(episode.seed, episode.setup);
  let failure = null;
  const wizardTurns = (observe) => {
    const events = [];
    try {
      for (let guard = 0; !failure && !state.result && state.active === CPU_SIDE; guard += 1) {
        if (guard > 200) throw new LessonError("The Wizard kept the turn.");
        const played = wizardTurn(state, {policy, onAction: observe && ((before, applied) => observe(before, applied))});
        state = played.state;
        events.push(...played.events);
      }
    } catch (error) {
      failure = error instanceof LessonError ? error.message : `The Wizard strategy failed: ${clip(error?.message, 160)}`;
    }
    return events;
  };
  const opening = wizardTurns();
  const legal = () => (failure || state.result || state.active !== PLAYER_SIDE ? [] : legalActions(state));
  return {
    seat: PLAYER_SIDE, players: 1, opening, failure: () => failure,
    viewer: () => PLAYER_SIDE,
    view: () => viewFor(state, PLAYER_SIDE),
    legal,
    act(action, onPresentation) {
      const chosen = legal().find((each) => same(each, action));
      if (!chosen) throw new Error("not this seat's turn or not a legal action");
      const observe = onPresentation && ((before, applied) => onPresentation({before: viewFor(before, PLAYER_SIDE), after: viewFor(applied.state, PLAYER_SIDE), events: applied.events}));
      const applied = applyAction(state, chosen);
      observe?.(state, applied);
      state = applied.state;
      return [...applied.events, ...wizardTurns(observe)];
    },
  };
}

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
const reasonOf = (error) => (error instanceof LessonError ? error.message : "Something went wrong reading this lesson.");
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], {type: "application/json"}));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
async function readJson(file) {
  if (!file) return {error: "No file was chosen."};
  if (file.size > MAX_IMPORT_BYTES) return {error: "That file is too large for a Wizard lesson."};
  try { return {value: JSON.parse(await file.text())}; } catch { return {error: "That file is not JSON."}; }
}

// The lesson page. onRematch({episode, policy}) starts the rematch (policy null: original Wizard). onClose() leaves the
// page. storage keeps one marked episode and its receipt under STORE_KEY; the opt-in is never stored.
export function mountWizardLesson(root, {storage = null, onRematch, onClose, save: saveFile = download}) {
  let draft, lines, selected, marked, check, receipt, optIn, message, generation = 0;
  const reset = () => { [draft, lines, selected, marked, check, receipt, optIn, message] = [null, [], null, null, {state: "pending"}, null, false, ""]; generation += 1; };
  reset();
  const persist = () => {
    try { storage?.setItem(STORE_KEY, JSON.stringify({version: 2, episode: marked.episode, receipt})); } catch { /* storage is blocked or full */ }
  };
  const forget = () => { try { storage?.removeItem(STORE_KEY); } catch { /* storage is blocked */ } };

  const list = (items) => (items.length ? `<ol class="wl-advice">${items.map((text) => `<li>${esc(text)}</li>`).join("")}</ol>` : `<p class="sd-note">No move.</p>`);
  const status = () => `<p id="wl-message" role="status">${esc(message)}</p>`;
  const fileInput = `<label class="wl-import">Open an episode file <input type="file" id="wl-episode-file" accept="application/json,.json"></label>`;

  function choosing() {
    // A turn changes whenever the side to act changes; moves are grouped by Wizard turn.
    const turns = [];
    let wizardTurns = 0;
    draft.actions.forEach((entry, i) => {
      const starts = i === 0 || entry.side !== draft.actions[i - 1].side;
      if (starts && entry.side === CPU_SIDE) { wizardTurns += 1; turns.push({n: wizardTurns, moves: []}); }
      if (markable(draft).includes(i)) turns.at(-1).moves.push(i);
    });
    const shown = turns.filter((turn) => turn.moves.length);
    return `<p class="sd-note">Pick the Wizard move that baited you, then mark it. Each move is listed as the duel showed it. Only the Wizard's strategy can change: cards, stats and rules stay as they are.</p>
      ${shown.length ? `<ol class="wl-turns">${shown.map(({n, moves}) => `<li><h2>Wizard turn ${n}</h2><div class="sd-row">${moves.map((i) =>
        `<button type="button" class="wl-move" data-pick="${i}" aria-pressed="${selected === i}">${esc(lines[i])}</button>`).join("")}</div></li>`).join("")}</ol>`
        : `<p class="sd-note">The Wizard made no move to review here.</p>`}
      ${status()}
      <div class="sd-row"><button type="button" id="wl-bait"${selected === null ? " disabled" : ""}>That was bait</button><button type="button" id="wl-cancel">Cancel</button></div>`;
  }
  function markedView() {
    const {episode, key, report, turnStart} = marked;
    const accepted = check.state === "accepted";
    const runs = (check.runs ?? []).map((run) => `<li>${esc(run.role)}: run ${esc(run.runId)}${run.sessionId ? `, session ${esc(run.sessionId)}` : ""}${run.model ? `, ${esc(run.model)}` : ""}${run.cliVersion ? `, kiro-cli ${esc(run.cliVersion)}` : ""}</li>`).join("");
    return `<p>You marked this Wizard move as bait: <q>${esc(lines[episode.markedIndex])}</q></p>
      <p class="sd-note" id="wl-bait-report" data-bait="${report.ok}">${report.ok ? `A Hellfire bait: one Cowboy troop, not lethal on the board (Wizard Base ${report.base}).`
        : `Not a Hellfire bait the trainer accepts: ${esc(report.reasons.join("; "))}.`}</p>
      <section aria-labelledby="wl-original-title"><h2 id="wl-original-title">Original Wizard</h2>
        <p class="sd-note">What the current Wizard plays for that whole turn.</p><div id="wl-original">${list(turnAdvice(turnStart))}</div></section>
      <section class="wl-status" aria-labelledby="wl-status-title" data-lesson-state="${check.state}" data-lesson-source="${esc(check.source ?? "")}">
        <h2 id="wl-status-title">Lesson</h2><p class="wl-badge" id="wl-label">${esc(lessonLabel(check))}</p>
        ${check.reasons?.length ? `<ul class="wl-reasons">${check.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
        ${runs ? `<p class="sd-note">Runs as the receipt records them:</p><ul class="wl-runs">${runs}</ul>` : ""}</section>
      ${accepted ? `<section aria-labelledby="wl-revised-title"><h2 id="wl-revised-title">Lesson Wizard</h2>
        <p class="sd-note">What the revised Wizard would play from the same position.</p><div id="wl-revised">${list(turnAdvice(turnStart, check.policy))}</div></section>` : ""}
      <section aria-labelledby="wl-train-title"><h2 id="wl-train-title">Train this episode</h2>
        <p class="sd-note">Export the episode, then run <code>${esc(TRAIN_COMMAND)}</code> in this game's repository with the native Kiro CLI signed in. Import the receipt it writes; it must name episode <code class="wl-hash">${esc(key)}</code>. This page does not train lessons.</p>
        <div class="sd-row"><button type="button" id="wl-export"${report.ok ? "" : " disabled"}>Export episode</button>
        <label class="wl-import">Import receipt <input type="file" id="wl-receipt" accept="application/json,.json"></label>
        ${receipt ? `<button type="button" id="wl-forget">Forget this lesson</button>` : ""}</div></section>
      <section aria-labelledby="wl-rematch-title"><h2 id="wl-rematch-title">Rematch</h2>
        <label class="wl-optin"><input type="checkbox" id="wl-optin"${accepted ? "" : " disabled"}${accepted && optIn ? " checked" : ""}> Let the Wizard use this lesson in the rematch</label>
        <p class="sd-note">Off by default. Without it, the rematch Wizard is the original one.</p></section>
      ${status()}
      <div class="sd-row"><button type="button" id="wl-rematch">Rematch this deal</button>
        <button type="button" id="wl-unmark">Choose another move</button><button type="button" id="wl-close">Close</button></div>`;
  }
  function render(focus) {
    const body = marked ? markedView() : draft ? choosing() : `${status()}<div class="sd-row">${fileInput}<button type="button" id="wl-close">Close</button></div>`;
    root.innerHTML = `<header><h1 id="wl-title">Wizard lesson</h1></header>${body}`;
    root.setAttribute("aria-labelledby", "wl-title");
    if (root.hidden) return;
    const target = (focus && root.querySelector(focus)) || root.querySelector("#wl-bait:not(:disabled), .wl-move, #wl-rematch, #wl-close");
    target?.focus();
  }

  function settle(result, from) {
    check = result;
    receipt = from;
    if (check.state !== "accepted") optIn = false;
  }
  function mark() {
    if (selected === null) return;
    try {
      marked = markEpisode(draft, selected);
      settle({state: "pending"}, null);
      persist();
      message = marked.report.ok ? "Marked. Export it to train a lesson, or import a receipt for it." : "Marked, but this move is not a Hellfire bait the trainer accepts.";
      render("#wl-export:not(:disabled), #wl-rematch");
    } catch (error) {
      [marked, message] = [null, reasonOf(error)];
      render();
    }
  }
  async function openEpisodeFile(file) {
    const token = generation;
    const read = await readJson(file);
    if (token !== generation) return;
    if (read.error) { message = read.error; return render(); }
    try {
      const opened = draftFromFile(read.value);
      reset();
      [draft, lines, selected, message] = [opened.draft, opened.lines, opened.selected, "Episode opened. Pick the Wizard move that baited you."];
    } catch (error) { message = reasonOf(error); }
    render(selected === null ? undefined : `[data-pick="${selected}"]`);
  }
  async function importReceipt(file) {
    if (!marked) return;
    const [token, current] = [generation, marked];
    const read = await readJson(file);
    if (token !== generation || marked !== current) return;
    if (read.error) { message = read.error; return render("#wl-export"); }
    const result = checkReceipt(read.value, marked);
    if (result.state === "mismatch") message = `${result.reasons.join(" ")} The lesson is unchanged.`;
    else {
      settle(result, read.value);
      persist();
      message = `Receipt imported. ${lessonLabel(check)}`;
    }
    render(check.state === "accepted" ? "#wl-optin" : "#wl-export");
  }

  // Escape steps back: leaves the marked view, clears a selection, or closes the page.
  function back() {
    if (marked) { [marked, message] = [null, ""]; settle({state: "pending"}, null); generation += 1; return render(`[data-pick="${selected}"]`); }
    if (draft && selected !== null) { selected = null; return render(); }
    onClose?.();
  }
  root.addEventListener("click", (event) => {
    const b = event.target.closest("button");
    if (!b || b.disabled) return;
    if (b.dataset.pick !== undefined && draft && !marked) { selected = Number(b.dataset.pick); render(`[data-pick="${selected}"]`); }
    else if (b.id === "wl-bait") mark();
    else if (b.id === "wl-cancel" || b.id === "wl-close") onClose?.();
    else if (b.id === "wl-unmark") back();
    else if (b.id === "wl-export" && marked?.report.ok) saveFile(`wizard-lesson-episode-${marked.key}.json`, `${JSON.stringify(marked.episode, null, 2)}\n`);
    else if (b.id === "wl-forget" && marked) { settle({state: "pending"}, null); persist(); message = "Lesson forgotten. The rematch Wizard is the original one."; render("#wl-rematch"); }
    else if (b.id === "wl-rematch" && marked) {
      const policy = check.state === "accepted" ? loadRematchPolicy(check.policy, {optIn}) : null;
      onRematch?.({episode: marked.episode, policy});
    }
  });
  root.addEventListener("change", (event) => {
    const input = event.target;
    if (input.id === "wl-optin") { optIn = check.state === "accepted" && input.checked; return; }
    if (input.id !== "wl-receipt" && input.id !== "wl-episode-file") return;
    const file = input.files?.[0];
    input.value = "";
    (input.id === "wl-receipt" ? importReceipt : openEpisodeFile)(file);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || root.hidden || event.defaultPrevented) return;
    event.preventDefault();
    back();
  });

  return {
    // record: what the screen kept of a finished duel ({seed, setup, cowboyActions, expected}).
    openFromDuel(record) {
      reset();
      try { ({draft, lines, selected} = captureEpisode(record)); } catch (error) { message = reasonOf(error); }
      render();
    },
    // The episode saved in this browser. A stale or damaged save is cleared and the reason shown.
    openSaved() {
      reset();
      let saved;
      try { saved = JSON.parse(storage?.getItem(STORE_KEY) ?? "null"); } catch { saved = undefined; }
      if (saved === null) { message = "No Wizard lesson is saved in this browser. Open an episode file to start one."; return render(); }
      try {
        if (!saved || typeof saved !== "object" || saved.version !== 2) throw new LessonError("The saved lesson has an unknown format.");
        const opened = draftFromFile(saved.episode);
        [draft, lines, selected] = [opened.draft, opened.lines, opened.selected];
        marked = markEpisode(draft, selected);
        const result = saved.receipt ? checkReceipt(saved.receipt, marked) : null;
        if (result && result.state !== "mismatch") settle(result, saved.receipt);
        message = result?.state === "mismatch" ? "The saved receipt did not match this episode and was ignored." : "";
      } catch (error) {
        forget();
        [draft, marked, message] = [null, null, `The saved lesson could not be used and was cleared. ${reasonOf(error)}`];
      }
      render();
    },
    // Back from a rematch: the same lesson as it was left, opt-in included.
    reopen: () => render(marked ? "#wl-rematch" : undefined),
  };
}
