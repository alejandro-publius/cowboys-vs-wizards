// Compatibility re-export. The paired duel kit now lives in packages/frontier-kit/paired-cohort.js;
// existing callers (scripts/field-trial-confirm.mjs, tests) keep importing this path unchanged.
export {DRAW, MAX_DEALS, PairedCohortError, measurePairedCohort} from "../../packages/frontier-kit/index.js";
