// Replay the scripted opening with the Normal Wizard bot before handing over to the player.
import {applyAction} from "../game/actions.js";
import {CARDS} from "../game/cards.js";
import {chooseAction} from "../game/cpu.js";
import {deckIds} from "../game/deck-builder.js";
import {IMP_DECK, NIGHT_RIDERS, STARGAZER_DECK, WAGON_TRAIN} from "../game/deck-presets.js";
import {legalActions} from "../game/legal.js";
import {createMatch} from "../game/state.js";
import {publicState} from "../game/view.js";

export const PRACTICE_NO_REWARD_NOTE = "Practice earns no wins or rewards.";

// Script steps: ["summon", name, lane], ["cast", name, wizardLane], ["end"]. Lanes count from 1.
export const PRACTICE_CHALLENGES = Object.freeze({
  dynamiter: Object.freeze({
    id: "dynamiter",
    title: "Practice: time the Dynamiter",
    summary: "Night Riders against the Stargazer. Lead with the Dynamiter or an Outrider.",
    seed: 4,
    preset: NIGHT_RIDERS,
    wizardDeck: STARGAZER_DECK,
    script: Object.freeze([]),
    round: 1,
    note: "Practice: Night Riders against the Stargazer. You act first this round, so the Wizard answers before the clash. Lead with the Dynamiter or with an Outrider.",
  }),
  tribute: Object.freeze({
    id: "tribute",
    title: "Practice: time the tribute",
    summary: "Wagon Train against the Imp, from round 4. Block the Imp or cash in the tribute now.",
    seed: 4671,
    preset: WAGON_TRAIN,
    wizardDeck: IMP_DECK,
    script: Object.freeze([
      ["summon", "Sheriff", 1], ["end"],
      ["summon", "Covered Wagon", 2], ["end"],
      ["summon", "Sheriff", 1], ["cast", "Deadeye", 1], ["end"],
    ]),
    round: 4,
    note: "Practice: Wagon Train against the Imp. Rounds one to three were played for you. Block the Imp, or tribute the Sheriff and the Wagon for the Gatling Crew.",
  }),
});

export function createPractice(id) {
  const challenge = PRACTICE_CHALLENGES[id];
  if (!Object.hasOwn(PRACTICE_CHALLENGES, id)) throw new Error(`Unknown practice challenge: ${id}`);
  // Practice lends the preset at any progression level.
  const cowboyDeck = deckIds(challenge.preset.counts, {bountyReward: true});
  let state = createMatch(challenge.seed, {cowboyDeck, wizardDeck: [...challenge.wizardDeck]});
  const play = (action, what) => {
    if (!action) throw new Error(`Practice setup could not find: ${what}`);
    const next = applyAction(state, action);
    if (!next.ok) throw new Error(`Practice setup refused ${what}: ${next.reason}`);
    state = next.state;
  };
  // The Normal bot answers whenever it is the Wizard's phase, including a round it opens.
  const wizardTurns = () => {
    while (!state.result && state.activeSide === "wizard") {
      play(chooseAction(publicState(state, "wizard")), "a Wizard reply");
    }
  };
  for (const [kind, name, lane] of challenge.script) {
    wizardTurns();
    const actions = legalActions(state, "cowboy");
    if (kind === "end") play(actions.find((action) => action.type === "end-phase"), "End turn");
    else if (kind === "summon") {
      play(actions.find((action) => action.type === "summon" && action.slot === lane - 1 && action.tributes.length === 0
        && CARDS[action.cardId].name === name), `${name} in lane ${lane}`);
    } else {
      play(actions.find((action) => action.type === "spell" && action.target === lane - 1 && action.destination === undefined
        && CARDS[action.cardId].name === name), `${name} on Wizard lane ${lane}`);
    }
  }
  wizardTurns();
  if (state.result || state.activeSide !== "cowboy" || state.round !== challenge.round) {
    throw new Error(`Practice ${id} did not reach the Cowboy's turn in round ${challenge.round}.`);
  }
  return state;
}
