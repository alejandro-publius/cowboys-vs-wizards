// "Replay the repair" in the Night Shift saloon. The visitor picks the Current or Proposed card,
// predicts which faction wins, then steps through the recorded deal, the changed move and the real finish.
// Data is FIELD_TRIAL (src/ui/field-trial-data.js, owned by the coordinator): a fresh check and the
// witness replay it vouches for. A complete, published failing fresh check is shown on its own, with its
// rule reasons and block reasons and no winner replay. A replay is shown only when both exist, the fresh
// check passed, both name the same base, inputs and change (and the same record hash when the witness
// seals one), the change matches the card in this build, and the witness adds up.
// No timer, audio or network: every step is a button press or an arrow key.
import {TYPES, typeOf} from "../game/showdown/cards.js";
import {FIELD_TRIAL} from "./field-trial-data.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);

export const FACTION = Object.freeze({cowboy: "Cowboys", wizard: "Wizards"});
export const LINES = Object.freeze(["baseline", "candidate"]);
export const PREDICTIONS = Object.freeze(["cowboy", "wizard"]);
export const STEPS = 3; // the deal, the changed move, the finish
const LAST = STEPS - 1;
const STATS = ["attack", "health", "stars"];
const WINNERS = ["cowboy", "wizard", "draw"];
const LABEL_MAX = 160;
const ID_MAX = 80;
const BASE_MAX = 80;
const EVENTS_MAX = 400;
const REASONS_MAX = 20;
const SHA256 = /^[0-9a-f]{64}$/;

const isObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const isInt = (n, min = 0) => Number.isInteger(n) && n >= min;
const isText = (s, max) => typeof s === "string" && s.trim().length > 0 && s.length <= max;
const typeFor = (id, types) => (typeof id === "string" && types[typeOf(id)] ? typeOf(id) : null);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const shortBase = (base) => (/^[0-9a-f]{40}$/.test(base) ? base.slice(0, 7) : base);

// Pure: one JSON text per value with object keys sorted, so equal records compare equal.
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value ?? null);
}

function cleanMove(e) {
  if (!isObject(e) || !isInt(e.turn, 1) || !isText(e.label, LABEL_MAX)) return null;
  for (const key of ["card", "target"]) if (e[key] !== undefined && !isText(e[key], ID_MAX)) return null;
  const move = {turn: e.turn, label: e.label.trim()};
  if (e.card !== undefined) move.card = e.card;
  if (e.target !== undefined) move.target = e.target;
  return move;
}

// Pure: one recorded line, or null. Its changed move is `divergence` when recorded, otherwise the event
// right after the matched ones. Either way it happens on the witness turn.
function cleanLine(run, turn, matched) {
  if (!isObject(run) || !WINNERS.includes(run.winner) || !isInt(run.endTurn, turn)) return null;
  if (!Array.isArray(run.events) || run.events.length > EVENTS_MAX) return null;
  const events = run.events.map(cleanMove);
  if (events.some((e) => !e)) return null;
  if (events.some((e, i) => i > 0 && e.turn < events[i - 1].turn)) return null;
  if (events.length && events.at(-1).turn > run.endTurn) return null;
  let divergence = null;
  if (run.divergence !== undefined) {
    divergence = cleanMove(run.divergence);
    if (!divergence) return null;
  }
  const move = divergence ?? events[matched] ?? null;
  if (!move || move.turn !== turn) return null;
  return {winner: run.winner, endTurn: run.endTurn, events, divergence, move};
}

function cleanChange(change, types) {
  if (!isObject(change)) return null;
  const type = typeFor(change.card, types);
  if (!type || !STATS.includes(change.field) || !isInt(change.from) || !isInt(change.to) || change.from === change.to) return null;
  if (!Number.isInteger(types[type][change.field])) return null;
  return {card: type, field: change.field, from: change.from, to: change.to};
}

const refuse = (reason, text) => ({ok: false, reason, text});
export const EMPTY_TEXT = Object.freeze({
  missing: "No field trial is recorded for this build yet.",
  failed: "The fresh check did not pass, so the repair is not replayed.",
  invalid: "The witness replay is incomplete or does not add up, so the repair is not replayed.",
});
export const DECLINED_TEXT = "The fresh check did not pass. No winner replay: a failed check has no recorded finish to show.";

const blockText = (b) => {
  if (isText(b, LABEL_MAX)) return b;
  return isObject(b) && isText(b.reason, LABEL_MAX) ? b.reason : null;
};
const textList = (list) => Array.isArray(list) && list.length <= REASONS_MAX;

// Pure: a complete, published failing fresh check, or null. It needs a base, inputs, a change record,
// at least one failing rule reason and readable block reasons. The card and stat are kept only when the
// change names a real card stat that this build still has at its starting value.
function declinedFresh(fresh, types) {
  if (!isObject(fresh) || fresh.pass !== false) return null;
  if (!isText(fresh.base, BASE_MAX) || fresh.inputs === undefined || fresh.inputs === null || !isObject(fresh.change)) return null;
  if (!textList(fresh.reasons) || !fresh.reasons.length || !fresh.reasons.every((r) => isText(r, LABEL_MAX))) return null;
  if (!textList(fresh.blocks)) return null;
  const blocks = fresh.blocks.map(blockText);
  if (blocks.some((b) => b === null)) return null;
  const change = cleanChange(fresh.change, types);
  const trusted = change && types[change.card][change.field] === change.from ? {...change, name: types[change.card].name} : null;
  return {base: fresh.base, change: trusted, reasons: [...fresh.reasons], blocks};
}

// Pure: the record hash the witness seals, undefined when it seals none, or null when the seal is unreadable.
function witnessSeal(witness) {
  if (witness.fresh === undefined) return undefined;
  const seal = isObject(witness.fresh) ? witness.fresh.recordSha256 : witness.fresh;
  return typeof seal === "string" && SHA256.test(seal) ? seal : null;
}

// Pure: {ok: true, trial} for a verified, matching fresh check and witness; otherwise
// {ok: false, reason, text} with reason missing, failed, mismatch, stale or invalid. A complete failing
// fresh check is read first, with or without a witness, and adds `declined` with what it published.
export function checkFieldTrial(input = FIELD_TRIAL, types = TYPES) {
  const fresh = input?.fresh, witness = input?.witness;
  const declined = declinedFresh(fresh, types);
  if (declined) return {ok: false, reason: "failed", text: DECLINED_TEXT, declined};
  if (!isObject(fresh) || !isObject(witness)) return refuse("missing", EMPTY_TEXT.missing);
  if (fresh.pass !== true) return refuse("failed", EMPTY_TEXT.failed);
  const seal = witnessSeal(witness);
  if (seal === null) return refuse("invalid", EMPTY_TEXT.invalid);
  if (seal !== undefined && !(typeof fresh.recordSha256 === "string" && SHA256.test(fresh.recordSha256))) {
    return refuse("invalid", EMPTY_TEXT.invalid);
  }
  if (witness.schema !== 1 || !Array.isArray(fresh.blocks)) return refuse("invalid", EMPTY_TEXT.invalid);
  if (!isText(fresh.base, BASE_MAX) || !isText(witness.base, BASE_MAX)) return refuse("invalid", EMPTY_TEXT.invalid);
  if (witness.inputs === undefined || witness.inputs === null || fresh.inputs === undefined || fresh.inputs === null) {
    return refuse("invalid", EMPTY_TEXT.invalid);
  }
  const mismatch = (what) => refuse("mismatch", `The fresh check and the witness replay name a different ${what}, so the repair is not replayed.`);
  if (seal !== undefined && fresh.recordSha256 !== seal) return mismatch("fresh check record");
  if (fresh.base !== witness.base) return mismatch("base");
  if (canonical(fresh.inputs) !== canonical(witness.inputs)) return mismatch("set of inputs");
  const change = cleanChange(witness.change, types);
  if (!change || !cleanChange(fresh.change, types)) return refuse("invalid", EMPTY_TEXT.invalid);
  if (canonical(fresh.change) !== canonical(witness.change)) return mismatch("card change");
  const live = types[change.card][change.field];
  const name = types[change.card].name;
  if (live !== change.from) {
    return refuse("stale", `The witness starts from ${name} ${change.field} ${change.from}, but this build has ${change.field} ${live}, so the repair is not replayed.`);
  }
  const {seed, first, turn, matchedEvents} = witness;
  if (!isInt(seed) || !(first in FACTION) || !isInt(turn, 1) || !isInt(matchedEvents)) return refuse("invalid", EMPTY_TEXT.invalid);
  const baseline = cleanLine(witness.baseline, turn, matchedEvents);
  const candidate = cleanLine(witness.candidate, turn, matchedEvents);
  if (!baseline || !candidate) return refuse("invalid", EMPTY_TEXT.invalid);
  // The two lines must split at the changed move, and agree before it when both logs hold the matched events.
  if (canonical(baseline.move) === canonical(candidate.move)) return refuse("invalid", EMPTY_TEXT.invalid);
  if (baseline.events.length >= matchedEvents && candidate.events.length >= matchedEvents
    && canonical(baseline.events.slice(0, matchedEvents)) !== canonical(candidate.events.slice(0, matchedEvents))) {
    return refuse("invalid", EMPTY_TEXT.invalid);
  }
  return {ok: true, trial: {base: witness.base, change, name, seed, first, turn, matchedEvents,
    blocks: fresh.blocks.length, record: seal ?? null, baseline, candidate}};
}

export const lineWord = (line) => (line === "baseline" ? "Current" : "Proposed");
export const lineName = (line, trial) => `${lineWord(line)} ${trial.name}`;
export const lineValue = (line, trial) => (line === "baseline" ? trial.change.from : trial.change.to);
export const statText = (line, trial) => `${trial.change.field} ${lineValue(line, trial)}`;

// --- The interaction model: choose a line, predict, then step. The prediction locks once the finish shows. ---
export function initialRepair() {
  return {line: null, prediction: null, step: 0, revealed: false};
}

export function repairReducer(state, action) {
  const s = state ?? initialRepair();
  switch (action?.type) {
    case "line":
      if (!LINES.includes(action.line) || action.line === s.line) return s;
      return {line: action.line, prediction: null, step: 0, revealed: false};
    case "predict":
      if (!s.line || s.revealed || s.step !== 0 || !PREDICTIONS.includes(action.faction)) return s;
      return {...s, prediction: action.faction};
    case "next": {
      if (!s.line || !s.prediction || s.step >= LAST) return s;
      const step = s.step + 1;
      return {...s, step, revealed: s.revealed || step === LAST};
    }
    case "back":
      return s.line && s.step > 0 ? {...s, step: s.step - 1} : s;
    case "restart":
      return s.line && s.step > 0 ? {...s, step: 0} : s;
    default:
      return s;
  }
}

// Pure: the arrow and Home keys step the replay; every other key keeps its usual meaning.
const KEYS = {ArrowRight: "next", ArrowLeft: "back", Home: "restart"};
export function keyAction(event) {
  if (!event || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  return KEYS[event.key] ? {type: KEYS[event.key]} : null;
}

export function finishText(run) {
  return run.winner === "draw" ? `A draw on turn ${run.endTurn}: neither faction won`
    : `The ${FACTION[run.winner]} win on turn ${run.endTurn}`;
}

export function verdictText(run, prediction) {
  const right = run.winner === prediction;
  return `You called the ${FACTION[prediction]}. ${right ? "That call was right." : "That call missed."}`;
}

const portraitSpan = (id) => {
  const type = typeFor(id, TYPES);
  return type ? `<span class="saloon-repair-portrait" data-repair-portrait="${esc(type)}" aria-hidden="true"></span>` : "";
};

function moveHtml(line, trial, chosen) {
  const {move} = trial[line];
  return `<li class="saloon-repair-move${line === chosen ? " is-chosen" : ""}">${portraitSpan(move.card)}${portraitSpan(move.target)}`
    + `<span><strong>${esc(lineWord(line))}</strong> · ${esc(statText(line, trial))}<br>Turn ${move.turn}: ${esc(move.label)}</span></li>`;
}

function logHtml(run) {
  if (!run.events.length) return "";
  const items = run.events.map((e) => `<li><span class="saloon-repair-turn">Turn ${e.turn}</span> ${esc(e.label)}</li>`).join("");
  return `<details class="saloon-repair-log"><summary>Recorded moves (${run.events.length})</summary><ol>${items}</ol></details>`;
}

// Pure: everything the replay shows and which controls work, for one state.
export function repairView(trial, state = initialRepair()) {
  const s = state;
  const steps = `Step ${s.step + 1} of ${STEPS}`;
  const view = {line: s.line, prediction: s.prediction, step: s.step,
    canPredict: Boolean(s.line) && !s.revealed && s.step === 0,
    canNext: Boolean(s.line && s.prediction) && s.step < LAST,
    canBack: Boolean(s.line) && s.step > 0,
    canRestart: Boolean(s.line) && s.step > 0};
  if (!s.line) {
    return {...view, stage: "",
      caption: `Choose ${lineName("baseline", trial)} or ${lineName("candidate", trial)}, then predict which faction wins.`};
  }
  if (!s.prediction) {
    return {...view, stage: "",
      caption: `Which faction wins with ${lineName(s.line, trial)} at ${statText(s.line, trial)}? Make your call to start the replay.`};
  }
  const run = trial[s.line];
  const called = `<p class="saloon-repair-call">Your call: the ${esc(FACTION[s.prediction])} win.</p>`;
  if (s.step === 0) {
    return {...view, stage: called,
      caption: `${steps} · Seed ${trial.seed}. The ${FACTION[trial.first]} open. Both versions play the same first ${plural(trial.matchedEvents, "event")}.`};
  }
  const moves = `<ol class="saloon-repair-moves" aria-label="Where the versions split on turn ${trial.turn}">${LINES.map((line) => moveHtml(line, trial, s.line)).join("")}</ol>`;
  if (s.step === 1) {
    return {...view, stage: `${called}${moves}`,
      caption: `${steps} · Turn ${trial.turn}, ${lineName(s.line, trial)}: ${run.move.label}.`};
  }
  const finish = `<p class="saloon-repair-finish" data-winner="${esc(run.winner)}"><strong>${esc(finishText(run))}.</strong> ${esc(verdictText(run, s.prediction))}</p>`;
  return {...view, stage: `${moves}${finish}${logHtml(run)}`,
    caption: `${steps} · ${finishText(run)}. ${verdictText(run, s.prediction)}`};
}

const fact = (term, value) => `<div><dt>${term}</dt><dd>${value}</dd></div>`;
const changeText = (change) => `${esc(change.field)} ${change.from} → ${change.to}`;
const reasonList = (label, items) => (items.length
  ? `<p><strong>${label}</strong></p><ul class="saloon-repair-reasons">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
  : "");

// Pure: a failing fresh check as published. Card and stat only when trustworthy; no replay controls.
function declinedHtml(d) {
  const card = d.change ? `<div class="saloon-repair-deal">
      ${portraitSpan(d.change.card)}
      <dl class="saloon-repair-facts">${fact("Card", esc(d.change.name))}${fact("Change", changeText(d.change))}</dl>
    </div>` : "";
  return `<div class="saloon-repair-body saloon-repair-declined">
    <p class="sd-note saloon-repair-empty">${esc(DECLINED_TEXT)}</p>
    ${card}
    <p class="sd-note">Fresh check on base <code>${esc(shortBase(d.base))}</code>.</p>
    ${reasonList("Failing rules", d.reasons)}
    ${reasonList("Block reasons", d.blocks)}
  </div>`;
}

// Pure: the section's inner HTML. A missing trial is hidden by the caller; any other refusal says why.
export function repairHtml(check) {
  const summary = `<summary>Replay the repair</summary>`;
  if (!check.ok && check.declined) return `${summary}${declinedHtml(check.declined)}`;
  if (!check.ok) return `${summary}<p class="sd-note saloon-repair-empty">${esc(check.text)}</p>`;
  const t = check.trial;
  const button = (attr, value, label, extra = "") => `<button type="button" ${attr}="${value}" aria-pressed="false"${extra}>${esc(label)}</button>`;
  const record = t.record ? `, record <code>${esc(t.record.slice(0, 7))}</code>` : "";
  return `${summary}
  <div class="saloon-repair-body">
    <div class="saloon-repair-deal">
      ${portraitSpan(t.change.card)}
      <dl class="saloon-repair-facts">
        ${fact("Card", esc(t.name))}
        ${fact("Change", changeText(t.change))}
        ${fact("Seed", String(t.seed))}
        ${fact("Opening faction", FACTION[t.first])}
        ${fact("Turn", String(t.turn))}
        ${fact("Divergence", `First ${plural(t.matchedEvents, "event")} match, then the versions split`)}
      </dl>
    </div>
    <p class="sd-note">Fresh check passed on base <code>${esc(shortBase(t.base))}</code>${record}. Recorded games, replayed as they happened.</p>
    <div class="saloon-buttons saloon-repair-lines" role="group" aria-label="Choose the version to replay">
      ${LINES.map((line) => button("data-repair-line", line, `${lineName(line, t)} · ${statText(line, t)}`, ' aria-controls="saloon-repair-stage"')).join("")}
    </div>
    <div class="saloon-buttons saloon-repair-predict" role="group" aria-label="Predict which faction wins" hidden>
      ${PREDICTIONS.map((faction) => button("data-repair-predict", faction, `${FACTION[faction]} win`)).join("")}
    </div>
    <div id="saloon-repair-stage" class="saloon-repair-stage"></div>
    <p class="saloon-repair-now" role="status" aria-live="polite"></p>
    <div class="saloon-buttons saloon-repair-steps" role="group" aria-label="Replay steps" hidden>
      <button type="button" data-repair-step="back">Back a step</button>
      <button type="button" data-repair-step="next">Next step</button>
      <button type="button" data-repair-step="restart">Replay from the start</button>
    </div>
    <p class="sd-note saloon-repair-keys">Keys: Right arrow for the next step, Left arrow to go back, Home to start over.</p>
  </div>`;
}

function fillPortraits(root, portrait) {
  for (const slot of root.querySelectorAll("[data-repair-portrait]")) {
    const id = slot.dataset.repairPortrait;
    const image = (TYPES[id] && portrait(id)) || Object.assign(document.createElement("span"),
      {className: "saloon-art-missing", textContent: (TYPES[id]?.name ?? "?").slice(0, 1).toUpperCase()});
    image.setAttribute("aria-hidden", "true");
    slot.replaceChildren(image);
  }
}

// DOM: fills `box` (a <details>) once. Buttons are never replaced and focus never moves, so a keyboard
// visitor can press Next step again and again; disabled controls use aria-disabled and stay focusable.
export function mountRepairReplay(box, {trial = FIELD_TRIAL, portrait = () => null, types = TYPES} = {}) {
  const check = checkFieldTrial(trial, types);
  box.hidden = check.reason === "missing";
  box.innerHTML = repairHtml(check);
  if (check.declined) fillPortraits(box, portrait);
  if (!check.ok) return {check, state: () => null};
  const t = check.trial;
  const $ = (selector) => box.querySelector(selector);
  const lineButtons = [...box.querySelectorAll("[data-repair-line]")];
  const predictButtons = [...box.querySelectorAll("[data-repair-predict]")];
  const [predictRow, stage, now, stepRow, back, next, restart] = [".saloon-repair-predict", ".saloon-repair-stage",
    ".saloon-repair-now", ".saloon-repair-steps", '[data-repair-step="back"]', '[data-repair-step="next"]',
    '[data-repair-step="restart"]'].map($);
  let state = initialRepair();
  fillPortraits($(".saloon-repair-deal"), portrait);

  function render() {
    const view = repairView(t, state);
    stage.innerHTML = view.stage;
    fillPortraits(stage, portrait);
    now.textContent = view.caption;
    for (const b of lineButtons) b.setAttribute("aria-pressed", String(b.dataset.repairLine === view.line));
    predictRow.hidden = !view.line;
    for (const b of predictButtons) {
      b.setAttribute("aria-pressed", String(b.dataset.repairPredict === view.prediction));
      b.setAttribute("aria-disabled", String(!view.canPredict));
    }
    stepRow.hidden = !view.prediction;
    back.setAttribute("aria-disabled", String(!view.canBack));
    next.setAttribute("aria-disabled", String(!view.canNext));
    restart.setAttribute("aria-disabled", String(!view.canRestart));
  }
  function dispatch(action) {
    const after = repairReducer(state, action);
    if (after === state) return false;
    state = after;
    render();
    return true;
  }
  box.addEventListener("click", (event) => {
    const b = event.target.closest?.("button");
    if (!b || !box.contains(b) || b.getAttribute("aria-disabled") === "true") return;
    const {repairLine, repairPredict, repairStep} = b.dataset;
    if (repairLine) dispatch({type: "line", line: repairLine});
    else if (repairPredict) dispatch({type: "predict", faction: repairPredict});
    else if (repairStep) dispatch({type: repairStep});
  });
  box.addEventListener("keydown", (event) => {
    if (!event.target.closest?.(".saloon-repair-body")) return;
    const action = keyAction(event);
    if (action && dispatch(action)) event.preventDefault();
  });
  render();
  return {check, state: () => state};
}
