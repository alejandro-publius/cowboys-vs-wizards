// Writes docs/cards.csv (one row per card) and docs/card-types.csv (one row per category),
// as spreadsheets GitHub can show.
//   node scripts/export-card-library.mjs          write the file
//   node scripts/export-card-library.mjs --check  exit 1 if the file is out of date
// Numbers, costs, copy limits, unlocks and deck counts come from the game's own data.
// Only the four text columns in TEXT are written by hand.
import {readFileSync, writeFileSync} from "node:fs";
import {CARD_SPECS} from "../src/game/card-specs.generated.js";
import {DECKS, cowboyCopyLimit, tributeCost} from "../src/game/cards.js";
import {BOSSES, HUNT_GOAL} from "../src/game/bounty-hunt.js";
import {
  BILLY_POSSE, DEADEYE_CONTROL, DRAGON_POSSE, FRONTIER_UNLOCKS, IMP_DECK, IMP_NAME,
  NIGHT_RIDERS, STARGAZER_DECK, STARGAZER_NAME, WAGON_TRAIN, WRAITH_POSSE,
} from "../src/game/deck-presets.js";
import {FRAMES, frameOf} from "../src/ui/card-frames.js";

const OUTPUT = new URL("../docs/cards.csv", import.meta.url);
const TYPES_OUTPUT = new URL("../docs/card-types.csv", import.meta.url);
const SPELL = "Remove one orb from an enemy troop.";
const RIDE = "Ride: instead of summoning, move this troop one lane into an empty lane of yours.";

// effect: the card's text. job: why you would play it. answer: how the other side deals with it.
const TEXT = {
  "cowboy-sheriff": {effect: "None.", job: "Cheap blocker that also pressures an open lane.", answer: "Out-trade it with a tribute troop, or shoot it when it is wounded."},
  "cowboy-billy": {effect: "None.", job: "Turns one troop into a sturdier lane threat.", answer: "It costs a troop, so the lane it left is open."},
  "cowboy-mounted-billy": {effect: RIDE, job: "Finisher that packs two troops into one lane and can change lanes.", answer: "It costs two troops, so two lanes are open. A Dragon out-trades it."},
  "cowboy-deadeye": {effect: SPELL, job: "Finishes a wounded blocker or softens one before a clash.", answer: "Keep blockers healthy, or replace a wounded one with a tribute troop."},
  "cowboy-captured-dragon": {effect: "None. In the Dragon Fire arc only: damage beyond its blocker's last orb hits the Wizard Base.", job: "Glass cannon. Defeats a Wizard in one clash and leaves an open Base on one orb.", answer: "Anything that hits for 2 defeats it."},
  "cowboy-captured-wraith": {effect: "None.", job: "Free troop that hits for 2, for early Base pressure.", answer: "Two orbs: a Wizard defeats it in one clash."},
  "cowboy-covered-wagon": {effect: "None.", job: "Wall. Survives a Dragon's hit on one orb.", answer: "It hits for 1. Attack the other lanes."},
  "cowboy-outrider": {effect: RIDE, job: "A Sheriff that can change lanes.", answer: "Riding spends the turn's summon and opens the lane it left."},
  "cowboy-dynamiter": {effect: "None.", job: "Burst. Takes three Base orbs through an open lane.", answer: "One orb: any blocker or spell defeats it."},
  "cowboy-ranger": {effect: RIDE, job: "A Billy that can change lanes.", answer: "It costs a tribute, and riding opens the lane it left."},
  "cowboy-gatling-crew": {effect: "None.", job: "Finisher. Defeats any blocker except the Dragon in one clash.", answer: "It costs two troops. A Dragon survives it; a fresh Skeleton each round stalls it."},
  "cowboy-lasso": {effect: `${SPELL} If it survives, you may drag it one lane into an empty lane.`, job: "Opens a lane for your attacker, or drags an attacker in front of your wall.", answer: "Keep neighbouring lanes filled. A one-orb troop is defeated, not dragged."},
  "wizard-skeleton": {effect: "None.", job: "The Wizards' cheap blocker and opening threat.", answer: "Block it, or race it through another lane."},
  "wizard-wizard": {effect: "None.", job: "Sturdier troop, usually replacing a wounded Skeleton.", answer: "Billy trades evenly with it. Gatling Crew defeats it in one clash."},
  "wizard-dragon": {effect: "None. In the Dragon Fire arc only: damage beyond its blocker's last orb hits your Base.", job: "The Wizards' finisher, and the Graveyard Dragon bounty.", answer: "Soften it with Deadeye, then strike. A Covered Wagon survives one hit."},
  "wizard-singularity": {effect: `${SPELL} If it survives, the Wizards may move it one lane into an empty lane.`, job: "Removes a weak troop or pulls a blocker out of its lane.", answer: "Keep neighbouring lanes filled, and do not lean on one-orb troops."},
  "wizard-lantern-wraith": {effect: "Before the first clash it drifts into the marked Wizard lane, unless that lane is taken.", job: "Bounty boss. It goes for the lane you left open.", answer: "Stand where it is going, or fill the marked lane so it cannot move."},
  "wizard-imp": {effect: "None.", job: "Burst. Punishes an open lane for three Base orbs.", answer: "Any blocker defeats it. A Covered Wagon survives it."},
};

const typeOf = (cardId) => cardId.replace(/-\d+$/, "");
const countIds = (ids) => ids.reduce((counts, id) => ({...counts, [typeOf(id)]: (counts[typeOf(id)] ?? 0) + 1}), {});
// Every ready-made deck as [name, {type: copies}].
const LISTS = [
  ["Starter", countIds(DECKS.cowboy)],
  [DEADEYE_CONTROL.name, DEADEYE_CONTROL.counts],
  [BILLY_POSSE.name, BILLY_POSSE.counts],
  ["Wraith Posse", WRAITH_POSSE],
  ["Dragon Posse", DRAGON_POSSE],
  [WAGON_TRAIN.name, WAGON_TRAIN.counts],
  [NIGHT_RIDERS.name, NIGHT_RIDERS.counts],
  ["Wizard default", countIds(DECKS.wizard)],
  [STARGAZER_NAME, countIds(STARGAZER_DECK)],
  [IMP_NAME, countIds(IMP_DECK)],
];

function howToGet(spec) {
  if (spec.side === "wizard") return spec.bounty ? "Wanted boss: appears only in its hunts." : "Played by the Wizard opponent.";
  const boss = BOSSES.find((each) => each.reward === spec.type);
  if (boss) return `Clear all ${HUNT_GOAL} ${boss.name} hunts.`;
  const unlock = FRONTIER_UNLOCKS.find((each) => each.type === spec.type);
  return unlock ? `Win ${unlock.wins} counted duels.` : "In your collection from the start.";
}

// The card's category decides its frame (docs/card-types.csv). A bounty card is a Boss:
// Wanted while you hunt it, Captured once it is yours.
const category = (spec) => FRAMES[frameOf(spec)].category;

// What each category is, its deck rule, its border and its state. The mark and type line come from FRAMES.
const TYPE_TEXT = {
  troop: ["A fighter that stays on the board until it is defeated.", "Up to the card's copy limit.", "Single solid border in the faction's colour.", "In the game"],
  spell: ["A one-time effect that goes to the graveyard after it resolves.", "Up to the card's copy limit.", "Double border.", "In the game"],
  trap: ["A card set face down that answers the other side's move.", "Not deck-eligible yet.", "Dashed border.", "Prototype only"],
  wanted: ["A unique enemy you hunt on the Wanted board.", "Cannot be added to a deck.", "Thick border with a WANTED banner across the top.", "In the game"],
  captured: ["The boss's own card, earned by clearing its bounty five times.", "One copy per deck.", "The same thick border, with the banner reading CAPTURED.", "In the game"],
};
const TYPES_HEADER = ["Category", "What it is", "Deck rule", "Frame", "Corner mark", "Type line", "State"];
export const cardTypeRows = () => Object.entries(FRAMES).map(([id, frame]) => {
  const [what, deckRule, border, state] = TYPE_TEXT[id];
  return [frame.category, what, deckRule, border, frame.mark, frame.line, state];
});

const HEADER = ["Card", "Faction", "Category", "Plays as", "Stars", "Tributes to summon", "Attack", "Orbs", "Effect", "Copy limit per deck", "How you get it", "Decks it is in", "Job", "How to answer it"];

export function cardRows() {
  return CARD_SPECS.map((spec) => {
    const text = TEXT[spec.type];
    if (!text) throw new Error(`scripts/export-card-library.mjs has no text for ${spec.type}`);
    const troop = spec.kind === "troop";
    const decks = LISTS.filter(([, counts]) => counts[spec.type] > 0).map(([name, counts]) => `${name} x${counts[spec.type]}`);
    return [
      spec.name, spec.side === "cowboy" ? "Cowboy" : "Wizard", category(spec), troop ? "Troop" : "Spell",
      troop ? spec.stars : "", troop ? tributeCost(spec.stars) : "", troop ? spec.attack : "", troop ? spec.health : "",
      text.effect, spec.side === "cowboy" ? cowboyCopyLimit(spec) : "", howToGet(spec),
      decks.join("; ") || "None", text.job, text.answer,
    ];
  });
}

const cell = (value) => (/[",\n]/.test(String(value)) ? `"${String(value).replaceAll('"', '""')}"` : String(value));
const toCsv = (rows) => rows.map((row) => row.map(cell).join(",")).join("\n") + "\n";
export const cardLibraryCsv = () => toCsv([HEADER, ...cardRows()]);
export const cardTypesCsv = () => toCsv([TYPES_HEADER, ...cardTypeRows()]);

if (import.meta.main) {
  const files = [[OUTPUT, cardLibraryCsv(), "docs/cards.csv"], [TYPES_OUTPUT, cardTypesCsv(), "docs/card-types.csv"]];
  if (process.argv.includes("--check")) {
    const stale = files.filter(([url, csv]) => readFileSync(url, "utf8") !== csv).map(([, , name]) => name);
    if (stale.length) {
      console.error(`${stale.join(" and ")} out of date. Run: node scripts/export-card-library.mjs`);
      process.exit(1);
    }
    console.log("docs/cards.csv and docs/card-types.csv are current");
  } else {
    for (const [url, csv] of files) writeFileSync(url, csv);
    console.log(`Wrote docs/cards.csv (${CARD_SPECS.length} cards) and docs/card-types.csv`);
  }
}
