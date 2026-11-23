// Agent Arena playbooks: a bounded, data-only Showdown policy that one Kiro persona writes once.
// The referee (arena.mjs) asks decide() for one of the engine's legal actions at every decision.
// A playbook is JSON checked against a closed schema: decide() reads only its enums, small whole
// numbers and booleans. No text from a playbook is ever executed or used as an instruction.
// decide() sees a seat view: never the other side's hand, deck order or face-down trap identities.
import {createHash} from "node:crypto";
import {cardOf, has} from "../../src/game/showdown/cards.js";
import {attackOf, attackOutcome, canAttack, opponent} from "../../src/game/showdown/rules.js";

export const SCHEMA = "agent-arena-playbook/1";
export const MAX_BYTES = 4096;
export const PERSONAS = Object.freeze({
  "cautious-sheriff": Object.freeze({name: "Cautious Sheriff", side: "cowboy"}),
  "reckless-wizard": Object.freeze({name: "Reckless Wizard", side: "wizard"}),
});

export const ACTION_TYPES = Object.freeze(["summon", "spell", "gear", "location", "set", "attack", "cover", "end"]);
export const ATTACK_PREFER = Object.freeze(["win-now", "kill", "attacker-survives", "base-damage", "biggest-threat", "weakest-target", "go-face"]);
export const ATTACK_AVOID = Object.freeze(["suicide", "even-trade", "chip"]);
export const SUMMON_PREFER = Object.freeze(["free", "ready", "strongest", "hardest-hitting", "toughest", "guard"]);
export const SPELL_PREFER = Object.freeze(["kill", "biggest-threat", "most-hit"]);
export const GEAR_PREFER = Object.freeze(["ready", "hardest-hitting", "most-threatened"]);
export const COVER_WHEN = Object.freeze(["threatened", "always"]);
const MOTTO = /^[\x20-\x7e]{0,80}$/;

// What a persona reads in brief.json. Plain data describing the schema above; nothing here is code.
export const GUIDE = Object.freeze({
  schema: SCHEMA,
  maxBytes: MAX_BYTES,
  // Every key below is required and no other key is allowed. Each entry starts with its JSON type.
  format: "A \"list\" is a JSON array of strings, written with [ ], even with one entry or none, each entry at most once. \"One string\" is a bare JSON string, never inside [ ]. A \"number\" is an unquoted JSON number and a \"boolean\" is unquoted true or false.",
  shape: {
    schema: `one string: exactly "${SCHEMA}"`,
    persona: "one string: your persona id",
    motto: "one string: up to 80 printable ASCII characters, shown to spectators only, never read by the referee",
    order: "list of enums.order values, 1 or more entries, must include \"end\": action types in priority order; types left out are never chosen",
    attack: {
      prefer: "list of enums[\"attack.prefer\"] values, may be empty: tie-break list over legal attacks, best first",
      avoid: "list of enums[\"attack.avoid\"] values, may be empty: attacks to rule out unless they win now",
    },
    summon: {
      prefer: "list of enums[\"summon.prefer\"] values, may be empty: tie-break list over legal summons",
      maxTributes: "number 0, 1 or 2: summons that tribute more troops are ruled out",
    },
    spell: {
      prefer: "list of enums[\"spell.prefer\"] values, may be empty: tie-break list over legal spells",
      onlyToKill: "boolean: when true, only spells that defeat a troop",
    },
    gear: {prefer: "list of enums[\"gear.prefer\"] values, may be empty: tie-break list over own troops to equip"},
    cover: {when: "one string from enums[\"cover.when\"], not a list: which troops may take cover when cover is the chosen type"},
  },
  enums: {order: ACTION_TYPES, "attack.prefer": ATTACK_PREFER, "attack.avoid": ATTACK_AVOID, "summon.prefer": SUMMON_PREFER,
    "spell.prefer": SPELL_PREFER, "gear.prefer": GEAR_PREFER, "cover.when": COVER_WHEN},
  meanings: {
    "win-now": "the attack's Base damage is at least the other Base's orbs",
    kill: "the attack or spell defeats a troop (attack estimates ignore unseen traps, as the bot's do)",
    "attacker-survives": "your attacker keeps at least one orb",
    "base-damage": "more orbs off the other Base",
    "biggest-threat": "the target troop with the highest attack",
    "weakest-target": "the target troop with the fewest orbs",
    "go-face": "strike the Base",
    suicide: "your attacker is defeated and the target survives",
    "even-trade": "both your attacker and the target are defeated",
    chip: "the target survives and no damage reaches the Base",
    free: "no tribute", ready: "can act on arrival (tribute or Quickdraw)", strongest: "highest attack plus orbs",
    "hardest-hitting": "highest attack", toughest: "most orbs", guard: "has Guard",
    "most-hit": "hits the most enemy troops", "most-threatened": "own troop with the fewest orbs",
    threatened: "only a troop that the strongest enemy troop would hit past its last orb", always: "any troop that has not acted",
  },
  decision: "At each decision the referee lists the engine's legal actions. It takes the first type in order that has an allowed legal action, ranks those actions by the prefer list, and breaks remaining ties by the engine's listing order.",
});

const VALIDATED = new WeakSet();

const deepFreeze = (value) => {
  if (value && typeof value === "object") {
    for (const each of Object.values(value)) deepFreeze(each);
    Object.freeze(value);
  }
  return value;
};

// Sorted-key JSON, so the same data always has the same digest.
export const canonical = (value) => JSON.stringify(value, (key, each) => (each && typeof each === "object" && !Array.isArray(each)
  ? Object.fromEntries(Object.keys(each).sort().map((name) => [name, each[name]])) : each));
export const sha256 = (data) => createHash("sha256").update(data).digest("hex");
export const policyDigest = (playbook) => sha256(canonical(playbook));

// Strict check. Returns {ok, errors, playbook}; playbook is a new frozen object built only from checked fields.
export function validatePlaybook(value, persona) {
  const errors = [];
  const object = (v, path, keys) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      errors.push(`${path} must be an object`);
      return false;
    }
    for (const key of Object.keys(v)) if (!keys.includes(key)) errors.push(`${path}.${key} is not allowed`);
    for (const key of keys) if (!Object.hasOwn(v, key)) errors.push(`${path}.${key} is missing`);
    return true;
  };
  const list = (v, path, allowed, min = 0) => {
    if (!Array.isArray(v)) return errors.push(`${path} must be a list`);
    if (v.length < min || v.length > allowed.length) errors.push(`${path} must have ${min} to ${allowed.length} entries`);
    v.forEach((item, i) => { if (!allowed.includes(item)) errors.push(`${path}[${i}] must be one of ${allowed.join(", ")}`); });
    if (new Set(v).size !== v.length) errors.push(`${path} repeats an entry`);
  };
  if (!Object.hasOwn(PERSONAS, persona)) return {ok: false, errors: [`unknown persona ${persona}`]};
  if (!object(value, "playbook", ["schema", "persona", "motto", "order", "attack", "summon", "spell", "gear", "cover"])) return {ok: false, errors};
  if (value.schema !== SCHEMA) errors.push(`playbook.schema must be "${SCHEMA}"`);
  if (value.persona !== persona) errors.push(`playbook.persona must be "${persona}"`);
  if (typeof value.motto !== "string" || !MOTTO.test(value.motto)) errors.push("playbook.motto must be up to 80 printable ASCII characters");
  list(value.order, "playbook.order", ACTION_TYPES, 1);
  if (Array.isArray(value.order) && !value.order.includes("end")) errors.push("playbook.order must include \"end\"");
  if (object(value.attack, "playbook.attack", ["prefer", "avoid"])) {
    list(value.attack.prefer, "playbook.attack.prefer", ATTACK_PREFER);
    list(value.attack.avoid, "playbook.attack.avoid", ATTACK_AVOID);
  }
  if (object(value.summon, "playbook.summon", ["prefer", "maxTributes"])) {
    list(value.summon.prefer, "playbook.summon.prefer", SUMMON_PREFER);
    if (![0, 1, 2].includes(value.summon.maxTributes)) errors.push("playbook.summon.maxTributes must be 0, 1 or 2");
  }
  if (object(value.spell, "playbook.spell", ["prefer", "onlyToKill"])) {
    list(value.spell.prefer, "playbook.spell.prefer", SPELL_PREFER);
    if (typeof value.spell.onlyToKill !== "boolean") errors.push("playbook.spell.onlyToKill must be true or false");
  }
  if (object(value.gear, "playbook.gear", ["prefer"])) list(value.gear.prefer, "playbook.gear.prefer", GEAR_PREFER);
  if (object(value.cover, "playbook.cover", ["when"]) && !COVER_WHEN.includes(value.cover.when)) {
    errors.push(Array.isArray(value.cover.when)
      ? `playbook.cover.when must be one string, not a list: one of ${COVER_WHEN.join(", ")}`
      : `playbook.cover.when must be one of ${COVER_WHEN.join(", ")}`);
  }
  if (errors.length) return {ok: false, errors};
  const playbook = deepFreeze({
    schema: SCHEMA, persona, motto: value.motto, order: [...value.order],
    attack: {prefer: [...value.attack.prefer], avoid: [...value.attack.avoid]},
    summon: {prefer: [...value.summon.prefer], maxTributes: value.summon.maxTributes},
    spell: {prefer: [...value.spell.prefer], onlyToKill: value.spell.onlyToKill},
    gear: {prefer: [...value.gear.prefer]},
    cover: {when: value.cover.when},
  });
  VALIDATED.add(playbook);
  return {ok: true, errors: [], playbook};
}

// From the file's text: bounded size, JSON only, then the strict check.
export function parsePlaybook(text, persona) {
  if (typeof text !== "string") return {ok: false, errors: ["playbook text must be a string"]};
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) return {ok: false, errors: [`playbook is larger than ${MAX_BYTES} bytes`]};
  let value;
  try { value = JSON.parse(text); } catch (error) { return {ok: false, errors: [`playbook is not JSON: ${error.message}`]}; }
  return validatePlaybook(value, persona);
}

// What the active side may know. The other side's hand, deck and traps appear only as counts.
export function seatView(state) {
  const side = state.active;
  const other = opponent(side);
  const own = state.sides[side];
  const enemy = state.sides[other];
  const open = (s) => ({base: s.base, baseMax: s.baseMax, board: structuredClone(s.board), discard: [...s.discard], deckCount: s.deck.length});
  return deepFreeze({
    turn: state.turn, active: side, first: state.first, location: structuredClone(state.location),
    summonUsed: state.summonUsed, castUsed: state.castUsed, setUsed: state.setUsed, attacking: state.attacking,
    sides: {
      [side]: {...open(own), hand: [...own.hand], traps: [...own.traps]},
      [other]: {...open(enemy), handCount: enemy.hand.length, trapCount: enemy.traps.length},
    },
  });
}

// Numbers describing one legal action from the seat view. Booleans are 0 or 1; higher ranks first.
export function actionFacts(view, action) {
  const own = view.sides[view.active];
  const enemy = view.sides[opponent(view.active)];
  if (action.type === "attack") {
    const outcome = attackOutcome(view, action.slot, action.target);
    const defender = action.target === "base" ? null : enemy.board[action.target];
    const kill = Boolean(defender) && outcome.targetLeft === 0;
    const survives = outcome.attackerLeft > 0;
    return {
      "win-now": +(outcome.baseDamage > 0 && outcome.baseDamage >= enemy.base), kill: +kill, "attacker-survives": +survives,
      "base-damage": outcome.baseDamage, "biggest-threat": defender ? attackOf(view, defender) : 0,
      "weakest-target": defender ? -defender.health : -99, "go-face": +!defender,
      suicide: +(Boolean(defender) && !survives && !kill), "even-trade": +(!survives && kill),
      chip: +(Boolean(defender) && !kill && outcome.baseDamage === 0),
    };
  }
  if (action.type === "summon") {
    const card = cardOf(action.cardId);
    const paid = action.tributes.length;
    return {free: +(paid === 0), ready: +(paid > 0 || has(action.cardId, "quickdraw")), strongest: card.attack + card.health,
      "hardest-hitting": card.attack, toughest: card.health, guard: +has(action.cardId, "guard"), tributes: paid};
  }
  if (action.type === "spell") {
    const hit = action.target === undefined ? enemy.board.filter(Boolean) : [enemy.board[action.target]];
    const stun = cardOf(action.cardId).effect === "tie";
    return {kill: stun ? 0 : hit.filter((troop) => troop.health <= 1).length,
      "biggest-threat": Math.max(0, ...hit.map((troop) => attackOf(view, troop))), "most-hit": hit.length};
  }
  if (action.type === "gear" || action.type === "cover") {
    const troop = own.board[action.slot];
    const strongest = Math.max(0, ...enemy.board.map((each) => (each ? attackOf(view, each) : 0)));
    return {ready: +canAttack(view, troop), "hardest-hitting": attackOf(view, troop), "most-threatened": -troop.health,
      threatened: +(strongest > troop.health)};
  }
  return {};
}

function allowed(playbook, action, facts) {
  if (action.type === "attack") return Boolean(facts["win-now"]) || !playbook.attack.avoid.some((name) => facts[name]);
  if (action.type === "summon") return facts.tributes <= playbook.summon.maxTributes;
  if (action.type === "spell") return !playbook.spell.onlyToKill || facts.kill > 0;
  if (action.type === "cover") return playbook.cover.when === "always" || Boolean(facts.threatened);
  return true;
}

const PREFER = {attack: (p) => p.attack.prefer, summon: (p) => p.summon.prefer, spell: (p) => p.spell.prefer, gear: (p) => p.gear.prefer};

// One legal action for the active side. Returns {action, index, type, ruledOut}: index into legal,
// and how many legal actions of earlier-priority types the playbook ruled out at this decision.
export function decide(view, legal, playbook) {
  if (!VALIDATED.has(playbook)) throw new Error("decide only runs a playbook returned by validatePlaybook");
  let ruledOut = 0;
  for (const type of playbook.order) {
    const options = legal.flatMap((action, index) => (action.type === type ? [{action, index, facts: actionFacts(view, action)}] : []));
    const kept = options.filter((option) => allowed(playbook, option.action, option.facts));
    ruledOut += options.length - kept.length;
    if (!kept.length) continue;
    const keys = PREFER[type]?.(playbook) ?? [];
    kept.sort((a, b) => {
      for (const key of keys) if (a.facts[key] !== b.facts[key]) return b.facts[key] - a.facts[key];
      return a.index - b.index;
    });
    return {action: kept[0].action, index: kept[0].index, type, ruledOut};
  }
  // A validated playbook lists "end", and the engine always lists {type: "end"} while a game is running.
  throw new Error("playbook found no legal action");
}
