// Writes prototypes/showdown/cards.csv, a spreadsheet of every Showdown card that GitHub can show.
//   node prototypes/showdown/export-cards.mjs
import {writeFileSync} from "node:fs";
import {DECKS, EFFECTS, KEYWORDS, RARITY, TYPES, tributes} from "./cards.js";

const HEADER = ["Card", "Faction", "Kind", "Type", "Rarity", "Copies per deck", "Stars", "Tributes to summon", "Attack", "Orbs", "Keywords", "What it does", "Copies in the even-match deck", "New in Showdown"];
const cell = (value) => (/[",\n]/.test(String(value)) ? `"${String(value).replaceAll('"', '""')}"` : String(value));
export function cardsCsv() {
  const rows = Object.entries(TYPES).map(([type, card]) => {
    const troop = card.kind === "troop";
    const text = troop ? card.keys.map((key) => `${KEYWORDS[key][0]}: ${KEYWORDS[key][1]}`).join(" ") || "No keyword." : EFFECTS[card.effect].text;
    return [card.name, card.side === "cowboy" ? "Cowboy" : "Wizard", card.kind[0].toUpperCase() + card.kind.slice(1), troop ? card.tag : "",
      RARITY[card.rarity][0], Number.isFinite(RARITY[card.rarity][1]) ? RARITY[card.rarity][1] : "Any number",
      troop ? card.stars : "", troop ? tributes(`${type}-1`) : "", troop ? card.attack : "", troop ? card.health : "",
      troop ? card.keys.map((key) => KEYWORDS[key][0]).join(", ") : "", text, DECKS[card.side][type] ?? 0, card.fresh ? "Yes" : "No"];
  });
  return [HEADER, ...rows].map((row) => row.map(cell).join(",")).join("\n") + "\n";
}
if (import.meta.main) {
  writeFileSync(new URL("cards.csv", import.meta.url), cardsCsv());
  console.log(`Wrote prototypes/showdown/cards.csv (${Object.keys(TYPES).length} cards)`);
}
