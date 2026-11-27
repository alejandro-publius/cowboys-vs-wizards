import {DECKS, EFFECTS, TYPES} from "../game/showdown/cards.js";
import {opponent} from "../game/showdown/rules.js";

// The CPU recruits an Imp or a Dynamiter on turn one. The player gets the first attack.
const TABLES = {
  cowboy: {seed: 18, basic: "cowboy-sheriff", ally: "cowboy-outrider", enemy: "wizard-wizard"},
  wizard: {seed: 11, basic: "wizard-skeleton", ally: "wizard-wizard", enemy: "cowboy-billy"},
};

export function bookPractice(id) {
  if (typeof id !== "string" || !Object.hasOwn(TYPES, id)) return null;
  const card = TYPES[id];
  const seat = card.side;
  const foe = opponent(seat);
  const {seed, basic, ally, enemy} = TABLES[seat];
  const lead = card.kind === "troop" ? id : basic;

  // Both seeds put a copy of the deck's first entry in the player's hand.
  // A card outside the starter deck takes the place of one basic troop.
  const deck = {[id]: 1, ...DECKS[seat]};
  if (!DECKS[seat][id]) deck[basic]--;
  const options = {
    first: foe,
    decks: {...DECKS, [seat]: deck},
    opening: {[seat]: [{type: lead}, {type: lead === basic ? ally : basic}], [foe]: [{type: enemy}]},
  };
  let lesson = `Choose ${card.name} on the board, then choose an attack target.`;
  if (card.kind === "trap") lesson = `Set ${card.name} from your hand. End your turn to let the enemy attack.`;
  else if (card.kind !== "troop") lesson = `Play ${card.name} from your hand. ${EFFECTS[card.effect].text}`;
  else if (card.attack === 0) lesson = `Choose ${card.name} and take cover to protect your Base. Then end your turn.`;
  // Practice turns skip settlement and playtest logging. The level-1 CPU is outside Wizard lesson review.
  return {duel: {id: `book:${id}`, kind: "turn", level: 1, name: `Practice · ${card.name}`,
    lesson, options}, seed, seat};
}
