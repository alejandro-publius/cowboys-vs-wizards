// Invalid-action cases built from a legal state. Each case names the one
// reason applyAction must give. These are input mutations, kept apart from the
// legal-state generators: the state is legal, the action is not.
import { CARDS, opponent, tributeCost } from "../../../src/game/cards.js";
import { applyAction } from "../../../src/game/actions.js";
import { legalActions } from "../../../src/game/legal.js";
import { emptySlots, occupiedSlots } from "./generate.js";

const SLOTS_PAST_END = 3; // one past the last slot index

export function invalidActionCases(state, rng) {
  const side = state.activeSide;
  const enemySide = opponent(side);
  const own = state.sides[side];
  const enemy = state.sides[enemySide];
  const { summonUsed, castUsed } = state.allowances[side];
  const base = { side, revision: state.revision };
  const cases = [];
  const add = (category, reason, action, caseState = state) => cases.push({ category, reason, action, state: caseState });

  const occupied = occupiedSlots(own.board);
  const empty = emptySlots(own.board);
  const troops = own.hand.filter((id) => CARDS[id].kind === "troop");
  const spells = own.hand.filter((id) => CARDS[id].kind === "spell");

  // Envelope: stale, replayed, wrong side, malformed.
  const end = { type: "end-phase", ...base };
  add("stale-revision-behind", "stale", { ...end, revision: state.revision - 1 });
  add("stale-revision-ahead", "stale", { ...end, revision: state.revision + 1 });
  // A fresh match has no committed IDs yet, so give the copy one.
  const replayed = state.actionIds.length > 0 ? state : { ...structuredClone(state), actionIds: ["used-1"] };
  add("duplicate-action-id", "duplicate-action", { ...end, actionId: replayed.actionIds[0] }, replayed);
  add("wrong-side", "wrong-side", { ...end, side: enemySide });
  add("unknown-action-type", "invalid-action", { ...end, type: "mulligan" });
  add("empty-action-id", "invalid-action", { ...end, actionId: "" });
  add("terminal-match", "match-over", end, { ...structuredClone(state), activeSide: null, result: { winner: null, loser: null, reason: "round-limit", round: state.round } });

  // An action built for the previous revision, submitted after another action was committed.
  const others = legalActions(state, side).filter((action) => action.type !== "end-phase");
  if (others.length > 0) {
    const first = rng.pick(others);
    const second = rng.pick(legalActions(state, side));
    const next = applyAction(state, { ...second, actionId: "intervening" });
    if (next.ok && !next.state.result) add("stale-after-intervening-action", "stale", { ...first }, next.state);
  }

  // Summons.
  if (troops.length > 0) {
    if (summonUsed) add("second-summon", "summon-used", { type: "summon", ...base, cardId: troops[0], slot: 0, tributes: [] });
    else if (castUsed) add("summon-after-spell", "summon-after-spell", { type: "summon", ...base, cardId: troops[0], slot: 0, tributes: [] });
  }
  if (!summonUsed && !castUsed) {
    const ghost = side + "-ghost-1";
    add("summon-card-unknown", "card-not-in-hand", { type: "summon", ...base, cardId: ghost, slot: 0, tributes: [] });
    if (own.deck.length > 0) add("summon-card-in-deck", "card-not-in-hand", { type: "summon", ...base, cardId: own.deck[0], slot: 0, tributes: [] });
    if (enemy.hand.length > 0) add("summon-foreign-card", "card-not-in-hand", { type: "summon", ...base, cardId: enemy.hand[0], slot: 0, tributes: [] });
    if (own.discard.length > 0) add("summon-card-in-discard", "card-not-in-hand", { type: "summon", ...base, cardId: own.discard[0], slot: 0, tributes: [] });
    if (spells.length > 0) add("summon-a-spell", "not-a-troop", { type: "summon", ...base, cardId: spells[0], slot: 0, tributes: [] });
    for (const cardId of troops) {
      const cost = tributeCost(CARDS[cardId].stars);
      const summon = (slot, tributes) => ({ type: "summon", ...base, cardId, slot, tributes });
      if (occupied.length > 0) add("tribute-duplicate-slot", "invalid-tribute", summon(0, [occupied[0], occupied[0]]));
      if (empty.length > 0) {
        const foreign = empty.find((slot) => enemy.board[slot] !== null);
        add(foreign === undefined ? "tribute-empty-slot" : "tribute-foreign-troop-slot", "invalid-tribute", summon(0, [foreign ?? empty[0]]));
      }
      add("tribute-out-of-range", "invalid-tribute", summon(0, [SLOTS_PAST_END]));
      add("tribute-not-a-slot-number", "invalid-tribute", summon(0, ["0"]));
      add("tribute-not-a-list", "invalid-tribute", { type: "summon", ...base, cardId, slot: 0 });
      if (cost > 0 && occupied.length >= cost - 1) add("tribute-underpaid", "unpaid", summon(empty[0] ?? occupied[0], occupied.slice(0, cost - 1)));
      if (occupied.length >= cost + 1) add("tribute-overpaid", "overpaid", summon(occupied[0], occupied.slice(0, cost + 1)));
      if (occupied.length >= cost) {
        const paid = occupied.slice(0, cost);
        add("summon-slot-out-of-range", "invalid-slot", summon(SLOTS_PAST_END, paid));
        add("summon-slot-not-integer", "invalid-slot", summon(0.5, paid));
        const blocked = occupied.find((slot) => !paid.includes(slot));
        if (blocked !== undefined) add("summon-into-unvacated-slot", "slot-occupied", summon(blocked, paid));
      }
    }
  }

  // Spells.
  if (spells.length > 0 && castUsed) add("second-cast", "cast-used", { type: "spell", ...base, cardId: spells[0], target: 0 });
  if (!castUsed) {
    if (troops.length > 0) add("cast-a-troop", "not-a-spell", { type: "spell", ...base, cardId: troops[0], target: 0 });
    add("spell-card-unknown", "card-not-in-hand", { type: "spell", ...base, cardId: side + "-ghost-1", target: 0 });
    for (const cardId of spells) {
      const spell = (target, destination) => ({ type: "spell", ...base, cardId, target, ...(destination === undefined ? {} : { destination }) });
      add("spell-target-out-of-range", "invalid-target", spell(SLOTS_PAST_END));
      add("spell-target-not-a-slot-number", "invalid-target", spell("0"));
      for (const slot of emptySlots(enemy.board)) add("spell-target-empty-slot", "invalid-target", spell(slot));
      for (const target of occupiedSlots(enemy.board)) {
        const health = enemy.board[target].health;
        if (!CARDS[cardId].relocates) {
          const adjacent = target === 0 ? 1 : target - 1;
          add("destination-on-non-relocating-spell", "invalid-destination", spell(target, adjacent));
          continue;
        }
        add("destination-is-the-target-slot", "invalid-destination", spell(target, target));
        add("destination-past-the-end", "invalid-destination", spell(target, target === 2 ? 3 : -1));
        if (target === 0) add("destination-two-slots-away", "invalid-destination", spell(target, 2));
        if (target === 2) add("destination-two-slots-away", "invalid-destination", spell(target, 0));
        for (const destination of [target - 1, target + 1]) {
          if (destination < 0 || destination > 2) continue;
          if (enemy.board[destination] !== null) add("destination-occupied", "invalid-destination", spell(target, destination));
          else if (health === 1) add("destination-for-a-defeated-target", "invalid-destination", spell(target, destination));
        }
      }
    }
  }
  return cases;
}
