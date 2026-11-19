// Showdown's card table. Numbers for cards the main game already has come from its catalog;
// this file adds what Showdown needs on top: a type tag, keywords, spell and trap effects,
// and the cards that exist only here so far (marked `fresh`).
import {CARD_SPECS} from "../card-specs.generated.js";

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

// How rare a card is, and how many copies one deck may hold. Basic cards have no limit and are never earned.
export const RARITY = Object.freeze({
  basic: ["Basic", Infinity], common: ["Common", 4], uncommon: ["Uncommon", 3], rare: ["Rare", 2], legendary: ["Legendary", 1],
});

// What a spell, trap, gear or location does. `target` says whether the player picks an enemy troop.
// Gear adds to the troop that carries it. A location adds attack to every troop with its tag, on both sides.
export const EFFECTS = Object.freeze({
  shot: {target: true, text: "Remove 1 orb from an enemy troop."},
  tie: {target: true, text: "Stun an enemy troop: it cannot attack on its next turn."},
  hellfire: {target: false, text: "Remove 1 orb from every enemy troop."},
  snare: {target: false, text: "Trap. When an enemy troop attacks, it loses 2 orbs first. If that defeats it, the attack never lands."},
  hex: {target: false, text: "Trap. When an enemy troop attacks, the attack is cancelled."},
  sixshooter: {attack: 1, orbs: 0, text: "Gear. The troop that carries it has +1 attack."},
  bonearmor: {attack: 0, orbs: 2, text: "Gear. The troop that carries it gains 2 orbs."},
  office: {tag: "Lawman", text: "Location. Lawman troops have +1 attack."},
  boneyard: {tag: "Undead", text: "Location. Undead troops have +1 attack."},
});

// tag and keywords for troops, effect for spells and traps.
const OVERLAY = {
  "cowboy-sheriff": {rarity: "basic", tag: "Lawman"},
  "cowboy-billy": {rarity: "basic", tag: "Outlaw"},
  "cowboy-mounted-billy": {rarity: "rare", tag: "Outlaw", keys: ["ride"]},
  "cowboy-deadeye": {rarity: "common", effect: "shot"},
  "cowboy-captured-dragon": {rarity: "legendary", tag: "Beast", keys: ["sweep"]},
  "cowboy-captured-wraith": {rarity: "legendary", tag: "Undead", keys: ["ghostly"]},
  "cowboy-covered-wagon": {rarity: "common", tag: "Rig", keys: ["guard"]},
  "cowboy-outrider": {rarity: "common", tag: "Lawman", keys: ["ride"]},
  "cowboy-dynamiter": {rarity: "uncommon", tag: "Outlaw", keys: ["laststand"]},
  "cowboy-ranger": {rarity: "uncommon", tag: "Lawman", keys: ["scout"]},
  "cowboy-gatling-crew": {rarity: "rare", tag: "Rig", keys: ["sweep"]},
  "cowboy-lasso": {rarity: "uncommon", effect: "tie"},
  "wizard-skeleton": {rarity: "basic", tag: "Undead"},
  "wizard-wizard": {rarity: "uncommon", tag: "Mage", keys: ["raise"]},
  "wizard-dragon": {rarity: "legendary", tag: "Beast", keys: ["sweep"]},
  "wizard-singularity": {rarity: "common", effect: "shot"},
  "wizard-lantern-wraith": {rarity: "legendary", tag: "Undead", keys: ["ghostly"]},
  "wizard-imp": {rarity: "uncommon", tag: "Fiend", keys: ["quickdraw"]},
};

const troop = (side, name, rarity, stars, attack, health, tag, ...keys) => ({side, name, rarity, kind: "troop", stars, attack, health, tag, keys, fresh: true});
const other = (side, name, rarity, kind, effect) => ({side, name, rarity, kind, effect, fresh: true});
// Cards that exist only in Showdown so far.
const FRESH = {
  "cowboy-bear-trap": other("cowboy", "Bear Trap", "uncommon", "trap", "snare"),
  "cowboy-six-shooter": other("cowboy", "Six-Shooter", "uncommon", "gear", "sixshooter"),
  "cowboy-sheriffs-office": other("cowboy", "Sheriff's Office", "rare", "location", "office"),
  "wizard-bone-wall": troop("wizard", "Bone Wall", "common", 3, 0, 4, "Undead", "guard"),
  "wizard-raven-familiar": troop("wizard", "Raven Familiar", "common", 2, 1, 1, "Beast", "scout"),
  "wizard-headless-horseman": troop("wizard", "Headless Horseman", "rare", 5, 2, 3, "Undead", "ride"),
  "wizard-jack-o-lantern": troop("wizard", "Jack-o'-Lantern", "common", 1, 1, 1, "Fiend", "laststand"),
  "wizard-hellfire": other("wizard", "Hellfire", "uncommon", "spell", "hellfire"),
  "wizard-hex": other("wizard", "Hex", "uncommon", "trap", "hex"),
  "wizard-bone-armor": other("wizard", "Bone Armor", "uncommon", "gear", "bonearmor"),
  "wizard-boneyard": other("wizard", "Boneyard", "rare", "location", "boneyard"),
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

// Sixteen-card decks for the even match. Gear and locations are earned, so they are not in these.
export const DECKS = Object.freeze({
  cowboy: {"cowboy-sheriff": 4, "cowboy-outrider": 2, "cowboy-covered-wagon": 2, "cowboy-billy": 2, "cowboy-ranger": 1,
    "cowboy-dynamiter": 1, "cowboy-mounted-billy": 1, "cowboy-deadeye": 1, "cowboy-lasso": 1, "cowboy-bear-trap": 1},
  wizard: {"wizard-skeleton": 4, "wizard-jack-o-lantern": 1, "wizard-raven-familiar": 1, "wizard-imp": 1, "wizard-bone-wall": 2,
    "wizard-wizard": 2, "wizard-headless-horseman": 1, "wizard-dragon": 1, "wizard-singularity": 1, "wizard-hellfire": 1, "wizard-hex": 1},
});
export const deckIds = (side, counts = DECKS[side]) => Object.entries(counts).flatMap(([type, count]) => Array.from({length: count}, (_, i) => `${type}-${i + 1}`));
