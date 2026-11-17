// Exact draw odds for anonymous trap copies in a 12-card Orb Duel deck (issue #87).
// Pure maths, no dependency. Fractions are BigInt pairs so results are exact.
// Draw model (src/game/state.js, src/game/actions.js): 4 cards dealt in round 1,
// then one card at the start of each later round while the deck lasts.
// Every probability assumes the match is still running at that draw.

export const DECK_SIZE = 12;
export const OPENING_HAND = 4;
export const MAX_ROUNDS = 9;

// Cards a side has seen once round r has started (its draw for r included).
export const seenByRound = (round) => Math.min(DECK_SIZE, OPENING_HAND + round - 1);
// Round in which deck position p (1 = top of the shuffled 12) reaches the hand.
export const roundOfPosition = (p) => (p <= OPENING_HAND ? 1 : p - OPENING_HAND + 1);

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a < 0n ? -a : a;
}
export function frac(n, d) {
  const g = gcd(BigInt(n), BigInt(d)) || 1n;
  return { n: BigInt(n) / g, d: BigInt(d) / g };
}
export const toNumber = ({ n, d }) => Number(n) / Number(d);
export const show = (f) => `${f.n}/${f.d} = ${(100 * toNumber(f)).toFixed(2)}%`;

export function choose(n, k) {
  if (k < 0 || k > n) return 0n;
  let r = 1n;
  for (let i = 1; i <= k; i++) r = (r * BigInt(n - k + i)) / BigInt(i);
  return r;
}

// P(at least one of K marked cards among the first n of an N-card shuffle).
export function atLeastOne(N, K, n) {
  return frac(choose(N, n) - choose(N - K, n), choose(N, n));
}
// P(none of K marked cards among the first n).
export const noneIn = (N, K, n) => frac(choose(N - K, n), choose(N, n));

// P(all of K marked cards among the first n).
export const allIn = (N, K, n) => frac(choose(N - K, n - K), choose(N, n));

// P(first marked card is at position p): the p-1 cards before it are unmarked.
export function firstAt(N, K, p) {
  if (K === 0) return frac(0, 1);
  return frac(choose(N - p, K - 1), choose(N, K));
}

// P(first marked card reaches the hand in round r). Round 1 groups positions 1-4.
export function firstInRound(N, K, round) {
  const hi = seenByRound(round);
  const lo = round === 1 ? 0 : seenByRound(round - 1);
  if (hi === lo) return frac(0, 1);
  return frac(choose(N - lo, K) - choose(N - hi, K), choose(N, K));
}

// P(A | B) for exact fractions.
export const divide = (a, b) => frac(a.n * b.d, a.d * b.n);

// Deck compositions. "tactical" = spell or trap, the cards that share the cast
// allowance under A + X. Troop counts never change in T1/T2.
export const SCENARIOS = {
  baseline: { label: "Shipped (no trap)", free: 6, mid: 3, legendary: 1, spell: 2, trap: 0 },
  T1: { label: "1 trap replaces 1 spell", free: 6, mid: 3, legendary: 1, spell: 1, trap: 1 },
  T2: { label: "2 traps replace 2 spells", free: 6, mid: 3, legendary: 1, spell: 0, trap: 2 },
  // Text-only, analytic: risk to the free opener. Not proposed for a first test.
  TF: { label: "TEXT-ONLY: 1 trap replaces 1 free troop", free: 5, mid: 3, legendary: 1, spell: 2, trap: 1 },
};
export const total = (s) => s.free + s.mid + s.legendary + s.spell + s.trap;

// Exact report for one composition. Both factions use 6/3/1/2 shipped decks,
// so a composition gives the same numbers for Cowboys and Wizards.
export function report(s) {
  const N = total(s);
  if (N !== DECK_SIZE) throw new RangeError(`deck must have ${DECK_SIZE} cards, got ${N}`);
  const rounds = [1, 2, 4, 6, 8, 9];
  const trapBy = Object.fromEntries(rounds.map((r) => [r, atLeastOne(N, s.trap, seenByRound(r))]));
  const spellBy = Object.fromEntries(rounds.map((r) => [r, atLeastOne(N, s.spell, seenByRound(r))]));
  const tacticalBy = Object.fromEntries(rounds.map((r) => [r, atLeastOne(N, s.spell + s.trap, seenByRound(r))]));
  // Both a spell and a trap drawn by round r: necessary for A's spell-or-trap choice to bind.
  const bothBy = Object.fromEntries(rounds.map((r) => {
    const n = seenByRound(r);
    if (!s.spell || !s.trap) return [r, frac(0, 1)];
    // 1 - P(no spell) - P(no trap) + P(neither)
    const d = choose(N, n);
    const num = d - choose(N - s.spell, n) - choose(N - s.trap, n) + choose(N - s.spell - s.trap, n);
    return [r, frac(num, d)];
  }));
  const firstRound = Object.fromEntries(
    Array.from({ length: MAX_ROUNDS }, (_, i) => [i + 1, firstInRound(N, s.trap, i + 1)]));
  // Round 9 set is rejected (trap-too-late); a round 8 set can only arm for the round 9 clash.
  const tooLate = firstRound[9];
  const onlyLastClash = firstRound[8];
  const noneBy6 = noneIn(N, s.trap, seenByRound(6));
  const tooLateGivenNoneBy6 = s.trap ? divide(tooLate, noneBy6) : frac(0, 1);
  const noFreeOpener = noneIn(N, s.free, OPENING_HAND);
  return { N, trapBy, spellBy, tacticalBy, bothBy, firstRound, tooLate, onlyLastClash, tooLateGivenNoneBy6, noFreeOpener };
}
