import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction } from '../src/game/actions.js';
import { legalActions } from '../src/game/legal.js';
import { createBounty } from './bounty.js';

function endings(state, moves = []) {
  return legalActions(state, 'cowboy').flatMap(action => {
    const applied = applyAction(state, action);
    assert.equal(applied.ok, true);
    const line = [...moves, action];
    if (action.type === 'end-phase') {
      assert.ok(applied.state.result, 'The bounty must finish after one clash.');
      return [{ line, winner: applied.state.result.winner }];
    }
    return endings(applied.state, line);
  });
}

test('Save the Saloon is solvable and both tribute and Deadeye matter', () => {
  const outcomes = endings(createBounty());
  assert.equal(outcomes.find(({line}) => line.length === 1).winner, 'wizard');
  const wins = outcomes.filter(({winner}) => winner === 'cowboy');
  assert.ok(wins.length > 0, 'There must be a winning line.');
  for (const {line} of wins) {
    assert.deepEqual(line.map(action => action.type), ['summon', 'spell', 'end-phase']);
    assert.equal(line[0].tributes.length, 1);
    assert.equal(line[0].slot, 1);
    assert.equal(line[1].target, 0);
  }
});
