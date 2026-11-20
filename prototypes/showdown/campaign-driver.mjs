// Node mirror and move picker for campaign-browser-check.mjs. Pure: imports the page's own rules.js
// and progress.js and nothing else. Developer tool; no product code is changed.
//
// mirrorDuel() replays what main.js deal()/advance() do for one solo Camp duel. pickMove() chooses the
// Cowboy's next action from a public projection of the state: what the Cowboy player can see on the
// page (own hand, both boards, Bases, counts, graveyards, the number of face-down Wizard cards).
// Hidden facts are removed before planning: the Wizard's face-down traps, which Wizard cards are in
// hand rather than deck, and the order of both decks.
import {applyAction, createShowdown, legalActions, planTurn, playTurn} from "./rules.js";
import {duelFor} from "./progress.js";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// The Cowboy's view. The Wizard hand and deck are pooled and sorted, then split back by count, so
// the plan cannot depend on which hidden card is where. Both decks lose their order.
export function publicView(state) {
  const view = structuredClone(state);
  const wizard = view.sides.wizard;
  const pooled = [...wizard.hand, ...wizard.deck].sort();
  wizard.hand = pooled.slice(0, wizard.hand.length);
  wizard.deck = pooled.slice(wizard.hand.length);
  wizard.traps = [];
  view.sides.cowboy.deck.sort();
  return view;
}

// The first step of rules.js planTurn on the public view. It must also be legal on the real state.
export function pickMove(state) {
  if (state.active !== "cowboy" || state.result) throw new Error("not the Cowboy's turn");
  const action = planTurn(publicView(state))[0];
  if (!legalActions(state).some((legal) => same(legal, action))) throw new Error(`projection chose an action the real state rejects: ${JSON.stringify(action)}`);
  return action;
}

// One solo duel as main.js plays it: createShowdown with duelFor options, then whole Wizard turns at duel.level.
export function mirrorDuel(save, id, seed) {
  const duel = duelFor(save, id);
  if (!duel) throw new Error(`${id} is not playable for this save`);
  let state = createShowdown(seed, duel.options);
  const wizards = () => { while (!state.result && state.active === "wizard") state = playTurn(state, duel.level).state; };
  wizards();
  return {duel, get state() { return state; }, act(action) { state = applyAction(state, action).state; wizards(); }};
}

// Plays a mirror duel to its end with pickMove; for choosing seeds in Node before a browser run.
export function playMirror(save, id, seed, cap = 400) {
  const mirror = mirrorDuel(save, id, seed);
  let steps = 0;
  while (!mirror.state.result && steps++ < cap) mirror.act(pickMove(mirror.state));
  return {winner: mirror.state.result?.winner ?? null, steps, turns: mirror.state.turn};
}
