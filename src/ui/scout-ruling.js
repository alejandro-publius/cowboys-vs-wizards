// "Would you ship this?" in the Saloon. The player sees one card change the native scout proposed and
// its two scouting blocks, decides Ship or Keep, then learns the real rule and why Kiro held the change.
// After deciding, the player can compare one recorded deal: the same seed played with the current and
// the proposed card, the first event where they differ and the actual winners.
// Data: docs/evidence/night-shift-repair/scout-ruling.json, written by the coordinator from a computed
// run; null until then. Shape: {schema: 1, verdict: "withheld", nativeWorkflowId, sourceSha256, base,
// inputs, counts: {proposed, measured, compilerRejected, eligible, simulatedGames},
// change: {card, field, from, to}, blocks: [{id, games, cowboyWins, candidatePct, baselinePct,
// ceilingPct, overByWins, pass}] (two), example: {seed, first, turn, baseline: {winner, move},
// candidate: {winner, move}}, freshRun: false, applied: false}.
// Nothing here plays, scores or applies anything. A record that is missing a field, names a card stat
// this build does not have, or disagrees with itself is not shown. Every value comes from the record.
import {TYPES} from "../game/showdown/cards.js";
import RULING from "../../docs/evidence/night-shift-repair/scout-ruling.json" with {type: "json"};

export const PICKS = Object.freeze(["ship", "keep"]);
export const BLOCK_COUNT = 2;
const FACTION = Object.freeze({cowboy: "Cowboys", wizard: "Wizards"});
const WINNERS = ["cowboy", "wizard", "draw"];
const STATS = ["attack", "health", "stars"];
const COUNT_KEYS = ["proposed", "measured", "compilerRejected", "eligible", "simulatedGames"];
const TEXT_MAX = 160;
const ID_MAX = 80;
const PCT_TOLERANCE = 0.005;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
const isRecord = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isInt = (n, min = 0) => Number.isInteger(n) && n >= min;
const isText = (s, max = TEXT_MAX) => typeof s === "string" && s.trim().length > 0 && s.length <= max;
const isPct = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;
const isSlug = (s) => typeof s === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(s);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const pct = (n) => `${Number(n.toFixed(2))}%`;
const short = (hex, n) => (/^[0-9a-f]+$/.test(hex) && hex.length > n ? hex.slice(0, n) : hex);
const canonical = (v) => (Array.isArray(v) ? `[${v.map(canonical).join(",")}]`
  : isRecord(v) ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`
    : JSON.stringify(v ?? null));

// Pure: the most Cowboy wins a block allows under its ceiling.
export const maxWins = (block) => Math.floor((block.ceilingPct * block.games) / 100 + 1e-9);

export const EMPTY_TEXT = Object.freeze({
  missing: "No scouting ruling is recorded yet.",
  invalid: "The scouting ruling is incomplete or does not add up, so nothing from it is shown.",
});
const refuse = (reason, text = EMPTY_TEXT[reason]) => ({ok: false, reason, text});

function cleanBlock(b) {
  if (!isRecord(b) || !isSlug(b.id) || !isInt(b.games, 1) || !isInt(b.cowboyWins) || b.cowboyWins > b.games) return null;
  if (![b.candidatePct, b.baselinePct, b.ceilingPct].every(isPct) || !isInt(b.overByWins) || typeof b.pass !== "boolean") return null;
  if (Math.abs(b.candidatePct - (100 * b.cowboyWins) / b.games) > PCT_TOLERANCE) return null;
  const block = {id: b.id, games: b.games, cowboyWins: b.cowboyWins, candidatePct: b.candidatePct,
    baselinePct: b.baselinePct, ceilingPct: b.ceilingPct, overByWins: b.overByWins, pass: b.pass};
  if (b.overByWins !== Math.max(0, b.cowboyWins - maxWins(block))) return null;
  if (b.pass && b.overByWins > 0) return null;
  return block;
}

// A recorded event is either its text or {label, turn?, card?, target?}; only the label is shown.
function cleanMove(m, turn) {
  if (isText(m)) return m.trim();
  if (!isRecord(m) || !isText(m.label)) return null;
  if (m.turn !== undefined && m.turn !== turn) return null;
  for (const key of ["card", "target"]) if (m[key] !== undefined && !isText(m[key], ID_MAX)) return null;
  return m.label.trim();
}

function cleanLine(line, turn) {
  if (!isRecord(line) || !WINNERS.includes(line.winner)) return null;
  const move = cleanMove(line.move, turn);
  return move ? {winner: line.winner, move, raw: line.move} : null;
}

function cleanExample(e) {
  if (!isRecord(e) || !isInt(e.seed) || !(e.first in FACTION) || !isInt(e.turn, 1)) return null;
  const baseline = cleanLine(e.baseline, e.turn), candidate = cleanLine(e.candidate, e.turn);
  if (!baseline || !candidate || canonical(baseline.raw) === canonical(candidate.raw)) return null;
  return {seed: e.seed, first: e.first, turn: e.turn,
    baseline: {winner: baseline.winner, move: baseline.move}, candidate: {winner: candidate.winner, move: candidate.move}};
}

// Pure: {ok: true, ruling} for a complete, self-consistent withheld ruling whose change starts from this
// build's card; otherwise {ok: false, reason, text} with reason missing, invalid or stale.
export function checkRuling(raw = RULING, types = TYPES) {
  if (raw === null || raw === undefined) return refuse("missing");
  if (!isRecord(raw) || raw.schema !== 1 || raw.verdict !== "withheld" || raw.freshRun !== false || raw.applied !== false) return refuse("invalid");
  if (!isText(raw.nativeWorkflowId, ID_MAX) || typeof raw.sourceSha256 !== "string" || !/^[0-9a-f]{64}$/.test(raw.sourceSha256)) return refuse("invalid");
  if (!isText(raw.base, ID_MAX) || !isRecord(raw.inputs)) return refuse("invalid");
  const c = raw.counts;
  if (!isRecord(c) || !COUNT_KEYS.every((k) => isInt(c[k]))) return refuse("invalid");
  if (c.measured + c.compilerRejected > c.proposed || c.eligible > c.measured) return refuse("invalid");
  const ch = raw.change;
  if (!isRecord(ch) || !isSlug(ch.card) || !STATS.includes(ch.field) || !isInt(ch.from) || !isInt(ch.to) || ch.from === ch.to) return refuse("invalid");
  const card = isRecord(types) && Object.hasOwn(types, ch.card) ? types[ch.card] : null;
  if (!isRecord(card) || !isText(card.name, ID_MAX) || !Number.isInteger(card[ch.field])) return refuse("invalid");
  if (card[ch.field] !== ch.from) {
    return refuse("stale", `This ruling starts from ${card.name} ${ch.field} ${ch.from}, but this build has ${ch.field} ${card[ch.field]}, so it is not shown.`);
  }
  if (!Array.isArray(raw.blocks) || raw.blocks.length !== BLOCK_COUNT) return refuse("invalid");
  const blocks = raw.blocks.map(cleanBlock);
  if (blocks.some((b) => !b) || new Set(blocks.map((b) => b.id)).size !== blocks.length) return refuse("invalid");
  // A withheld change must have a block that explains the hold.
  if (blocks.every((b) => b.pass)) return refuse("invalid");
  if (c.simulatedGames < blocks.reduce((n, b) => n + b.games, 0)) return refuse("invalid");
  const example = cleanExample(raw.example);
  if (!example) return refuse("invalid");
  return {ok: true, ruling: {workflowId: raw.nativeWorkflowId, sourceSha256: raw.sourceSha256, base: raw.base,
    counts: Object.fromEntries(COUNT_KEYS.map((k) => [k, c[k]])),
    change: {card: ch.card, field: ch.field, from: ch.from, to: ch.to}, name: card.name, blocks, example}};
}

// --- The interaction: decide once, then optionally compare one deal. ---
export function initialRuling() {
  return {pick: null, compared: false};
}

export function rulingReducer(state, action) {
  const s = state ?? initialRuling();
  if (action?.type === "pick" && !s.pick && PICKS.includes(action.pick)) return {...s, pick: action.pick};
  if (action?.type === "compare" && s.pick && !s.compared) return {...s, compared: true};
  return s;
}

const changeText = (r) => `${r.name} ${r.change.field} ${r.change.from} → ${r.change.to}`;
const winnerText = (w) => (w === "draw" ? "a draw" : `the ${FACTION[w]} win`);

// Pure: what the player chose and Kiro's call, in words.
export function pickText(pick) {
  return pick === "ship" ? "You picked Ship the change. Kiro kept the current card."
    : "You picked Keep current card. Kiro made the same call.";
}

// Pure: one line per block once the rule is known.
export function blockRuleText(b) {
  const limit = maxWins(b);
  const head = `${b.id}: ${b.cowboyWins} of ${b.games} Cowboy wins, limit ${limit}`;
  return b.pass ? `${head}. Within the limit.` : `${head}. Over by ${plural(b.overByWins, "win")}.`;
}

// Pure: why Kiro held the change, from the failing blocks and the counts.
export function holdText(r) {
  const failed = r.blocks.filter((b) => !b.pass);
  const over = failed.map((b) => `${b.id} by ${plural(b.overByWins, "win")}`).join(" and ");
  const {measured, eligible} = r.counts;
  const field = eligible === 0 ? `None of the ${measured} measured neighbor changes qualified`
    : `${eligible} of ${measured} measured neighbor changes qualified, but not this one`;
  return `Kiro held it because the proposed card went over the Cowboy limit in ${over}. ${field}, so nothing was shipped.`;
}

function ruleText(r) {
  const ceilings = [...new Set(r.blocks.map((b) => b.ceilingPct))];
  const limit = ceilings.length === 1 ? `${pct(ceilings[0])} of games` : "the ceiling listed for each block";
  return `The rule: in every scouting block, the Cowboys may win at most ${limit}. One win over fails the block.`;
}

function decisionHtml(r, pick) {
  const rows = r.blocks.map((b) => `<li><strong>${esc(b.id)}</strong>: Cowboys won ${b.cowboyWins} of ${b.games}`
    + ` (${pct(b.candidatePct)}) with the proposed card. Current card: ${pct(b.baselinePct)}.</li>`).join("");
  const button = (value, label) => `<button type="button" data-ruling-pick="${value}" aria-pressed="${pick === value}"`
    + `${pick ? ' aria-disabled="true"' : ""}>${label}</button>`;
  return `<dl class="saloon-repair-facts">
      <div><dt>Proposed change</dt><dd>${esc(changeText(r))}</dd></div>
    </dl>
    <ul aria-label="Scouting blocks">${rows}</ul>
    <p><strong>Would you ship this?</strong></p>
    <div class="saloon-buttons" role="group" aria-label="Would you ship this?">
      ${button("ship", "Ship the change")}${button("keep", "Keep current card")}
    </div>`;
}

function revealHtml(r, state) {
  const c = r.counts;
  return `<section class="scout-ruling-reveal" data-ruling-focus="reveal" tabindex="-1" aria-label="Kiro's ruling">
      <p role="status">${esc(pickText(state.pick))}</p>
      <p>${esc(ruleText(r))}</p>
      <ul aria-label="Each block against the rule">${r.blocks.map((b) => `<li data-pass="${b.pass}">${esc(blockRuleText(b))}</li>`).join("")}</ul>
      <p>${esc(holdText(r))}</p>
      <p class="sd-note">The scout proposed ${plural(c.proposed, "change")}: ${c.measured} measured, ${c.compilerRejected} rejected by the compiler, ${c.eligible} eligible, ${plural(c.simulatedGames, "simulated game")}.</p>
      ${state.compared ? "" : `<div class="saloon-buttons"><button type="button" data-ruling-compare="one">Compare one deal</button></div>`}
    </section>`;
}

function compareHtml(r) {
  const e = r.example;
  const line = (key, word, value) => `<li class="saloon-repair-move"><span><strong>${word} ${esc(r.name)}</strong> · ${esc(r.change.field)} ${value}<br>`
    + `Turn ${e.turn}: ${esc(e[key].move)}<br>Result: ${esc(winnerText(e[key].winner))}.</span></li>`;
  return `<section class="scout-ruling-compare" data-ruling-focus="compare" tabindex="-1" aria-label="One scouting deal">
      <p><strong>Scouting deal, seed ${e.seed}.</strong> The ${FACTION[e.first]} move first. The two versions first differ on turn ${e.turn}.</p>
      <ol class="saloon-repair-moves" aria-label="Current and proposed card on turn ${e.turn}">
        ${line("baseline", "Current", r.change.from)}${line("candidate", "Proposed", r.change.to)}
      </ol>
    </section>`;
}

// Pure: the whole interaction for one state, or a short note when the ruling cannot be shown.
export function rulingHtml(check, state = initialRuling()) {
  const title = "<h3>Why Kiro held the change</h3>";
  if (!check.ok) return `<section class="scout-ruling-body">${title}<p class="sd-note">${esc(check.text)}</p></section>`;
  const r = check.ruling;
  return `<section class="scout-ruling-body">
    ${title}
    <p class="sd-note"><strong>Scouting example of an unshipped change.</strong> These are the scout's own seed blocks.
      Reserved check seeds are kept separate and were not played; the change was not applied to any deck.</p>
    ${decisionHtml(r, state.pick)}
    ${state.pick ? revealHtml(r, state) : ""}
    ${state.compared ? compareHtml(r) : ""}
    <p class="sd-note">Native Kiro workflow <code>${esc(r.workflowId)}</code>, base <code>${esc(short(r.base, 7))}</code>, source <code>${esc(short(r.sourceSha256, 12))}</code>.</p>
  </section>`;
}

// DOM: fills the Saloon drawer's `host`. Buttons are native, so Enter and Space work; after each choice
// focus moves to the newly shown part. Returns {check, state()}, or null without a host.
export function mountScoutRuling(host, {ruling = RULING, types = TYPES} = {}) {
  if (!host || typeof host.querySelector !== "function") return null;
  const check = checkRuling(ruling, types);
  host.classList?.add("scout-ruling");
  let state = initialRuling();
  const render = (focus) => {
    host.innerHTML = rulingHtml(check, state);
    if (focus) host.querySelector(`[data-ruling-focus="${focus}"]`)?.focus?.();
  };
  render(null);
  if (!check.ok) return {check, state: () => null};
  host.addEventListener("click", (event) => {
    const b = event.target?.closest?.("button");
    if (!b || (host.contains && !host.contains(b)) || b.getAttribute?.("aria-disabled") === "true") return;
    const action = b.dataset?.rulingPick ? {type: "pick", pick: b.dataset.rulingPick}
      : b.dataset?.rulingCompare ? {type: "compare"} : null;
    const after = rulingReducer(state, action);
    if (after === state) return;
    state = after;
    render(action.type === "pick" ? "reveal" : "compare");
  });
  return {check, state: () => state};
}
