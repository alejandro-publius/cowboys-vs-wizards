// Fable's even-fight brief (November 20, 2026), changes 1 and 2, against the canonical setup:
// the even match, best of three and two players start the side going second on 7 Base orbs;
// the Trail, rivals and bounties start exactly as they did on main 755df56.
import test from "node:test";
import assert from "node:assert/strict";
import {createShowdown} from "../../src/game/showdown/rules.js";
import {BOUNTIES, HUNTS, RIVALS, duelFor} from "../../src/game/showdown/progress.js";
import {TRAIL} from "../../src/game/showdown/trail.js";
import {twoPlayers} from "../../src/match/showdown-session.js";
import {newMatch, recordGame} from "../../src/match/showdown-match.js";
import {saveAt} from "./trail-sim.mjs";

const SEEDS = [0, 1, 2, 3, 17, 690];
// [first, cowboy base, cowboy baseMax, wizard base, wizard baseMax] for each duel, read from
// createShowdown on main 755df56 (src/game/showdown unchanged there since this branch's base).
// The Imp rival sets no first side, so who opens follows the seed; its Bases do not.
const ON_755DF56 = {
  "boot-hill": [5, 5, 3, 3], "raven-roost": [5, 5, 4, 4], "bone-fence": [5, 5, 4, 4], "imp-hollow": [5, 5, 4, 4], "hexed-mile": [5, 5, 4, 4], "dragons-roost": [5, 5, 4, 4],
  stargazer: [5, 5, 5, 5], imp: [5, 5, 5, 5], bonewright: [5, 5, 4, 4], coven: [5, 5, 4, 4],
  "lantern-wraith": [5, 5, 4, 4], "graveyard-dragon": [5, 5, 4, 4],
};
const bases = (state) => [state.sides.cowboy.base, state.sides.cowboy.baseMax, state.sides.wizard.base, state.sides.wizard.baseMax];

test("Trail, rival and bounty duels start with the Base orbs they had on 755df56", () => {
  TRAIL.forEach((duel, wins) => {
    for (const seed of SEEDS) {
      const state = createShowdown(seed, duelFor(saveAt({wins}), "trail").options);
      assert.deepEqual(bases(state), ON_755DF56[duel.id], `${duel.name}, seed ${seed}`);
      assert.equal(state.first, "cowboy");
      // A lost duel still adds its grit orbs to the Cowboy Base only.
      const grit = createShowdown(seed, duelFor(saveAt({wins, losses: {trail: 2}}), "trail").options);
      assert.deepEqual(bases(grit), [7, 7, ...ON_755DF56[duel.id].slice(2)], `${duel.name} with grit, seed ${seed}`);
    }
  });
  RIVALS.forEach((rival, i) => {
    for (const seed of SEEDS) {
      const state = createShowdown(seed, duelFor(saveAt({rivals: i}), `rival:${rival.id}`).options);
      assert.deepEqual(bases(state), ON_755DF56[rival.id], `${rival.name}, seed ${seed}`);
    }
  });
  for (const bounty of BOUNTIES) {
    for (let n = 0; n < HUNTS; n++) {
      for (const seed of SEEDS) {
        const state = createShowdown(seed, duelFor(saveAt({hunts: {[bounty.id]: n}}), `hunt:${bounty.id}`).options);
        assert.deepEqual(bases(state), ON_755DF56[bounty.id], `${bounty.name}, hunt ${n + 1}, seed ${seed}`);
      }
    }
  }
});

// The even-match deck change is not a Trail or rival change: Dragon's Roost and the Graveyard
// Coven used to be built from the even-match Wizard deck, so they are now spelled out.
test("Dragon's Roost and the Graveyard Coven keep the Wizard decks they had on 755df56", () => {
  assert.deepEqual(TRAIL.find((duel) => duel.id === "dragons-roost").deck, {"wizard-skeleton": 4, "wizard-jack-o-lantern": 1, "wizard-raven-familiar": 1, "wizard-imp": 1,
    "wizard-bone-wall": 2, "wizard-wizard": 2, "wizard-headless-horseman": 1, "wizard-dragon": 1, "wizard-singularity": 1, "wizard-hellfire": 1, "wizard-hex": 1});
  assert.deepEqual(RIVALS.find((rival) => rival.id === "coven").deck, {"wizard-skeleton": 3, "wizard-jack-o-lantern": 1, "wizard-raven-familiar": 1, "wizard-imp": 1,
    "wizard-bone-wall": 2, "wizard-wizard": 2, "wizard-headless-horseman": 1, "wizard-dragon": 1, "wizard-singularity": 1, "wizard-hellfire": 1, "wizard-hex": 1, "wizard-boneyard": 1});
});

const secondOnSeven = (state, label) => {
  const second = state.first === "cowboy" ? "wizard" : "cowboy";
  assert.deepEqual([state.sides[state.first].base, state.sides[state.first].baseMax], [5, 5], label);
  assert.deepEqual([state.sides[second].base, state.sides[second].baseMax], [7, 7], label);
  assert.equal(state.sides[second].hand.length, state.sides[state.first].hand.length + 1, `${label}: the side going second keeps its extra card`);
};

test("the even match (Open range), two players and every best-of-three game start the side going second on 7 Base orbs", () => {
  const open = duelFor(saveAt(), "open");
  assert.equal(open.options.baseOrbs, undefined, "Open range leaves the Base orbs to the even-match rule");
  for (const seed of SEEDS) {
    secondOnSeven(createShowdown(seed, open.options), `Open range, seed ${seed}`);
    secondOnSeven(createShowdown(seed, twoPlayers().options), `two players, seed ${seed}`);
  }
  // Best of three: the loser of a game opens the next one, and the 7 orbs follow the side going second.
  let match = newMatch();
  for (const [winner, seed] of [["cowboy", 4], ["wizard", 5]]) {
    const state = createShowdown(seed, {...open.options, ...(match.first ? {first: match.first} : {})});
    secondOnSeven(state, `best of three game ${match.game}`);
    match = recordGame(match, {winner, first: state.first});
    const next = createShowdown(seed + 1, {...twoPlayers().options, first: match.first});
    assert.equal(next.first, winner === "cowboy" ? "wizard" : "cowboy");
    secondOnSeven(next, `two-player best of three after a ${winner} win`);
  }
});
