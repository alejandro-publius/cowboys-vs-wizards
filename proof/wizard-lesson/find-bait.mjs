// Seed search for an authentic Wizard Hellfire bait, using the original level-2 bot on both seats
// and the default decks. Writes JSON to stdout; nothing is placed by hand.
// Run: node proof/wizard-lesson/find-bait.mjs [from] [to] > proof/wizard-lesson/bait-search.json
// Exit 0: found. Exit 2: none in the range (reported, not rigged).
import {DEFAULT_LESSON_POLICY, episodeKey, findBaitEpisode} from "../../src/game/showdown/wizard-lesson-policy.js";

const [from = 0, to = 200] = process.argv.slice(2).map(Number);
const started = Date.now();
const found = findBaitEpisode({from, to, policy: DEFAULT_LESSON_POLICY});
const out = {
  search: {from, to, seedsTried: found.seedsTried, decks: "cards.js DECKS (default)", cpu: "level-2 planTurn", cowboy: "level-2 planTurn stand-in",
    policy: DEFAULT_LESSON_POLICY, ms: Date.now() - started, node: process.version},
  found: Boolean(found.episode),
  ...(found.episode ? {episodeKey: episodeKey(found.episode), report: found.report, comparison: found.comparison, episode: found.episode} : {}),
};
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
process.exitCode = found.episode ? 0 : 2;
