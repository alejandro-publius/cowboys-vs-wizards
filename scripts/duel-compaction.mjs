import {execFileSync} from "node:child_process";
import {appendFileSync, mkdirSync, readFileSync} from "node:fs";

const phase = process.argv[2];
if (phase !== "before" && phase !== "after") {
  throw new Error("Use before or after to record the compaction hook.");
}
const mode = process.argv[3] ?? "lanes";
if (mode !== "lanes" && mode !== "showdown") {
  throw new Error("Use no mode (lane duel) or showdown.");
}

const event = JSON.parse(readFileSync(0, "utf8"));
const revision = execFileSync("git", ["rev-parse", "--short", "HEAD"], {encoding: "utf8"}).trim();
const receipt = {
  phase,
  revision,
  id: revision + "-" + Date.now(),
  hasSummary: typeof event.summary === "string" && event.summary.length > 0,
};
if (mode === "showdown") receipt.mode = mode;

mkdirSync(".artifacts/kiro", {recursive: true});
appendFileSync(".artifacts/kiro/duel-compaction.jsonl", JSON.stringify(receipt) + "\n");

if (phase === "after" && mode === "showdown") {
  console.log("Showdown work after compaction at " + revision + ".");
  console.log("Engine: src/game/showdown/. Session: src/match/showdown-session.js. Screen: src/ui/showdown-screen.js, showdown-cues.js, showdown.css.");
  console.log("Checks: sh scripts/check-match-ui.sh showdown; browser: scripts/browser-showdown-check.mjs and scripts/browser-showdown-cues-check.mjs on the built graybox.");
  console.log("PostCompact receipt " + receipt.id);
} else if (phase === "after") {
  console.log("Duel verification after compaction at " + revision + ".");
  console.log("Keep hand terrain visible, use the mint aura for legal plays, and show base health on the 3D orbs.");
  console.log("Verify seed 0 for the first summon and seed 60 for the Mounted Billy showdown.");
  console.log("PostCompact receipt " + receipt.id);
}
