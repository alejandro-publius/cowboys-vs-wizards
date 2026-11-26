// The Sheriff's Ledger shows the first different attack and the recorded finish for each version of Billy.
import {cardOf, typeOf} from "../game/showdown/cards.js";
import {BILLY_REPLAY} from "./billy-replay.data.js";
// The independent seat audit (scripts/billy-seat-audit.mjs). Its reviewed result is written by the native run.
import SEAT_AUDIT from "../../docs/evidence/billy-seat-audit/result.json" with {type: "json"};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);
const pct = (n, d) => `${((100 * n) / d).toFixed(2)}%`;
const count = (n) => n.toLocaleString("en-US");
const short = (sha) => String(sha).slice(0, 7);
const orbWord = (n) => `${n} orb${n === 1 ? "" : "s"}`;
const FACTION = {cowboy: "Cowboys", wizard: "Wizards"};
export const LINES = ["baseline", "candidate"];
// The proposal's gate result: this record holds the data's receipt seal (tests/match/billy-replay.test.js checks it).
export const GATE_RECORD = "docs/evidence/kiro-contest-run.md";
export const REPRODUCE = "node scripts/verify-billy-replay.mjs --full";

export function lineName(line, replay = BILLY_REPLAY) {
  const card = cardOf(replay.attackerId);
  const baselineLabel = card.attack === replay.baseline.attack ? "Current" : "Recorded";
  return `${line === "baseline" ? baselineLabel : "Proposed"} ${card.name}`;
}

// Pure: the four beats of one line. `orbs` is what the target holds once the beat has happened.
export function replaySteps(line, replay = BILLY_REPLAY) {
  const run = replay[line];
  const billy = cardOf(replay.attackerId), wall = cardOf(replay.targetId);
  const before = replay.targetOrbsBefore, after = run.targetOrbsAfter;
  return [
    {orbs: before,
      text: `Turn ${replay.turn}, the ${FACTION[billy.side]} face a ${wall.name} with ${orbWord(before)}.`},
    {orbs: before, hit: run.attack,
      text: `${billy.name} attacks ${wall.name} for ${run.attack}.`},
    {orbs: after,
      text: `The ${wall.name} loses ${orbWord(before - after)} and ${after ? `survives with ${orbWord(after)}` : "is defeated"}.`},
    {orbs: after,
      text: `The ${FACTION[run.winner]} win on turn ${run.endTurn}.`},
  ];
}

const orbs = (now, max) => `<span class="sd-orbs" role="img" aria-label="${orbWord(now)}">${"●".repeat(now)}<span class="sd-lost">${"○".repeat(Math.max(0, max - now))}</span></span>`;

function stageHtml(replay, line, at, steps = []) {
  const billy = cardOf(replay.attackerId), wall = cardOf(replay.targetId);
  const beat = steps[at];
  const left = beat ? beat.orbs : replay.targetOrbsBefore;
  const attack = line ? `${replay[line].attack} attack` : `${replay.baseline.attack} attack now, ${replay.candidate.attack} proposed`;
  const note = !beat || at === 0 ? "" : beat.hit ? `Takes ${beat.hit}` : left ? "Still standing" : "Defeated";
  return `<div class="sd-billy-board">
    <div class="sd-billy-troop ${billy.side}${beat?.hit ? " sd-billy-acting" : ""}"><strong>${esc(billy.name)}</strong><span class="sd-type">Cowboy</span>${esc(attack)}</div>
    <span class="sd-billy-vs" aria-hidden="true">vs</span>
    <div class="sd-billy-troop ${wall.side}${beat?.hit ? " sd-billy-hit" : ""}${beat && !left ? " sd-billy-down" : ""}"><strong>${esc(wall.name)}</strong><span class="sd-type">Wizard</span>${orbs(left, replay.targetOrbsBefore)}${note ? `<span class="sd-note">${note}</span>` : ""}</div>
  </div>`;
}

// Pure: what the replay shows for a line (none before one is picked) at a step, clamped to the line's beats.
export function replayView(line, step = 0, replay = BILLY_REPLAY) {
  if (!LINES.includes(line)) {
    return {line: null, step: 0, first: true, last: false, stage: stageHtml(replay, null, 0),
      caption: `Pick ${lineName("baseline", replay)} or ${lineName("candidate", replay)} to replay the attack.`};
  }
  const steps = replaySteps(line, replay);
  const at = Math.min(Math.max(step, 0), steps.length - 1);
  const last = at === steps.length - 1;
  return {line, step: at, first: at === 0, last, stage: stageHtml(replay, line, at, steps),
    caption: `Step ${at + 1} of ${steps.length} · ${steps[at].text}`};
}

// The proposal and the benchmark are historical. A future balance release can change the live card.
export function appliedLine(replay = BILLY_REPLAY) {
  const card = cardOf(replay.attackerId);
  return `${card.name} has ${card.attack} attack in this build. Night Shift marked the one-point proposal ready for design review.`;
}

export function billyReplayHtml(replay = BILLY_REPLAY, seat = SEAT_AUDIT) {
  const billy = cardOf(replay.attackerId), wall = cardOf(replay.targetId);
  const view = replayView(null, 0, replay);
  const k = replay.cohort;
  const score = (line, wins) => `<div><dt>${esc(lineName(line, replay))}</dt><dd>${pct(wins, k.gamesPerArm)}</dd></div>`;
  return `<h3 id="ledger-billy-title">${esc(billy.name)} vs. ${esc(wall.name)}</h3>
  <p class="sd-note sd-billy-deal">Turn ${replay.turn} · Seed ${replay.seed} · ${FACTION[replay.first]} first</p>
  <div class="sd-row sd-billy-actions" role="group" aria-label="Choose the version of Billy">${LINES.map(line => `<button type="button" data-billy-line="${line}" aria-pressed="false" aria-controls="ledger-billy-stage">${esc(lineName(line, replay))} · ${replay[line].attack} attack</button>`).join("")}</div>
  <div class="sd-billy-portraits" aria-hidden="true"><span data-ledger-portrait="${esc(typeOf(replay.attackerId))}"></span><span data-ledger-portrait="${esc(typeOf(replay.targetId))}"></span></div>
  <div id="ledger-billy-stage" class="sd-billy-stage">${view.stage}</div>
  <p id="ledger-billy-now" class="sd-billy-now" role="status">${esc(view.caption)}</p>
  <div class="sd-row" id="ledger-billy-steps" role="group" aria-label="Replay steps" hidden>
    <button type="button" data-billy-step="back">Back a step</button>
    <button type="button" data-billy-step="next">Next step</button>
    <button type="button" data-billy-step="replay">Replay from the start</button>
  </div>
  <h4 id="ledger-billy-wins">Cowboy wins in the ${count(2 * k.gamesPerArm)}-game replay sample</h4>
  <dl class="sd-billy-scores" aria-labelledby="ledger-billy-wins">${score("baseline", k.baselineCowboyWins)}${score("candidate", k.candidateCowboyWins)}</dl>
  <p class="sd-note">${count(k.gamesPerArm)} games per version, fixed decks and two level-2 bots. ${esc(appliedLine(replay))}</p>
  <details class="sd-billy-evidence"><summary>How to verify this replay</summary>
    <p>The first ${replay.matchedEvents} events match. The next event is Billy’s attack. The bot plays each version through to its recorded ending.</p>
    <p>The sample covers ${count(k.deals)} deals, seeds ${k.firstSeed}–${k.firstSeed + k.deals - 1}. Each faction starts once per deal. Cowboys won ${count(k.baselineCowboyWins)} and ${count(k.candidateCowboyWins)} games respectively. ${count(k.switchedCowboyToWizard)} winners switched to Wizards and ${count(k.switchedWizardToCowboy)} to Cowboys. First-player wins went from ${pct(k.baselineFirstWins, k.gamesPerArm)} to ${pct(k.candidateFirstWins, k.gamesPerArm)}.</p>
    <p>Run <code>${esc(REPRODUCE)}</code>. Source <code>${short(replay.source.commit)}</code> · outcome hash <code>${short(k.csvSha256)}</code> · proposal record <code>${esc(GATE_RECORD)}</code>.</p>
  </details>
  ${seatAuditHtml(seat, replay)}`;
}

// --- Who wins when they go first? A separate, larger sample than the replay's cohort above. ---
export const SEAT_REPRODUCE = "node scripts/billy-seat-audit.mjs --verify";
const SEAT_TITLE = "Who wins when they go first?";
const ARMS = ["baseline", "candidate"];
const OUTCOMES = ["cowboy", "wizard", "draw"];
const SEATS = ["cowboy", "wizard"];
const isCount = (n) => Number.isInteger(n) && n >= 0;
const total = (cells) => OUTCOMES.reduce((sum, o) => sum + cells[o], 0);
const share = (wins, games) => ({wins, games, share: games > 0 ? wins / games : null});
export const shareText = (s) => (s === null ? "—" : `${(100 * s).toFixed(2)}%`);
export function pointsText(from, to) {
  if (from === null || to === null) return "—";
  const p = Math.round(10000 * (to - from)) / 100;
  return p === 0 ? "0.00 pts" : `${p > 0 ? "+" : "−"}${Math.abs(p).toFixed(2)} pts`;
}

// Pure: the result is shown only if every cell is a whole count and the cells add up to each other.
// A recorded totalDuels must match the games the cells describe (two versions per opening seat per deal).
export function seatAuditOk(seat) {
  if (seat?.schema !== 1 || !isCount(seat.deals) || !isCount(seat.firstSeed)) return false;
  if (seat.totalDuels !== undefined && seat.totalDuels !== 2 * SEATS.length * seat.deals) return false;
  return SEATS.every((first) => {
    const f = seat.byFirst?.[first];
    if (!f || f.gamesPerArm !== seat.deals) return false;
    const cells = [...ARMS.map((a) => f[a]), ...OUTCOMES.map((o) => f.transitions?.[o])];
    if (!cells.every((c) => c && OUTCOMES.every((o) => isCount(c[o])))) return false;
    return ARMS.every((a) => total(f[a]) === f.gamesPerArm)
      && OUTCOMES.every((o) => total(f.transitions[o]) === f.baseline[o]
        && OUTCOMES.reduce((sum, b) => sum + f.transitions[b][o], 0) === f.candidate[o]);
  });
}

const SEAT_ROWS = [["All starts", SEATS], ["Cowboys open", ["cowboy"]], ["Wizards open", ["wizard"]]];

// Pure: Cowboy win shares per opening faction, from the raw byFirst counts (draws count as games, not wins).
export function seatRows(seat) {
  return SEAT_ROWS.map(([label, firsts]) => {
    const [baseline, candidate] = ARMS.map((a) => share(
      firsts.reduce((sum, f) => sum + seat.byFirst[f][a].cowboy, 0),
      firsts.reduce((sum, f) => sum + total(seat.byFirst[f][a]), 0)));
    return {label, baseline, candidate, change: pointsText(baseline.share, candidate.share)};
  });
}

// Pure: how often the faction that went first won, per version of Billy.
export function firstPlayerShares(seat) {
  const [baseline, candidate] = ARMS.map((a) => share(
    SEATS.reduce((sum, f) => sum + seat.byFirst[f][a][f], 0),
    SEATS.reduce((sum, f) => sum + total(seat.byFirst[f][a]), 0)));
  return {baseline, candidate, change: pointsText(baseline.share, candidate.share)};
}

// Pure: the one takeaway. The opener's share before and after, and which seat that favours.
export function seatObservation(first, replay = BILLY_REPLAY) {
  const now = first.candidate.share, before = first.baseline.share;
  if (now === null) return "No games are recorded yet.";
  const favoured = now > 0.5 ? "first" : now < 0.5 ? "second" : null;
  const wasFavoured = before === null ? null : before > 0.5 ? "first" : before < 0.5 ? "second" : "neither";
  const edge = favoured ? `going ${favoured} ${wasFavoured === favoured ? "still gives" : "now gives"} an edge` : "neither seat has an edge";
  const shares = before === null
    ? `${shareText(now)} of games with Billy at attack ${replay.candidate.attack}`
    : `${shareText(before)} of games with Billy at attack ${replay.baseline.attack} and ${shareText(now)} at attack ${replay.candidate.attack}`;
  return `The side that goes first wins ${shares}, so ${edge}.`;
}

// Pure: the quiet verify line. Hashes appear only when the result records them as text.
function seatVerifyHtml(seat) {
  const hashes = [["Source", seat.sourceCommit], ["outcome hash", seat.csvSha256], ["protocol hash", seat.protocolSha256]]
    .filter(([, sha]) => typeof sha === "string" && sha.length > 0)
    .map(([label, sha]) => ` · ${label} <code>${esc(short(sha))}</code>`).join("");
  return `<p class="sd-note sd-billy-seat-verify">Verify: <code>${esc(SEAT_REPRODUCE)}</code>${hashes}</p>
    ${ruleGateHtml()}`;
}

// The written balance rule, checked per version by its own script; the page states no verdict.
export const RULE_SOURCE = ".kiro/specs/night-shift-balance-contract/requirements.md";
export const RULE_GATE = "node scripts/billy-balance-gate.mjs --arm";
function ruleGateHtml() {
  const runs = ARMS.map((a) => `<code>${esc(`${RULE_GATE} ${a}`)}</code>`).join("<br>");
  return `<details class="sd-note sd-billy-seat-verify"><summary>Check each version against the written rule</summary>
      <p>Rule: <code>${esc(RULE_SOURCE)}</code>. Each run prints its own pass or rejection:<br>${runs}</p>
    </details>`;
}

export function seatAuditHtml(seat = SEAT_AUDIT, replay = BILLY_REPLAY) {
  const open = `<details id="ledger-billy-seat" class="sd-billy-evidence sd-billy-seat"><summary>${SEAT_TITLE}</summary>`;
  if (!seatAuditOk(seat)) return `${open}<p>The seat audit result is missing or its counts do not add up, so no figures are shown.</p></details>`;
  const [a2, a1] = [replay.baseline.attack, replay.candidate.attack];
  const pairs = SEATS.reduce((sum, f) => sum + seat.byFirst[f].gamesPerArm, 0);
  const draws = ARMS.map((a) => SEATS.reduce((sum, f) => sum + seat.byFirst[f][a].draw, 0));
  const first = firstPlayerShares(seat);
  const row = (r) => `<tr><th scope="row">${r.label}</th><td>${shareText(r.baseline.share)}</td><td>${shareText(r.candidate.share)}</td><td>${r.change}</td></tr>`;
  return `${open}
    <p>Independent of the ${count(2 * replay.cohort.gamesPerArm)}-game replay cohort above, two level-2 bots with fixed decks play ${count(2 * pairs)} games from ${count(seat.deals)} deals, seeds ${seat.firstSeed}–${seat.firstSeed + seat.deals - 1}. Every deal is played with each faction opening and with both versions of Billy, giving ${count(pairs)} paired comparisons.${draws[0] || draws[1] ? ` Draws: ${count(draws[0])} at attack ${a2}, ${count(draws[1])} at attack ${a1}.` : ""}</p>
    <div class="sd-ledger-wrap"><table class="sd-ledger-table sd-billy-seat-table">
      <caption>Cowboy win rate by who opens</caption>
      <thead><tr><th scope="col">Start</th><th scope="col">Attack ${a2}</th><th scope="col">Attack ${a1}</th><th scope="col">Change</th></tr></thead>
      <tbody>${seatRows(seat).map(row).join("")}</tbody>
    </table></div>
    <p class="sd-billy-seat-finding">${esc(seatObservation(first, replay))}</p>
    ${seatVerifyHtml(seat)}
  </details>`;
}

// Wires the replay inside `root` once. Only attributes, the stage and the status text change; no button is replaced
// and focus is never moved, so a keyboard visitor can press Next step again and again.
export function wireBillyReplay(root, replay = BILLY_REPLAY) {
  const box = typeof root?.querySelector === "function" ? root.querySelector("#ledger-billy") : null;
  if (!box) return;
  const $ = (selector) => box.querySelector(selector);
  const lines = [...box.querySelectorAll("[data-billy-line]")];
  const [stage, now, steps, back, next, again] = ["#ledger-billy-stage", "#ledger-billy-now", "#ledger-billy-steps",
    '[data-billy-step="back"]', '[data-billy-step="next"]', '[data-billy-step="replay"]'].map($);
  let line = null, step = 0;
  box.addEventListener("click", (event) => {
    const b = event.target.closest?.("button");
    if (!b || b.getAttribute("aria-disabled") === "true") return;
    const {billyLine, billyStep} = b.dataset;
    if (LINES.includes(billyLine)) [line, step] = [billyLine, 0];
    else if (billyStep && line) step = billyStep === "replay" ? 0 : step + (billyStep === "next" ? 1 : -1);
    else return;
    const view = replayView(line, step, replay);
    step = view.step;
    stage.innerHTML = view.stage;
    now.textContent = view.caption;
    for (const each of lines) each.setAttribute("aria-pressed", String(each.dataset.billyLine === line));
    steps.hidden = false;
    back.setAttribute("aria-disabled", String(view.first));
    again.setAttribute("aria-disabled", String(view.first));
    next.setAttribute("aria-disabled", String(view.last));
  });
}
