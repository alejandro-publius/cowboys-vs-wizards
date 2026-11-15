import { applyAction } from '../src/game/actions.js';
import { chooseAction } from '../src/game/cpu.js';
import { createMatch, RULES_VERSION } from '../src/game/state.js';
import { publicState } from '../src/game/view.js';

export const BOUNTY_SEED = 554;
const BOUNTY_REVISION = 37;

// A real position from the current rules and CPU. Replaying the opening keeps
// decks, discards, turn allowances and damaged troops consistent with a duel.
export function createBounty() {
  if (RULES_VERSION !== 'orb-duel-draft-1') throw new Error('The bounty needs to be revalidated on these rules.');
  let state = createMatch(BOUNTY_SEED);
  while (state.revision < BOUNTY_REVISION && !state.result) {
    const action = chooseAction(publicState(state, state.activeSide));
    const applied = applyAction(state, action);
    if (!applied.ok) throw new Error(`The bounty replay diverged at revision ${state.revision}.`);
    state = applied.state;
  }
  if (state.round !== 9 || state.activeSide !== 'cowboy' || state.startingSide !== 'wizard' ||
      state.sides.cowboy.baseOrbs !== 2 || state.sides.wizard.baseOrbs !== 2) {
    throw new Error('The bounty position changed. Revalidate the replay.');
  }
  return state;
}
