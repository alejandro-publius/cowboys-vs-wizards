import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const stem = '../../proof/referee/receipts/first-run-6e2f2f904791e114e177577277ca4efee52a59b2d9b1e23d751daba2fa16fcd6';
const receiptUrl = new URL(`${stem}.json`, import.meta.url);
const mismatchesUrl = new URL(`${stem}.mismatches.jsonl`, import.meta.url);

// Empty-board Hellfire semantics are awaiting design approval; this characterizes the frozen receipt, not parity.
test('characterizes frozen first-run receipt: all 45 divergent duels open with Wizard Hellfire into an empty Cowboy board', () => {
  const receipt = JSON.parse(fs.readFileSync(receiptUrl, 'utf8'));
  const jsonlBytes = fs.readFileSync(mismatchesUrl);
  const actualSha256 = crypto.createHash('sha256').update(jsonlBytes).digest('hex');
  assert.equal(actualSha256, receipt.mismatches.sha256, 'mismatches JSONL sha256 must match frozen receipt');

  const lines = jsonlBytes.toString('utf8').split('\n').filter((line) => line.trim().length > 0);
  assert.equal(lines.length, 45);

  const seeds = new Set();
  for (const line of lines) {
    const duel = JSON.parse(line);
    seeds.add(duel.seed);
    assert.ok(Array.isArray(duel.mismatches) && duel.mismatches.length > 0, `seed ${duel.seed}: expected mismatches`);

    const first = duel.mismatches[0];
    assert.equal(first.kind, 'rejected-by-engine', `seed ${duel.seed}: unexpected mismatch kind`);
    assert.equal(first.action.type, 'spell', `seed ${duel.seed}: unexpected action type`);
    assert.match(first.action.cardId, /^wizard-hellfire-\d+$/, `seed ${duel.seed}: unexpected cardId`);
    assert.equal(first.engine.accepted, false, `seed ${duel.seed}: engine.accepted changed`);
    assert.equal(first.referee.accepted, true, `seed ${duel.seed}: referee.accepted changed`);
    assert.equal(first.engine.state.active, 'wizard', `seed ${duel.seed}: unexpected active side`);
    assert.ok(
      first.engine.state.players.cowboy.troops.every((slot) => slot === null),
      `seed ${duel.seed}: expected empty Cowboy troop slots`
    );
  }

  assert.equal(seeds.size, 45, 'expected 45 distinct duel seeds');
  assert.ok(seeds.has(109), 'expected seed 109 in frozen divergent set');
});
