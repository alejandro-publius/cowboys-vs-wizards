// The graybox Camp's playtest log (issue 143). One line per finished solo duel against the Wizards,
// kept under the prototype's key and turned into text by the prototype's formatter
// (src/game/showdown/playtest.js). Nothing here decides a reward or touches the progress save.
//
// What a line holds: the duel name, won, turns, seconds of play, whether "All the rules" was opened,
// plus the duel id, the deal seed and a random run id so the same finished duel is never logged twice.
// No name, device, clock time or other personal detail is stored, and nothing leaves the browser.
import {logged, report} from "../game/showdown/playtest.js";

export const PLAYTEST_KEY = "cvw-showdown-playtest-v1";

const whole = (n) => Number.isInteger(n) && n >= 0;
// Keeps only well-formed lines, and only their known fields, from whatever the key holds.
const clean = (entry) => entry && typeof entry.name === "string" && typeof entry.won === "boolean" && whole(entry.turns) && whole(entry.seconds)
  ? {name: entry.name, won: entry.won, turns: entry.turns, seconds: entry.seconds, rules: entry.rules === true,
    ...(typeof entry.run === "string" ? {run: entry.run} : {}), ...(typeof entry.duel === "string" ? {duel: entry.duel} : {}),
    ...(Number.isFinite(entry.seed) ? {seed: entry.seed} : {})}
  : null;

function read(storage) {
  try {
    const raw = JSON.parse(storage?.getItem(PLAYTEST_KEY) ?? "null");
    return Array.isArray(raw) ? raw.map(clean).filter(Boolean) : [];
  } catch { return []; }
}

// storage: localStorage or any {getItem, setItem}; null or a throwing one keeps the log in memory only.
export function createPlaytestLog(storage) {
  let log = read(storage);
  let saved = Boolean(storage);
  return {
    entries: () => log,
    saved: () => saved,
    // Adds one finished duel. A run id already in the log is ignored. Returns true when it was added.
    add(entry) {
      const line = clean(entry);
      if (!line || (line.run && log.some((old) => old.run === line.run))) return false;
      log = logged(log, line);
      try { storage.setItem(PLAYTEST_KEY, JSON.stringify(log)); saved = true; } catch { saved = false; }
      return true;
    },
    // Start over erases the report with the progress, as the reference screen does.
    clear() {
      log = [];
      try { storage.setItem(PLAYTEST_KEY, JSON.stringify(log)); saved = true; } catch { saved = false; }
    },
    text: (progress) => report(log, progress),
  };
}

export const newRunId = () => (globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`);
