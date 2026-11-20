// Experiment turns for review (K-095): one recorded decision from the Dragon strategy experiment
// (experiments/showdown-dragon-strategy on kiro/graywave-dragon-referee, counter checkpoint
// s3-C5-dragon-resting), opened as a normal solo Showdown duel. Not a bounty and no rule change:
// the canonical engine replays the Cowboy actions below from a fresh deal, with the unchanged bot
// playing the Wizard turns between them (showdown-session.js checks each action is legal).
// Nothing is settled or logged to the playtest report, so a saved career is never touched.
// Only an id in TURNS can be opened (?turn=<id> or the Camp control); a URL never carries actions.
import {duelFor, newSave} from "../game/showdown/progress.js";
import {deckAfter} from "../game/showdown/trail.js";

// The referee's hunt-5 save: the Trail-complete deck, the first four Dragon hunts won.
const TRAIL_DECK = deckAfter(6);
const huntSave = () => ({...newSave(), wins: 6, deck: TRAIL_DECK, hunts: {"graveyard-dragon": 4},
  collection: Object.fromEntries(Object.entries(TRAIL_DECK).filter(([type]) => !["cowboy-sheriff", "cowboy-billy"].includes(type)))});

export const TURNS = {
  "dragon-c5": {
    seed: 3,
    hunt: "hunt:graveyard-dragon",
    name: "Experiment: one Dragon turn",
    lesson: "Experiment for review, not a bounty: nothing here is saved. The Graveyard Dragon, hunt 5, your turn 5. "
      + "The Dragon rests this turn and your Bear Trap is set. Choose what your Ranger attacks, then play the duel out. "
      + "Restart this duel tries the turn again.",
    // Cowboy turns 1 and 3 as the referee's public-information policy played them, then turn 5's shared Dynamiter.
    prefix: [
      {type: "set", cardId: "cowboy-bear-trap-1"},
      {type: "summon", cardId: "cowboy-covered-wagon-2", tributes: []},
      {type: "end"},
      {type: "summon", cardId: "cowboy-ranger-1", tributes: [0]},
      {type: "attack", slot: 0, target: 0},
      {type: "end"},
      {type: "summon", cardId: "cowboy-dynamiter-1", tributes: []},
    ],
    at: 5,
  },
};

// The duel and deal for an allowlisted id, or null for anything else.
export function turnDuel(id) {
  const turn = Object.hasOwn(TURNS, id) ? TURNS[id] : null;
  if (!turn) return null;
  const hunt = duelFor(huntSave(), turn.hunt, TRAIL_DECK);
  return {seed: turn.seed, duel: {...hunt, id: `turn:${id}`, kind: "turn", name: turn.name, lesson: turn.lesson, prefix: turn.prefix, at: turn.at}};
}
