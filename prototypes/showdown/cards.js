// Showdown's card table. Numbers for cards the main game already has come from its catalog;
// this file adds what Showdown needs on top: a type tag, keywords, spell and trap effects,
// and the cards that exist only here so far (marked `fresh`).
import {CARD_SPECS} from "../../src/game/card-specs.generated.js";

// Every keyword has one fixed meaning, printed on the screen and in cards.csv.
export const KEYWORDS = Object.freeze({
  guard: ["Guard", "Enemies must attack this troop before any other troop or the Base."],
  quickdraw: ["Quickdraw", "Can attack on the turn it arrives, even when it was free."],
  ride: ["Ride", "Can ride past enemy troops to strike the Base for 1 orb, unless one of them has Guard."],
  scout: ["Scout", "When it arrives, draw a card."],
  raise: ["Raise", "When it arrives, the last Undead troop in your graveyard returns with 1 orb."],
  sweep: ["Sweep", "When it attacks a troop, every other enemy troop loses 1 orb."],
  laststand: ["Last Stand", "When it is defeated in a fight, the troop that fought it loses 1 orb."],
  ghostly: ["Ghostly", "Spells cannot target it."],
});

// What a spell or trap does. `target` says whether the player picks an enemy troop.
export const EFFECTS = Object.freeze({
  shot: {target: true, text: "Remove 1 orb from an enemy troop."},
  tie: {target: true, text: "Stun an enemy troop: it cannot attack on its next turn."},
  hellfire: {target: false, text: "Remove 1 orb from every enemy troop."},
  snare: {target: false, text: "Trap. When an enemy troop attacks, it loses 2 orbs first. If that defeats it, the attack never lands."},
  hex: {target: false, text: "Trap. When an enemy troop attacks, the attack is cancelled."},
});

// tag and keywords for troops, effect for spells and traps.
const OVERLAY = {
  "cowboy-sheriff": {tag: "Lawman"},
  "cowboy-billy": {tag: "Outlaw"},
  "cowboy-mounted-billy": {tag: "Outlaw", keys: ["ride"]},
  "cowboy-deadeye": {effect: "shot"},
  "cowboy-captured-dragon": {tag: "Beast", keys: ["sweep"]},
  "cowboy-captured-wraith": {tag: "Undead", keys: ["ghostly"]},
  "cowboy-covered-wagon": {tag: "Rig", keys: ["guard"]},
  "cowboy-outrider": {tag: "Lawman", keys: ["ride"]},
  "cowboy-dynamiter": {tag: "Outlaw", keys: ["laststand"]},
  "cowboy-ranger": {tag: "Lawman", keys: ["scout"]},
  "cowboy-gatling-crew": {tag: "Rig", keys: ["sweep"]},
  "cowboy-lasso": {effect: "tie"},
  "wizard-skeleton": {tag: "Undead"},
  "wizard-wizard": {tag: "Mage", keys: ["raise"]},
  "wizard-dragon": {tag: "Beast", keys: ["sweep"]},
  "wizard-singularity": {effect: "shot"},
  "wizard-lantern-wraith": {tag: "Undead", keys: ["ghostly"]},
  "wizard-imp": {tag: "Fiend", keys: ["quickdraw"]},
};

const troop = (side, name, stars, attack, health, tag, ...keys) => ({side, name, kind: "troop", stars, attack, health, tag, keys, fresh: true});
// Cards that exist only in Showdown so far.
const FRESH = {
  "cowboy-bear-trap": {side: "cowboy", name: "Bear Trap", kind: "trap", effect: "snare", fresh: true},
  "wizard-bone-wall": troop("wizard", "Bone Wall", 3, 0, 4, "Undead", "guard"),
  "wizard-raven-familiar": troop("wizard", "Raven Familiar", 2, 1, 1, "Beast", "scout"),
  "wizard-headless-horseman": troop("wizard", "Headless Horseman", 5, 2, 3, "Undead", "ride"),
  "wizard-jack-o-lantern": troop("wizard", "Jack-o'-Lantern", 1, 1, 1, "Fiend", "laststand"),
  "wizard-hellfire": {side: "wizard", name: "Hellfire", kind: "spell", effect: "hellfire", fresh: true},
  "wizard-hex": {side: "wizard", name: "Hex", kind: "trap", effect: "hex", fresh: true},
};

export const TYPES = Object.freeze({
  ...Object.fromEntries(CARD_SPECS.map(({type, side, name, kind, stars, attack, health, bounty}) => {
    if (!OVERLAY[type]) throw new Error(`prototypes/showdown/cards.js has no entry for ${type}`);
    return [type, {side, name, kind, stars, attack, health, bounty: Boolean(bounty), keys: [], ...OVERLAY[type]}];
  })),
  ...FRESH,
});

export const typeOf = (cardId) => cardId.replace(/-\d+$/, "");
export const cardOf = (cardId) => TYPES[typeOf(cardId)];
export const has = (cardId, key) => cardOf(cardId).keys?.includes(key) ?? false;
// 1 to 4 stars are free, 5 and 6 cost one tribute, 7 and up cost two (the main game's rule).
export const tributes = (cardId) => (cardOf(cardId).stars >= 7 ? 2 : cardOf(cardId).stars >= 5 ? 1 : 0);

// Sixteen-card decks built to show every keyword, both traps and all three card kinds.
export const DECKS = Object.freeze({
  cowboy: {"cowboy-sheriff": 4, "cowboy-outrider": 2, "cowboy-covered-wagon": 2, "cowboy-billy": 2, "cowboy-ranger": 1,
    "cowboy-dynamiter": 1, "cowboy-mounted-billy": 1, "cowboy-deadeye": 1, "cowboy-lasso": 1, "cowboy-bear-trap": 1},
  wizard: {"wizard-skeleton": 4, "wizard-jack-o-lantern": 1, "wizard-raven-familiar": 1, "wizard-imp": 1, "wizard-bone-wall": 2,
    "wizard-wizard": 2, "wizard-headless-horseman": 1, "wizard-dragon": 1, "wizard-singularity": 1, "wizard-hellfire": 1, "wizard-hex": 1},
});
export const deckIds = (side, counts = DECKS[side]) => Object.entries(counts).flatMap(([type, count]) => Array.from({length: count}, (_, i) => `${type}-${i + 1}`));
