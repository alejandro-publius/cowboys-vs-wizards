// TEST FIXTURE ONLY (gate tests, tests/match/showdown-outrider-gate.test.js). Not the search worker's policy and
// never shipped: the page only reads experiments/showdown-outrider/decision/. Deterministic, reads only `legal`.
const rank = (a) => (a.type === "attack" && a.target === "base" ? 0 : a.type === "attack" ? 1 : a.type === "summon" ? 2 : a.type === "end" ? 9 : 5);
export function continuation(view, legal) {
  return [...legal].sort((a, b) => rank(a) - rank(b))[0];
}
