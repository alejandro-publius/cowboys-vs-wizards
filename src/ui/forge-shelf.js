// The Card Forge shelf in the Saloon drawer. It shows the one recorded Card Forge run exactly as the
// coordinator wrote it (docs/evidence/player-card-forge/showcase.json, null until a run is recorded) and
// lets a player replay one released rule or write their own card idea and download it as request.txt.
// The page stores nothing, calls no network, grants no reward and never marks a draft verified:
// only the recorded verifier outcome is shown, and a player's own request stays pending.
import {TYPES} from "../game/showdown/cards.js";
import {hellfireHtml, mountHellfire} from "./forge-hellfire.js";
import SHOWCASE from "../../docs/evidence/player-card-forge/showcase.json" with {type: "json"};

export const REQUEST_MAX = 500;
export const REQUEST_FILE = "request.txt";
export const PREPARE_STEP = `node scripts/card-forge.mjs prepare ${REQUEST_FILE}`;
// Bounds for the recorded showcase. A value outside them means the record is not shown at all.
export const TEXT_MAX = 2000;
export const NAME_MAX = 80;
export const LINE_MAX = 300;
export const STAT_MAX = 99;
export const CHECKS_MAX = 24;
export const PENDING_NOTE = `Download started for ${REQUEST_FILE}. Your request is pending verification.`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
const isText = (s, max) => typeof s === "string" && s.trim().length > 0 && s.length <= max;
const isStat = (n) => Number.isInteger(n) && n >= 0 && n <= STAT_MAX;
const isRecord = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const gamesWord = (n) => `${n.toLocaleString("en-US")} game${n === 1 ? "" : "s"}`;

// Pure: the showcase record as the shelf shows it. {status: "none"} when no run is recorded,
// {status: "invalid"} when any field is missing, mistyped or out of bounds, else {status: "ok", ...}.
// `verified` is taken only as a real boolean, so a string "true" is rejected rather than trusted.
export function forgeView(raw, types = TYPES) {
  if (raw === null || raw === undefined) return {status: "none"};
  const d = raw?.draft;
  const ok = isRecord(raw) && isText(raw.request, TEXT_MAX) && isRecord(d)
    && isText(d.name, NAME_MAX) && isText(d.baseCard, NAME_MAX)
    && isStat(d.attack) && isStat(d.health) && isStat(d.stars)
    && typeof raw.verified === "boolean" && Number.isInteger(raw.games) && raw.games >= 0
    && isText(raw.source, LINE_MAX)
    && Array.isArray(raw.checks) && raw.checks.length <= CHECKS_MAX && raw.checks.every((c) => isText(c, LINE_MAX));
  if (!ok) return {status: "invalid"};
  const base = Object.hasOwn(types, d.baseCard) ? types[d.baseCard] : null;
  return {
    status: "ok", request: raw.request, name: d.name, baseCard: d.baseCard, baseName: base?.name ?? null,
    attack: d.attack, health: d.health, stars: d.stars,
    verified: raw.verified, games: raw.games, source: raw.source, checks: [...raw.checks],
  };
}

// Pure: the verifier outcome in words, straight from the record.
export function verdictText(view) {
  return view.verified
    ? `Verifier passed this draft after ${gamesWord(view.games)}.`
    : `Verifier did not pass this draft. It recorded ${gamesWord(view.games)}.`;
}

// Pure: the showcase card, or an honest note when there is nothing valid to show. All text is escaped.
export function showcaseHtml(view) {
  if (view.status === "none") {
    return `<p class="forge-empty">No Card Forge run is recorded yet.</p>`;
  }
  if (view.status !== "ok") {
    return `<p class="forge-empty">The recorded Card Forge result is missing fields or has values out of range, so nothing from it is shown.</p>`;
  }
  const base = view.baseName ?? view.baseCard;
  const portrait = view.baseName
    ? `<span class="forge-portrait" aria-hidden="true" data-ledger-portrait="${esc(view.baseCard)}"></span>`
    : `<span class="forge-portrait forge-portrait-missing" aria-hidden="true">${esc(base.slice(0, 1).toUpperCase())}</span>`;
  const stat = (label, n) => `<div><dt>${label}</dt><dd>${n}</dd></div>`;
  const checks = view.checks.length
    ? `<ul class="forge-checks">${view.checks.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>`
    : `<p class="sd-note">No checks are listed in the record.</p>`;
  return `<figure class="forge-card" data-verified="${view.verified}">
    <figcaption>
      <span class="forge-label">The player asked for</span>
      <blockquote class="forge-request" style="white-space: pre-wrap">${esc(view.request)}</blockquote>
    </figcaption>
    <div class="forge-face">
      ${portrait}
      <strong class="forge-name">${esc(view.name)}</strong>
      <span class="forge-base">Built on ${esc(base)}</span>
      <dl class="forge-stats">${stat("Attack", view.attack)}${stat("Health", view.health)}${stat("Stars", view.stars)}</dl>
    </div>
    <p class="forge-verdict">${esc(verdictText(view))}</p>
    ${checks}
    <p class="sd-note">Source <code>${esc(view.source)}</code></p>
  </figure>`;
}

// Pure: the player's idea, ready for request.txt. Line endings become \n, control characters other
// than tab and newline are dropped, and the ends are trimmed. Empty or too long is refused.
export function cleanRequest(input) {
  const text = String(input ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim();
  if (!text) return {ok: false, text: "", error: "Write your card idea first."};
  if (text.length > REQUEST_MAX) return {ok: false, text, error: `Keep your idea to ${REQUEST_MAX} characters or fewer.`};
  return {ok: true, text};
}

export const requestFileText = (text) => `${text}\n`;
export const counterText = (value) => `${String(value ?? "").length} of ${REQUEST_MAX} characters`;

// Pure: the whole shelf.
export function shelfHtml(view) {
  return `${hellfireHtml}
  <div class="forge-extras">
    <details class="forge-shelf-own" name="forge-extra">
      <summary id="forge-own-title">Write a card request</summary>
      <form class="forge-form" novalidate>
        <label for="forge-request">Describe your card in plain English</label>
        <textarea id="forge-request" name="request" rows="2" maxlength="${REQUEST_MAX}" spellcheck="true"
          aria-describedby="forge-request-count forge-request-help"></textarea>
        <p id="forge-request-count" class="sd-note">${counterText("")}</p>
        <p id="forge-request-help" class="sd-note">Your idea stays on this device.</p>
        <button type="submit">Download ${REQUEST_FILE}</button>
      </form>
      <p class="forge-status" role="status" aria-live="polite"></p>
      <div class="forge-pending" hidden>
        <span class="forge-label">Pending verification</span>
        <blockquote class="forge-pending-request" style="white-space: pre-wrap"></blockquote>
      </div>
      <details class="forge-instructions">
        <summary>Run your request in Kiro</summary>
        <ol class="forge-steps">
          <li>Put ${REQUEST_FILE} next to the game's <code>scripts/</code> folder.</li>
          <li>Run <code>${esc(PREPARE_STEP)}</code>.</li>
          <li>In Kiro, choose the native Card Forge workflow. It keeps your staged request. With no staged request it uses the recorded example.</li>
          <li>The verifier records whether the draft passed.</li>
        </ol>
      </details>
    </details>
    <details class="forge-shelf-report forge-shelf-showcase" name="forge-extra">
      <summary id="forge-showcase-title">Forge report</summary>
      ${showcaseHtml(view)}
    </details>
  </div>`;
}

// DOM: offers request.txt as a download. Returns false when the browser cannot.
function saveRequest(doc, text) {
  try {
    const urls = globalThis.URL;
    if (!doc?.body || typeof Blob !== "function" || typeof urls?.createObjectURL !== "function") return false;
    const url = urls.createObjectURL(new Blob([requestFileText(text)], {type: "text/plain;charset=utf-8"}));
    const link = Object.assign(doc.createElement("a"), {href: url, download: REQUEST_FILE, hidden: true});
    doc.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => urls.revokeObjectURL(url), 0);
    return true;
  } catch {
    return false;
  }
}

export function mountForgeShelf(host, {showcase = SHOWCASE, portrait, handFace} = {}) {
  if (!host || typeof host.querySelector !== "function") return null;
  const view = forgeView(showcase);
  host.classList?.add("forge-shelf");
  host.innerHTML = shelfHtml(view);
  const q = (selector) => host.querySelector(selector);
  mountHellfire(q(".forge-hellfire"), handFace ?? portrait);

  if (view.status === "ok" && view.baseName && typeof portrait === "function") {
    try {
      const image = portrait(view.baseCard);
      if (image) {
        image.setAttribute?.("aria-hidden", "true");
        q(".forge-portrait").replaceChildren(image);
      }
    } catch { /* the empty frame stays */ }
  }

  const form = q(".forge-form"), field = q("#forge-request"), counter = q("#forge-request-count");
  const status = q(".forge-status"), pending = q(".forge-pending"), pendingRequest = q(".forge-pending-request");
  let lastRequest = null;
  field.addEventListener("input", () => { counter.textContent = counterText(field.value); });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = cleanRequest(field.value);
    if (!result.ok) {
      field.setAttribute("aria-invalid", "true");
      status.textContent = result.error;
      field.focus();
      return;
    }
    field.removeAttribute("aria-invalid");
    if (!saveRequest(host.ownerDocument ?? globalThis.document, result.text)) {
      status.textContent = `This browser could not save the file. Copy your idea into ${REQUEST_FILE} by hand.`;
      return;
    }
    lastRequest = result.text;
    pendingRequest.textContent = result.text;
    pending.hidden = false;
    status.textContent = PENDING_NOTE;
  });

  return {view, pendingRequest: () => lastRequest};
}
