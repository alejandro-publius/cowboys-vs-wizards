// Public Showdown events route effects to the slots they touch. Keep a running board for batches
// that include a bot turn, and retain departed positions for Last Stand and damage overflow.
import { BOARD_SIZE, TRAP_SLOTS, opponent } from "../../game/showdown/rules.js";
import { SIDES } from "./layout.js";

export function eventPositions(events, before, after) {
  const live = Object.fromEntries(
    SIDES.map((side) => [side, before.sides[side].board.map((t) => t?.cardId ?? null)]),
  );
  const traps = Object.fromEntries(SIDES.map((side) => [side, before.sides[side].trapCount]));
  const departed = new Map();
  let priorTarget = null;
  const out = [];
  const zone = (side, at, slot) => ({ side, at, slot });
  const push = (kind, from, to = null) => out.push({ kind, from, to });
  const find = (side, id) => {
    const slot = live[side].indexOf(id);
    if (slot >= 0) return { side, slot };
    const lost = departed.get(id);
    if (lost?.side === side) return lost;
    const next = after.sides[side].board.findIndex((t) => t?.cardId === id);
    return next >= 0 ? { side, slot: next } : zone(side, "row");
  };
  const remove = (pos) => {
    if (pos.slot === undefined) return;
    const id = live[pos.side][pos.slot];
    if (id) departed.set(id, pos);
    live[pos.side][pos.slot] = null;
  };
  const arrive = (side, id) => {
    const at = live[side].indexOf(null);
    if (at < 0 || at >= BOARD_SIZE) return find(side, id);
    departed.delete(id);
    live[side][at] = id;
    return { side, slot: at };
  };

  for (const e of events) {
    const { side: s, type: k } = e;
    const o = opponent(s);
    const own = (id) => find(s, id);
    const foe = (id) => find(o, id);
    const base = zone(s, "base");
    switch (k) {
      case "draw":
        break;
      case "burn":
        push(k, zone(s, "deck"), zone(s, "discard"));
        break;
      case "fatigue":
        push(k, base);
        break;
      case "set": {
        const slot = Math.min(traps[s]++, TRAP_SLOTS - 1);
        push(k, zone(s, "trap", slot));
        break;
      }
      case "location":
        push(k, zone(null, "location"));
        break;
      case "summon":
        push(k, arrive(s, e.cardId));
        break;
      case "raise":
        push(k, zone(s, "discard"), arrive(s, e.cardId));
        break;
      case "cover":
        push(k, own(e.cardId));
        break;
      case "tribute": {
        const at = own(e.cardId);
        remove(at);
        push(k, at, zone(s, "discard"));
        break;
      }
      case "gear":
        push(k, own(e.target));
        break;
      case "spell": {
        const to = foe(e.target);
        push(k, zone(s, "row"), to);
        if (e.left === 0) remove(to);
        break;
      }
      case "trap": {
        const from = zone(s, "trap", 0);
        const to = foe(e.target);
        push(k, from, to);
        traps[s] = Math.max(0, traps[s] - 1);
        if (e.left === 0) remove(to);
        break;
      }
      case "attack": {
        const from = own(e.cardId);
        const to = e.target === "base" ? zone(o, "base") : foe(e.target);
        priorTarget = to.slot;
        push(k, from, to);
        if (e.hitBack) push("counter", to, from);
        if (e.baseDamage && e.target !== "base") push("overflow", to, zone(o, "base"));
        if (e.targetLeft === 0) remove(to);
        if (e.attackerLeft === 0) remove(from);
        break;
      }
      case "laststand": {
        const to = foe(e.target);
        push(k, own(e.cardId), to);
        if (e.left === 0) remove(to);
        break;
      }
      case "sweep": {
        for (let slot = 0; slot < BOARD_SIZE; slot++) {
          if (slot !== priorTarget && live[o][slot]) push(k, own(e.cardId), { side: o, slot });
        }
        // The contract carries the count, so this effect never decides which troops are removed.
        break;
      }
    }
  }
  return out;
}
