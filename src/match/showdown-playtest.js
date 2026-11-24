// The graybox Camp's playtest log (issue 143). One line per finished solo duel against the Wizards,
// kept under the prototype's key and turned into text by the prototype's formatter
// (src/game/showdown/playtest.js). Nothing here decides a reward or touches the progress save.
//
// What a line holds: the duel name, won, turns, seconds of play, whether "All the rules" was opened,
// plus the duel id, the deal seed and a random run id so the same finished duel is never logged twice,
// and (K-087) the public label of the game build it was finished under: a commit prefix the build
// script stamps into the page, the same for every player of that build. Lines from older builds have
// no label and stay that way; a page never stamps its own label on a line it did not log.
// No name, device, clock time or other personal detail is stored, and nothing leaves the browser.
import {logged, report} from "../game/showdown/playtest.js";

export const PLAYTEST_KEY = "cvw-showdown-playtest-v1";

// Same shape as scripts/graybox-build-label.mjs: 12 hex characters of a commit, "+local" for uncommitted changes.
const BUILD = /^[0-9a-f]{12}(\+local)?$/;
export const buildLabel = (value) => (typeof value === "string" && BUILD.test(value) ? value : null);
/* global __CVW_GRAYBOX_BUILD__ */
// scripts/build-graybox.mjs defines this; unbundled (Node tests, other pages) the page has no label.
export const PAGE_BUILD = typeof __CVW_GRAYBOX_BUILD__ === "undefined" ? null : buildLabel(__CVW_GRAYBOX_BUILD__);

const whole = (n) => Number.isInteger(n) && n >= 0;
// Keeps only well-formed lines, and only their known fields, from whatever the key holds.
const clean = (entry) => entry && typeof entry.name === "string" && typeof entry.won === "boolean" && whole(entry.turns) && whole(entry.seconds)
  ? {name: entry.name, won: entry.won, turns: entry.turns, seconds: entry.seconds, rules: entry.rules === true,
    ...(typeof entry.run === "string" ? {run: entry.run} : {}), ...(typeof entry.duel === "string" ? {duel: entry.duel} : {}),
    ...(Number.isFinite(entry.seed) ? {seed: entry.seed} : {}), ...(buildLabel(entry.build) ? {build: entry.build} : {})}
  : null;

function decode(text) {
  try {
    const raw = JSON.parse(text ?? "null");
    return Array.isArray(raw) ? raw.map(clean).filter(Boolean) : [];
  } catch { return []; }
}

// storage: localStorage or any {getItem, setItem}; null or a throwing one keeps the log in memory only.
// build: this page's label, stamped on each duel it adds and named in the report (defaults to PAGE_BUILD).
export function createPlaytestLog(storage, {build = PAGE_BUILD} = {}) {
  const page = buildLabel(build);
  // Direct practice never reads the report. Once in Camp, re-read changed storage and retain
  // just the local lines whose write failed, so a later append preserves both tabs' games.
  let stored = null, lastText, pending = [];
  let readable = false;
  const current = () => {
    let text;
    try { text = storage?.getItem(PLAYTEST_KEY); } catch { /* keep this visit's lines */ }
    readable = text !== undefined;
    if (stored === null || (text !== undefined && text !== lastText)) {
      lastText = text;
      stored = decode(text);
      const runs = new Set(stored.map((line) => line.run));
      for (const line of pending) if (!line.run || !runs.has(line.run)) stored = logged(stored, line);
    }
    return stored;
  };
  let saved = Boolean(storage);
  const persist = () => {
    if (!readable) { saved = false; return; }
    const text = JSON.stringify(stored);
    try {
      storage.setItem(PLAYTEST_KEY, text);
      lastText = text;
      pending = [];
      saved = true;
    } catch { saved = false; }
  };
  return {
    entries: () => current(),
    saved: () => saved,
    // Adds one finished duel. A run id already in the log is ignored. Returns true when it was added.
    add(entry) {
      const line = clean(entry && {...entry, build: page ?? undefined});
      if (!line) return false;
      const lines = current();
      if (line.run && lines.some((old) => old.run === line.run)) return false;
      stored = logged(lines, line);
      pending = logged(pending, line);
      persist();
      return true;
    },
    // Start over erases the report with the progress, as the reference screen does.
    clear() {
      current();
      stored = [];
      pending = [];
      persist();
    },
    text: (progress) => report(current(), progress, {build: page}),
  };
}

export const newRunId = () => (globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`);
