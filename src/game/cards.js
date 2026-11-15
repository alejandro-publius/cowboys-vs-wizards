// Card data from docs/kiro-task-01.md. Spells carry no stats here: their
// effects belong to a later job, and they can never be summoned.
export const SIDES = ["cowboy", "wizard"];

const DECK_LISTS = {
  cowboy: [
    { name: "Sheriff", kind: "troop", stars: 2, health: 3, attack: 1, copies: 6 },
    { name: "Billy", kind: "troop", stars: 5, health: 4, attack: 2, copies: 3 },
    { name: "Mounted Billy", kind: "troop", stars: 7, health: 5, attack: 3, copies: 1 },
    { name: "Deadeye", kind: "spell", copies: 2 },
  ],
  wizard: [
    { name: "Skeleton", kind: "troop", stars: 1, health: 3, attack: 1, copies: 6 },
    { name: "Wizard", kind: "troop", stars: 5, health: 4, attack: 2, copies: 3 },
    { name: "Dragon", kind: "troop", stars: 8, health: 5, attack: 3, copies: 1 },
    { name: "Singularity", kind: "spell", copies: 2 },
  ],
};

// Every card instance that exists in a match, keyed by its unique ID
// (for example "cowboy-mounted-billy-1"). State holds IDs only, so no
// instance can be created or altered mid-match.
export const CARDS = {};
// Unshuffled 12-card deck of IDs per side.
export const DECKS = {};

for (const side of SIDES) {
  DECKS[side] = [];
  for (const { copies, ...card } of DECK_LISTS[side]) {
    for (let copy = 1; copy <= copies; copy++) {
      const id = `${side}-${card.name.toLowerCase().replaceAll(" ", "-")}-${copy}`;
      CARDS[id] = Object.freeze({ id, side, ...card });
      DECKS[side].push(id);
    }
  }
  Object.freeze(DECKS[side]);
}
Object.freeze(CARDS);
Object.freeze(DECKS);

// Friendly troops a summon must sacrifice: 1-4 stars none, 5-6 one, 7+ two.
export function tributeCost(stars) {
  return stars >= 7 ? 2 : stars >= 5 ? 1 : 0;
}
