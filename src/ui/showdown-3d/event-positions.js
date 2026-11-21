// A temporary display timeline derived from real action snapshots. No rule state is mutated.
// A killed piece stays in the contact snapshot at zero orbs, long enough to show the reaction.
import { attackOf, opponent, TRAP_SLOTS } from "../../game/showdown/rules.js";
import { cardOf, has, typeOf } from "../../game/showdown/cards.js";

const zone = (side, at, slot) => ({ side, at, slot });
const source = (side, at) => zone(side, at);
const timings = {
  gun: [720, 300],
  blade: [710, 350],
  breath: [940, 540],
  ride: [1240, 770],
  sweep: [850, 535],
  laststand: [720, 470],
  trap: [690, 395],
  lasso: [680, 465],
  shell: [630, 380],
  hellfire: [710, 410],
  vortex: [670, 420],
  "area-vortex": [2370, 1625],
  summon: [480, 215],
  raise: [490, 235],
  cover: [350, 165],
  set: [340, 160],
  fatigue: [420, 205],
  overflow: [390, 230],
  gear: [350, 190],
  location: [410, 200],
  tribute: [340, 220],
  burn: [285, 160],
  draw: [640, 500],
  play: [570, 455],
  burial: [740, 622],
};

const attackTimings = {
  "cowboy-sheriff": [1030, 474],
  "cowboy-dynamiter": [990, 625],
  "cowboy-covered-wagon": [950, 520],
  "wizard-skeleton": [1140, 598],
  "wizard-wizard": [1080, 620],
  "wizard-raven-familiar": [860, 470],
  "wizard-lantern-wraith": [1010, 550],
  "cowboy-captured-wraith": [1010, 550],
};

function attackKind(id, to, standing) {
  const type = id ? typeOf(id) : "";
  if (id && to.at === "base" && standing && has(id, "ride")) return "ride";
  if (type.endsWith("-dragon")) return "breath";
  if (type === "cowboy-covered-wagon") return "blade";
  if (type.startsWith("cowboy-") && !type.endsWith("-wraith")) return "gun";
  return "blade";
}

export function presentationBeats(trace) {
  const beats = [];
  for (const { before, after, events } of trace) {
    const table = structuredClone(before);
    const fallen = new Map();
    const departures = [];
    const find = (side, id) => {
      const slot = table.sides[side].board.findIndex((t) => t?.cardId === id);
      return slot < 0 ? (fallen.get(id)?.mark ?? source(side, "row")) : { side, slot };
    };
    const get = (mark) => (mark.slot === undefined ? null : table.sides[mark.side].board[mark.slot]);
    const hurt = (mark, hp) => {
      const t = get(mark);
      if (t) t.health = hp;
    };
    const clear = (mark, transfer = true) => {
      const t = get(mark);
      if (t) {
        fallen.set(t.cardId, { mark, troop: structuredClone(t) });
        if (transfer) departures.push({ from: mark, side: mark.side, cardId: t.cardId });
        table.sides[mark.side].board[mark.slot] = null;
      }
    };
    const spawn = (side, id, at, raised) => {
      if (at.slot === undefined) return;
      const known = after.sides[side].board[at.slot];
      table.sides[side].board[at.slot] =
        known?.cardId === id
          ? structuredClone(known)
          : { cardId: id, health: raised ? 1 : cardOf(id).health, gear: [], cover: false, stunned: false };
    };
    const add = (kind, from, targets, details, apply) => {
      const [duration, contact] =
        ((kind === "gun" || kind === "blade") && details.cardId && attackTimings[typeOf(details.cardId)]) ||
        timings[kind];
      const pre = structuredClone(table);
      const receiver = targets.map((mark) => ({ mark, hp: get(mark)?.health ?? null }));
      const fromTroop = get(from) ?? (details.cardId ? fallen.get(details.cardId)?.troop : null);
      apply?.();
      const hit = structuredClone(table);
      beats.push({ kind, from, targets, receiver, duration, contact, pre, hit, fromTroop, ...details });
      for (const target of targets) if (get(target)?.health === 0) clear(target);
    };
    let primary = null;
    for (let i = 0; i < events.length; i++) {
      const e = events[i],
        s = e.side,
        other = opponent(s),
        base = source(s, "base");
      const own = (id) => find(s, id),
        foe = (id) => find(other, id);
      switch (e.type) {
        case "turn":
          table.active = s;
          table.sides[s].board.forEach((t) => {
            if (t) t.cover = false;
          });
          table.sides[other].board.forEach((t) => {
            if (t) t.stunned = false;
          });
          break;
        case "draw":
          {
            const drawn = after.sides[s].hand?.find((id) => !table.sides[s].hand?.includes(id));
            add("draw", source(s, "deck"), [source(s, "hand")], { ...e, cardId: drawn }, () => {
              table.sides[s].deckCount = Math.max(0, table.sides[s].deckCount - 1);
              table.sides[s].handCount++;
              if (drawn) table.sides[s].hand?.push(drawn);
            });
          }
          break;
        case "burn":
          add("burn", source(s, "deck"), [source(s, "discard")], e, () => {
            table.sides[s].deckCount = after.sides[s].deckCount;
            table.sides[s].discard.push(e.cardId);
          });
          break;
        case "fatigue":
          add("fatigue", base, [base], e, () => {
            table.sides[s].base = after.sides[s].base;
          });
          break;
        case "set": {
          const at = zone(s, "trap", Math.min(table.sides[s].trapCount, TRAP_SLOTS - 1));
          add("set", source(s, "hand"), [at], e, () => {
            table.sides[s].trapCount = after.sides[s].trapCount;
          });
          break;
        }
        case "location":
          if (table.location)
            departures.push({
              from: source(null, "location"),
              side: table.location.side,
              cardId: table.location.cardId,
            });
          add("location", source(s, "hand"), [source(null, "location")], e, () => {
            table.location = after.location;
          });
          break;
        case "summon":
        case "raise": {
          const slot = table.sides[s].board.indexOf(null);
          const at = slot < 0 ? own(e.cardId) : { side: s, slot };
          add(e.type, e.type === "raise" ? source(s, "discard") : source(s, "hand"), [at], e, () =>
            spawn(s, e.cardId, at, e.type === "raise"),
          );
          break;
        }
        case "tribute": {
          const at = own(e.cardId);
          add("tribute", at, [source(s, "discard")], e, () => {
            clear(at, false);
            table.sides[s].discard.push(e.cardId);
          });
          break;
        }
        case "cover": {
          const at = own(e.cardId);
          add("cover", at, [at], e, () => {
            const t = get(at);
            if (t) t.cover = true;
          });
          break;
        }
        case "gear": {
          const at = own(e.target);
          add("gear", source(s, "hand"), [at], e, () => {
            const t = get(at);
            const actual = after.sides[s].board[at.slot];
            if (t && actual) {
              t.gear = actual.gear;
              t.health = actual.health;
            }
          });
          break;
        }
        case "trap": {
          const at = foe(e.target);
          add("trap", zone(s, "trap", 0), [at], e, () => {
            table.sides[s].trapCount = Math.max(0, table.sides[s].trapCount - 1);
            hurt(at, e.left);
          });
          departures.push({ from: zone(s, "trap", 0), side: s, cardId: e.cardId });
          break;
        }
        case "spell": {
          const kind = e.areaVortex ? "area-vortex" :
            { tie: "lasso", hellfire: "hellfire" }[cardOf(e.cardId).effect] ??
            (typeOf(e.cardId) === "wizard-singularity" ? "vortex" : "shell");
          const hits = [e];
          while ((kind === "hellfire" || kind === "area-vortex") &&
            events[i + 1]?.type === "spell" && events[i + 1].cardId === e.cardId)
            hits.push(events[++i]);
          const targets = hits.map((h) => foe(h.target));
          add("play", source(s, "hand"), [source(s, "row")], e);
          add(kind, e.caster ? own(e.caster) : kind === "lasso" ? base : source(s, "row"), targets, e, () => {
            hits.forEach((h, j) => {
              hurt(targets[j], h.left);
              const t = get(targets[j]);
              if (t && h.stunned) t.stunned = true;
            });
          });
          departures.push({ from: source(s, "row"), side: s, cardId: e.cardId });
          break;
        }
        case "attack": {
          const enemyBase = source(other, "base");
          const from = own(e.cardId);
          const to = e.target === "base" ? enemyBase : foe(e.target);
          primary = to.slot;
          const footing = table.sides[other].board.some(Boolean);
          const kind = attackKind(e.cardId, to, footing);
          const damage = to.at === "base" ? e.baseDamage : Math.max(0, (get(to)?.health ?? 0) - e.targetLeft);
          const shooter = get(from);
          const blocked = shooter && e.covered ? Math.max(0, attackOf(before, shooter) - damage) : 0;
          add(kind, from, [to], { ...e, damage, blocked }, () => {
            if (e.target === "base")
              table.sides[other].base = Math.max(0, table.sides[other].base - e.baseDamage);
            else hurt(to, e.targetLeft);
          });
          if (e.hitBack) {
            add(
              attackKind(e.target, from, false),
              to,
              [from],
              {
                cardId: e.target,
                damage: e.hitBack,
                counter: true,
              },
              () => hurt(from, e.attackerLeft),
            );
          }
          if (e.baseDamage && e.target !== "base") {
            add("overflow", to, [enemyBase], { damage: e.baseDamage, cardId: e.cardId }, () => {
              table.sides[other].base = Math.max(0, table.sides[other].base - e.baseDamage);
            });
          }
          break;
        }
        case "laststand": {
          const to = foe(e.target);
          add("laststand", own(e.cardId), [to], e, () => hurt(to, e.left));
          break;
        }
        case "sweep": {
          const targets = table.sides[other].board.flatMap((t, slot) =>
            t && slot !== primary ? [{ side: other, slot }] : [],
          );
          // No summons can occur within one attack. The canonical after state tells us
          // which of these other occupied slots lost their last orb.
          if (targets.length === e.count)
            add("sweep", own(e.cardId), targets, e, () => {
              for (const at of targets) hurt(at, after.sides[other].board[at.slot]?.health ?? 0);
            });
          break;
        }
      }
    }
    for (const { from, side, cardId } of departures) {
      add("burial", from, [source(side, "discard")], { side, cardId }, () => {
        table.sides[side].discard.push(cardId);
      });
    }
  }
  return beats;
}
