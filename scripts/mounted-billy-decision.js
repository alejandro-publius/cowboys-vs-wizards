// The opening that leads to the Mounted Billy tribute decision. Shared by
// scripts/mounted-billy-lab.mjs (--board) and the decision pages it builds, so the
// replay and both pages reach the same board. No imports: `game` supplies the rules
// (applyAction, legalActions, publicState, cpuFor) of whichever card set is in use.
export const isBilly = (cardId) => cardId?.startsWith("cowboy-mounted-billy-") === true;

// The Cowboy's view without Mounted Billy in hand; the Wizard's view is returned as is.
export const hideBilly = (view) => view.viewer !== "cowboy" ? view :
  {...view, sides: {...view.sides, cowboy: {...view.sides.cowboy, hand: view.sides.cowboy.hand.filter((id) => !isBilly(id))}}};

// Every Mounted Billy summon the Cowboy may make right now.
export const commitsAt = (game, state) => state.activeSide !== "cowboy" ? [] :
  game.legalActions(game.publicState(state, "cowboy"), "cowboy").filter((action) => action.type === "summon" && isBilly(action.cardId));

// Bots play both sides from `start`, the Cowboy never summoning Mounted Billy, until the
// Cowboy's first turn with a legal Mounted Billy summon. Returns that state, or `start`
// unchanged when the match would end first (for example a deck without him).
export function decisionBoard(game, start, {cpu = "normal", log} = {}) {
  const choose = game.cpuFor(cpu);
  let state = start;
  while (!state.result && commitsAt(game, state).length === 0) {
    const action = choose(hideBilly(game.publicState(state, state.activeSide)));
    const applied = game.applyAction(state, action);
    if (!applied.ok) throw new Error(`opening action rejected: ${applied.reason}`);
    log?.(state, action, applied);
    state = applied.state;
  }
  return state.result ? start : state;
}
