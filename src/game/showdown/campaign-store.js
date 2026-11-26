// Reads and writes Showdown progress through a Storage the caller passes in (localStorage in a
// browser, any {getItem, setItem} in a test). It touches no global. The progress object is the one
// progress.js defines; what a save may hold stays in migrate(), and save codes stay in savecode.js.
//
// Keys, as the prototype screen (prototypes/showdown/main.js) spells them:
//   cvw-showdown-save-v2   the v2 progress object, the only key this file writes
//   cvw-showdown-trail-v1  the first version, {wins, losses}; read only when v2 is missing or unreadable
//   cvw-player-v1          the retired profile; read only its cleared hunt IDs
//   cvw-showdown-playtest-v1  the playtest log; not touched here
import {INHERITED_SOURCE} from "./inherited.js";
import {migrate} from "./progress.js";

export const SAVE_KEY = "cvw-showdown-save-v2";
export const OLD_SAVE_KEY = "cvw-showdown-trail-v1";
// A stored v2 value that migrate() refused (damaged, or from a newer version) is copied here once,
// before the first save that would replace it, so a reset never destroys the only copy.
export const REFUSED_KEY = "cvw-showdown-save-v2-refused";

const read = (storage, key) => {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
};
const parsed = (text) => {
  if (typeof text !== "string") return null;
  try { return JSON.parse(text); } catch { return null; }
};
// Key order does not matter: migrate() rebuilds the top-level keys in its own order.
const isPlain = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const canon = (value) => (Array.isArray(value) ? value.map(canon) : isPlain(value)
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canon(value[key])])) : value);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

// null means the key is absent; undefined means the browser refused the read.
export function campaignText(storage) {
  try { return storage?.getItem(SAVE_KEY) ?? null; } catch { return undefined; }
}
// Load the exact v2 text the caller observed, falling back to the v1 Trail save. Writes nothing.
export function loadCampaign(storage, text = campaignText(storage)) {
  return migrate(parsed(text) ?? parsed(read(storage, OLD_SAVE_KEY)));
}

// Writes `progress` to the v2 key. Returns {ok: true} or {ok: false, reason}; never throws.
// A progress object that the next load would reset is refused, so a reload cannot lose a career.
// The v1 key and the lane profile are left as they are.
export function saveCampaign(storage, progress) {
  let text;
  try {
    text = JSON.stringify(progress);
    if (!same(migrate(JSON.parse(text)), progress)) return {ok: false, reason: "That progress would not load again, so it was not saved."};
  } catch {
    return {ok: false, reason: "That progress would not load again, so it was not saved."};
  }
  if (typeof storage?.setItem !== "function") return {ok: false, reason: "Saving is not available."};
  try {
    const stored = read(storage, SAVE_KEY);
    if (stored !== null && stored !== text && read(storage, REFUSED_KEY) === null) {
      const value = parsed(stored);
      // Kept only when the load ignored it: a reset of a save that was there is the data loss to prevent.
      if (value === null || !same(migrate(value), value)) storage.setItem(REFUSED_KEY, stored);
    }
    storage.setItem(SAVE_KEY, text);
    return {ok: true};
  } catch {
    return {ok: false, reason: "Saving is blocked or full."};
  }
}

// These are IDs from the cvw-player-v1 save format. The old encounters, decks and profile writer
// do not belong in the browser build. A partial set never pays a reward, even if a hunt is repeated.
const LANE_CAPTURES = [
  ["cowboy-captured-dragon", ["coffin-creek-crossing", "bone-choir-chapel", "hanging-tree-pass", "dusk-at-dry-well", "lantern-row-standoff"]],
  ["cowboy-captured-wraith", ["gallows-lantern", "chapel-bell-tower", "ferry-crossing", "blacksmith-forge", "lamplighter-row"]],
];

export function laneCapturedCards(storage) {
  try {
    const source = storage === undefined ? globalThis.localStorage : storage;
    const cleared = parsed(read(source, INHERITED_SOURCE))?.clearedHunts;
    const captures = Array.isArray(cleared)
      ? LANE_CAPTURES.filter(([, hunts]) => hunts.every((id) => cleared.includes(id))).map(([reward]) => reward)
      : [];
    return Object.freeze(captures);
  } catch {
    // Some browsers throw when the localStorage property itself is read.
    return Object.freeze([]);
  }
}
