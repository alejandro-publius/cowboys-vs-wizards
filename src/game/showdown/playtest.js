// What a playtest leaves behind: one line per finished duel, and a report a tester can copy and send.
// Pure. The screen stores the list and calls these.
import {BOUNTIES, HUNTS, RIVALS} from "./progress.js";
import {TRAIL} from "./trail.js";

export const LOG_LIMIT = 300;
// entry: {name, won, turns, seconds, rules, build?}. rules: the player opened "All the rules" during that duel.
// build: the public label of the game build the duel was finished under; lines logged before builds were recorded have none.
export const logged = (log, entry) => [...log, entry].slice(-LOG_LIMIT);

const minutes = (seconds) => (seconds < 90 ? `${Math.round(seconds)} s` : `${Math.round(seconds / 60)} min`);

// Consecutive duels under the same build, as "1-2 on <build>" or "3 build not recorded".
function byBuild(log) {
  const runs = [];
  log.forEach((entry, i) => {
    const last = runs.at(-1);
    if (last && last.build === entry.build) last.to = i + 1;
    else runs.push({build: entry.build, from: i + 1, to: i + 1});
  });
  return runs.map(({build, from, to}) => `${from === to ? from : `${from}-${to}`} ${build ? `on ${build}` : "build not recorded"}`).join("; ");
}

// options.build (K-087): when given (a label, or null when the page has none), the report also names
// the page's build and the build each logged duel was finished under. Without it the text is unchanged.
export function report(log, save, options = {}) {
  if (!log.length) return "No duel has been finished yet.";
  const won = log.filter((entry) => entry.won).length;
  const total = log.reduce((sum, entry) => sum + entry.seconds, 0);
  const hunts = Object.values(save.hunts).reduce((sum, cleared) => sum + cleared, 0);
  // The first loss, and the duel lost most often, are where a new player is most likely to give up.
  const losses = {};
  for (const entry of log) if (!entry.won) losses[entry.name] = (losses[entry.name] ?? 0) + 1;
  const hardest = Object.entries(losses).sort((a, b) => b[1] - a[1])[0];
  const firstLoss = log.findIndex((entry) => !entry.won);
  return [
    "Showdown playtest report",
    `Finished ${log.length} duel${log.length === 1 ? "" : "s"} in ${minutes(total)} of play: won ${won}, lost ${log.length - won}.`,
    `Reached: Trail ${Math.min(save.wins, TRAIL.length)} of ${TRAIL.length} won, rivals ${save.rivals.length} of ${RIVALS.length}, Wanted hunts ${hunts} of ${BOUNTIES.length * HUNTS}, even-match wins ${save.openWins}.`,
    firstLoss < 0 ? "Never lost." : `First loss: duel ${firstLoss + 1}, ${log[firstLoss].name}.`,
    hardest ? `Lost most often: ${hardest[0]}, ${hardest[1]} time${hardest[1] === 1 ? "" : "s"}.` : "",
    `Opened "All the rules" during ${log.filter((entry) => entry.rules).length} of ${log.length} duels.`,
    `Cards in the deck now: ${Object.entries(save.deck).map(([type, copies]) => `${type.replace(/^cowboy-/, "")} x${copies}`).join(", ")}.`,
    ...("build" in options ? [
      `This report is from game build ${options.build ?? "not identified"}.`,
      `Duels by build: ${byBuild(log)}.`,
      "Reached and the deck are the saved career, which can include duels finished on other builds or before this log began.",
    ] : []),
    "",
    "Duel by duel:",
    ...log.map((entry, i) => `${i + 1}. ${entry.name}: ${entry.won ? "won" : "lost"} in ${entry.turns} turns, ${minutes(entry.seconds)}${entry.rules ? ", read the rules" : ""}`),
  ].filter((line, i, lines) => line !== "" || lines[i + 1] === "Duel by duel:").join("\n");
}
