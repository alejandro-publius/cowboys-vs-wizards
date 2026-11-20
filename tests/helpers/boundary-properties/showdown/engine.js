// The Showdown engine under test, as one plain object, so a property can run on the real
// rules or on a disposable faulty wrapper (faults.js) without touching src/.
// Default: src/game/showdown/. SHOWDOWN_ENGINE=<dir> points the same properties at another
// copy of rules.js and contract.js (for example a candidate branch checked out elsewhere).
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const dir = process.env.SHOWDOWN_ENGINE
  ? pathToFileURL(resolve(process.env.SHOWDOWN_ENGINE) + "/")
  : new URL("../../../../src/game/showdown/", import.meta.url);
const rules = await import(new URL("rules.js", dir).href);
const contract = await import(new URL("contract.js", dir).href);

export const ENGINE_DIR = dir.href;
export const ENGINE = Object.freeze({
  createShowdown: rules.createShowdown,
  legalActions: rules.legalActions,
  applyAction: rules.applyAction,
  planTurn: rules.planTurn,
  playTurn: rules.playTurn,
  opponent: rules.opponent,
  viewFor: contract.viewFor,
  EVENTS: contract.EVENTS,
  BOARD_SIZE: rules.BOARD_SIZE,
  HAND_CAP: rules.HAND_CAP,
  TRAP_SLOTS: rules.TRAP_SLOTS,
  TURN_CAP: rules.TURN_CAP,
});
