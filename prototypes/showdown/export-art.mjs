// Writes prototypes/showdown/ART-DIRECTION.md from art.js and the card table.
//   node prototypes/showdown/export-art.mjs
import {writeFileSync} from "node:fs";
import {EFFECTS, KEYWORDS, RARITY, TYPES} from "./cards.js";
import {FRAMES, FRAME_BASE, FRAMING, LOOK, PLACES, STYLE} from "./art.js";

const block = (text) => "```text\n" + text + "\n```";
const KIND = {troop: "Troop", spell: "Spell", trap: "Trap", gear: "Gear", location: "Location"};
// What the card does, in the game's own words.
const rules = (card) => (card.kind === "troop"
  ? `${card.attack} attack, ${card.health} orb${card.health === 1 ? "" : "s"}. ${card.keys.map((key) => `${KEYWORDS[key][0]}: ${KEYWORDS[key][1]}`).join(" ") || "No keyword."}`
  : EFFECTS[card.effect].text);
export const prompt = (type) => `${FRAMING[TYPES[type].kind]}\nSubject: ${LOOK[type].subject}\nScene: ${LOOK[type].scene}\nThe picture must show: ${LOOK[type].cue}`;

function cardSection(type) {
  const card = TYPES[type];
  const line = [card.side === "cowboy" ? "Cowboy" : "Wizard", card.kind === "troop" ? `Troop, ${card.tag}` : KIND[card.kind], RARITY[card.rarity][0]].join(" · ");
  return `#### ${card.name}\n\n${line}. ${rules(card)}\n\n${block(prompt(type))}\n`;
}

export function artDirection() {
  const side = (name) => Object.keys(TYPES).filter((type) => TYPES[type].side === name).map(cardSection).join("\n");
  return `# Art direction

One look for every card and place in Showdown, written so an image generator can follow it. It continues the eight card paintings and the title art already in \`assets/\`: the Cowboys own the sunset, the Wizards own the night.

This page is generated from \`art.js\`. To change a description, edit that file and run \`node prototypes/showdown/export-art.mjs\`. Nothing here has been generated as an image: these are words to use, change or throw out.

## How to use it

1. Start one new chat for the whole set. Attach two existing cards as references, one from each side: \`assets/cards/sheriff-card.webp\` and \`assets/cards/dragon-card.webp\`.
2. Paste the style block in section 1 and say it applies to every image in the chat.
3. For each card, paste its block from section 3. Ask for one image at a time.
4. Keep going in the same chat. A new chat forgets the style: paste section 1 again and re-attach the references.
5. When a picture drifts, name what drifted ("the sky should be sunset, not night") instead of starting over.
6. For a 3D model, use section 5 with the same subject text.

The pictures carry no words, numbers or borders. The game draws the frame, the name, the stars and the orbs on top, so a card's kind is always read from its frame, whatever the art shows.

## 1. The style: paste this first

${block(STYLE)}

## 2. Framing: one line per kind of picture

Each card block in section 3 already starts with the right one.

| Picture | Framing |
| --- | --- |
${Object.entries(FRAMING).map(([kind, text]) => `| ${kind === "place" ? "Place" : kind === "model" ? "3D model sheet" : KIND[kind]} | ${text} |`).join("\n")}

## 3. The cards

Each entry gives what the card does, then its visual direction as a block to paste after the style.

### Cowboys

${side("cowboy")}
### Wizards

${side("wizard")}
## 4. The places

Paste after the style. Every place is one corner of the same map: the town at one end of the street, the graveyard at the other.

${Object.entries(PLACES).map(([name, text]) => `### ${name}\n\n${block(`${FRAMING.place}\n${text}`)}\n`).join("\n")}
## 5. Model sheets for 3D

For a troop, a piece of gear or a boss that will become a 3D model, keep the card's \`Subject\` line and replace the rest of its block with this framing. A model generator needs the whole figure, a plain background and flat light.

${block(`${FRAMING.model}\nSubject: (the Subject line from the card)`)}

Subjects that are see-through or made of light on their card (the two Wraiths, the witch-fire on the Headless Horseman) should be drawn solid and pale on the model sheet. The glow and the mist are added in the game.

## 6. Card frames

The art has no border; the game draws one. Six frames from one family, so a player can tell a troop from a spell from a trap by the edge alone. These are proposals for Alex to approve. Paste the first block, then one of the others.

${block(FRAME_BASE)}

${Object.entries(FRAMES).map(([name, text]) => `**${name}**\n\n${block(text)}\n`).join("\n")}
## 7. What keeps the set together

- **Two skies.** Sunset behind Cowboys, moonlit night behind Wizards. A card in the wrong sky reads as the wrong faction.
- **One bright colour each.** Gold for gunfire and lantern light; green for witch-fire. Violet is magic for both sides.
- **The same person twice.** Billy and Mounted Billy are one young man. The Dragon and the Captured Dragon are one beast in two liveries, and so are the two Wraiths.
- **Shape says what a card does.** Guard cards are wide walls. Ride cards are forward-leaning streaks. Sweep is a fan across the whole picture. Last Stand is a burning fuse. Scout looks out or brings something back. Ghostly is see-through.
- **Kinds of picture.** Troops are portraits, spells are moments, traps are objects in wait, gear is one object, locations are places.
- **Teal is for life orbs.** The only other teal in the game is Billy's neckerchief.
`;
}

if (import.meta.main) {
  writeFileSync(new URL("ART-DIRECTION.md", import.meta.url), artDirection());
  console.log(`Wrote prototypes/showdown/ART-DIRECTION.md (${Object.keys(LOOK).length} cards, ${Object.keys(PLACES).length} places)`);
}
