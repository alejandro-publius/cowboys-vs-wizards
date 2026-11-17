// Prints the exact tables and the seeded cross-check for issue #87.
// Usage: node experiments/trap-deck-odds/run.mjs [sampleCount=10000]
import { SIDES } from "../../src/game/cards.js";
import { RULES_VERSION } from "../../src/game/state.js";
import { MAX_ROUNDS, SCENARIOS, report, show, toNumber } from "./odds.js";
import { sample } from "./sample.js";

const count = Number(process.argv[2] ?? 10000);
console.log(`rules ${RULES_VERSION}; deck 12; opener 4; 1 draw per later round; exact hypergeometric`);
console.log("All values assume the match reaches the named round. Same numbers for Cowboys and Wizards (both 6/3/1/2).\n");

for (const [key, s] of Object.entries(SCENARIOS)) {
  const r = report(s);
  console.log(`## ${key}: ${s.label} (free ${s.free}, mid ${s.mid}, legendary ${s.legendary}, spell ${s.spell}, trap ${s.trap})`);
  for (const round of [1, 2, 4, 6, 8, 9]) {
    console.log(`  by round ${round}: trap ${show(r.trapBy[round])} | spell ${show(r.spellBy[round])} | spell-or-trap ${show(r.tacticalBy[round])} | spell AND trap ${show(r.bothBy[round])}`);
  }
  if (s.trap) {
    console.log(`  first trap round: ${Array.from({ length: MAX_ROUNDS }, (_, i) => `${i + 1}:${show(r.firstRound[i + 1])}`).join("  ")}`);
    console.log(`  first trap in round 9 (set rejected, dead): ${show(r.tooLate)}; given none by round 6: ${show(r.tooLateGivenNoneBy6)}`);
    console.log(`  first trap in round 8 (arms only for the round 9 clash): ${show(r.onlyLastClash)}`);
  }
  console.log(`  opener with no free troop: ${show(r.noFreeOpener)}\n`);
}

console.log(`## Seeded cross-check: real createMatch shuffle, seeds 0-${count - 1} (sample, not exact)`);
for (const [key, copies] of [["T1", 1], ["T2", 2]]) {
  const exact = report(SCENARIOS[key]).firstRound;
  const hist = sample(copies, 0, count);
  for (const side of SIDES) {
    const cells = Array.from({ length: MAX_ROUNDS }, (_, i) => {
      const k = i + 1;
      return `${k}:${(100 * hist[side][k] / count).toFixed(2)}% (exact ${(100 * toNumber(exact[k])).toFixed(2)}%)`;
    });
    console.log(`  ${key} ${side}: ${cells.join("  ")}`);
  }
}
