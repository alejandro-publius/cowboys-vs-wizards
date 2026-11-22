// The Sheriff's Ledger shows the first different attack and the recorded finish for each version of Billy.
import {cardOf, typeOf} from "../game/showdown/cards.js";
import {BILLY_REPLAY} from "./billy-replay.data.js";

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

export function billyReplayHtml(replay = BILLY_REPLAY) {
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
  <h4 id="ledger-billy-wins">Cowboy win rate</h4>
  <dl class="sd-billy-scores" aria-labelledby="ledger-billy-wins">${score("baseline", k.baselineCowboyWins)}${score("candidate", k.candidateCowboyWins)}</dl>
  <p class="sd-note">${count(k.gamesPerArm)} games per version, fixed decks and two level-2 bots. ${esc(appliedLine(replay))}</p>
  <details class="sd-billy-evidence"><summary>How to verify this replay</summary>
    <p>The first ${replay.matchedEvents} events match. The next event is Billy’s attack. The bot plays each version through to its recorded ending.</p>
    <p>The sample covers ${count(k.deals)} deals, seeds ${k.firstSeed}–${k.firstSeed + k.deals - 1}. Each faction starts once per deal. Cowboys won ${count(k.baselineCowboyWins)} and ${count(k.candidateCowboyWins)} games respectively. ${count(k.switchedCowboyToWizard)} winners switched to Wizards and ${count(k.switchedWizardToCowboy)} to Cowboys. First-player wins went from ${pct(k.baselineFirstWins, k.gamesPerArm)} to ${pct(k.candidateFirstWins, k.gamesPerArm)}.</p>
    <p>Run <code>${esc(REPRODUCE)}</code>. Source <code>${short(replay.source.commit)}</code> · outcome hash <code>${short(k.csvSha256)}</code> · proposal record <code>${esc(GATE_RECORD)}</code>.</p>
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
