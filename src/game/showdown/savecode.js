// Reads a pasted save code strictly. Pure: no DOM and no storage. The rules for what a save may hold
// stay in progress.js (migrate); this only decides whether a code is one the player meant to paste.
import {migrate} from "./progress.js";
import {TRAIL} from "./trail.js";

export const MAX_CODE_LENGTH = 16384;
const V2_KEYS = ["v", "wins", "losses", "collection", "deck", "side", "rivals", "hunts", "openWins", "packs", "rolls", "offer"];
const isPlain = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const sameKeys = (value, keys) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
// Key order does not matter; values are plain JSON.
const canon = (value) => (Array.isArray(value) ? value.map(canon) : isPlain(value)
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canon(value[key])])) : value);
export const sameSave = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

export const encodeSave = (save) => btoa(JSON.stringify(save));

// Returns {ok: true, save, legacy} or {ok: false, reason}. Never throws.
export function decodeSaveCode(text) {
  if (typeof text !== "string") return {ok: false, reason: "That is not a save code."};
  const code = text.replace(/\s+/g, "");
  if (!code) return {ok: false, reason: "Paste a save code first."};
  if (code.length > MAX_CODE_LENGTH) return {ok: false, reason: "That code is too long to be a save code."};
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(code) || code.length % 4 !== 0) return {ok: false, reason: "That is not a save code."};
  let raw;
  try { raw = JSON.parse(atob(code)); } catch { return {ok: false, reason: "That is not a save code."}; }
  if (!isPlain(raw)) return {ok: false, reason: "That is not a save code."};
  if (raw.v === undefined) {
    // The first version saved only {wins, losses} for the Trail; migrate() replays those wins.
    const whole = (value) => Number.isInteger(value) && value >= 0;
    const legacy = Object.keys(raw).every((key) => key === "wins" || key === "losses") && whole(raw.wins) && raw.wins <= TRAIL.length
      && (raw.losses === undefined || whole(raw.losses));
    return legacy ? {ok: true, save: migrate(raw), legacy: true} : {ok: false, reason: "That is not a save code."};
  }
  if (Number.isInteger(raw.v) && raw.v > 2) return {ok: false, reason: "That code is from a newer version of the game."};
  if (raw.v !== 2 || !sameKeys(raw, V2_KEYS)) return {ok: false, reason: "That is not a save code."};
  // migrate() answers a save it cannot trust with a new one, so it must hand back exactly what was pasted.
  const save = migrate(raw);
  return sameSave(save, raw) ? {ok: true, save, legacy: false} : {ok: false, reason: "That save code is damaged or does not follow the rules."};
}

const count = (counts) => Object.values(counts).reduce((sum, copies) => sum + copies, 0);
// One line a player can compare with their own Camp before replacing it.
export function describeSave(save) {
  const hunts = Object.values(save.hunts).reduce((sum, cleared) => sum + cleared, 0);
  return [`Trail ${save.wins} of ${TRAIL.length} won`, `${save.rivals.length} rivals beaten`, `${hunts} bounty hunts cleared`,
    `${count(save.collection)} collected cards`, `${save.packs} unopened packs`].join(", ") + ".";
}
