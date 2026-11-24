// Frontier kit: code shared by Showdown and Boot Hill Poker. It imports neither game. See README.md for who uses it.
// This barrel exports the deterministic paired-duel cohort audit only. The seeded generator, seeded-rng.js, is used
// by its own path and is not re-exported here: tests/game/dec4-frontier-kit.test.js pins this barrel's exports and
// import graph to the audit.
export {DRAW, MAX_DEALS, PairedCohortError, measurePairedCohort} from "./paired-cohort.js";
