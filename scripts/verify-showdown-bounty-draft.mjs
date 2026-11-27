// Showdown Wanted bounty draft sandbox verifier and PreToolUse guard.
// Validates packages drafted by `.kiro/agents/showdown-bounty-drafter.json` under `tasks/showdown-bounties/<id>/`
// against `src/game/showdown/cards.js`, `progress.js`, `trail.js`, and `rules.js` without modifying `src/game/`.
//
//   node scripts/verify-showdown-bounty-draft.mjs prepare [targetDir]
//   node scripts/verify-showdown-bounty-draft.mjs verify  [targetDir] [--seeds <n>=24]
//   node scripts/verify-showdown-bounty-draft.mjs guard   (PreToolUse stdin JSON check for showdown-bounty-drafter)
import {existsSync, readFileSync} from "node:fs";
import {posix, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {RARITY, TYPES} from "../src/game/showdown/cards.js";
import {BOUNTIES, DECK_SIZE, HUNTS} from "../src/game/showdown/progress.js";
import {createShowdown, playTurn} from "../src/game/showdown/rules.js";
import {TRAIL, deckAfter} from "../src/game/showdown/trail.js";

export const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const DEFAULT_PACKAGE = "tasks/showdown-bounties/bone-marshal";
export const AUTHOR_AGENT = "showdown-bounty-drafter";
export const REVIEWER_AGENT = "showdown-bounty-reviewer";
export const REQUIRED_FILES = Object.freeze(["bounty.json", "reward.md", "portrait-brief.md", "model-brief.md"]);
const VALID_LEVELS = new Set([0, 1, 1.5, 2]);
const ART_GATE_RE = /no (?:portrait|model|art|asset|tripo).*before.*(?:human|user|owner|play)/is;

const normRel = (root, target) => posix.normalize(relative(root, resolve(root, target)).split("\\").join("/"));

export function checkGuardPayload(payload, root = ROOT) {
  const tool = String(payload?.tool_name ?? payload?.tool ?? "");
  const input = payload?.tool_input ?? payload?.input ?? {};
  if (/shell|bash|exec/i.test(tool)) {
    return {allow: false, reason: `${AUTHOR_AGENT} cannot invoke shell tools.`};
  }
  if (/write|create|edit/i.test(tool)) {
    const rawPath = String(input?.path ?? input?.file_path ?? "");
    if (!rawPath) return {allow: false, reason: "Missing target write path."};
    const rel = normRel(root, rawPath);
    if (rel.startsWith("..") || !/^tasks\/showdown-bounties\/[a-z0-9-]+\/(?:bounty\.json|reward\.md|portrait-brief\.md|model-brief\.md)$/.test(rel)) {
      return {allow: false, reason: `Write path ${rel} is outside tasks/showdown-bounties/<id>/{bounty.json,reward.md,portrait-brief.md,model-brief.md}.`};
    }
  }
  return {allow: true, reason: "ok"};
}

export function validateBountySchema(bounty, existingBounties = BOUNTIES) {
  const problems = [];
  if (!bounty || typeof bounty !== "object" || Array.isArray(bounty)) {
    return ["bounty.json must be a JSON object."];
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(bounty.id ?? ""))) {
    problems.push("bounty.id must be a kebab-case identifier.");
  }
  if (existingBounties.some((b) => b.id === bounty.id)) {
    problems.push(`bounty.id "${bounty.id}" collides with an existing shipped bounty.`);
  }
  if (typeof bounty.name !== "string" || bounty.name.trim().length < 4) {
    problems.push("bounty.name must be a non-empty title.");
  }
  if (existingBounties.some((b) => b.name.toLowerCase() === String(bounty.name ?? "").trim().toLowerCase())) {
    problems.push(`bounty.name "${bounty.name}" collides with an existing shipped bounty.`);
  }
  const bossSpec = TYPES[bounty.boss];
  if (!bossSpec || bossSpec.side !== "wizard" || bossSpec.kind !== "troop") {
    problems.push(`bounty.boss "${bounty.boss}" must be an existing Wizard troop in TYPES.`);
  }
  const rewardSpec = TYPES[bounty.reward];
  if (!rewardSpec || rewardSpec.side !== "cowboy") {
    problems.push(`bounty.reward "${bounty.reward}" must be an existing Cowboy card in TYPES.`);
  }
  if (typeof bounty.lesson !== "string" || bounty.lesson.trim().length < 16) {
    problems.push("bounty.lesson must explain the boss threat in plain words.");
  }
  if (bounty.entrance === "board") {
    if (bounty.lands !== undefined) problems.push('bounty.lands must be omitted when entrance is "board".');
  } else if (bounty.entrance === "lands") {
    if (!Number.isInteger(bounty.lands) || bounty.lands < 2 || bounty.lands > 8) {
      problems.push('bounty.lands must be an integer in 2..8 when entrance is "lands".');
    }
  } else {
    problems.push('bounty.entrance must be "board" or "lands".');
  }

  // Escort deck validation (SBP-5)
  if (!bounty.deck || typeof bounty.deck !== "object" || Array.isArray(bounty.deck)) {
    problems.push("bounty.deck must be a card-count map.");
  } else {
    let total = 0;
    for (const [type, copies] of Object.entries(bounty.deck)) {
      const card = TYPES[type];
      if (!Number.isInteger(copies) || copies <= 0) {
        problems.push(`bounty.deck.${type} must be a positive integer.`);
        continue;
      }
      total += copies;
      if (!card || card.side !== "wizard") {
        problems.push(`bounty.deck.${type} is not a Wizard card.`);
        continue;
      }
      const maxCopies = RARITY[card.rarity]?.[1] ?? 0;
      if (copies > maxCopies) {
        problems.push(`bounty.deck.${type} has ${copies} copies, exceeding rarity cap ${maxCopies}.`);
      }
    }
    if (total !== DECK_SIZE) {
      problems.push(`bounty.deck must total ${DECK_SIZE} cards (got ${total}).`);
    }
  }

  // Progressive 5-hunt validation (SBP-6)
  if (!Array.isArray(bounty.hunts) || bounty.hunts.length !== HUNTS) {
    problems.push(`bounty.hunts must contain exactly ${HUNTS} stages.`);
  } else {
    bounty.hunts.forEach((hunt, idx) => {
      if (!hunt || typeof hunt !== "object") {
        problems.push(`hunt[${idx}] must be an object.`);
        return;
      }
      if (!VALID_LEVELS.has(hunt.level)) {
        problems.push(`hunt[${idx}].level must be 0, 1, 1.5, or 2.`);
      }
      if (!Number.isInteger(hunt.base) || hunt.base < 3 || hunt.base > 6) {
        problems.push(`hunt[${idx}].base must be an integer in 3..6.`);
      }
      if (!Number.isInteger(hunt.orbs) || hunt.orbs < 1 || hunt.orbs > 12) {
        problems.push(`hunt[${idx}].orbs must be an integer in 1..12.`);
      }
      if (idx > 0) {
        const prev = bounty.hunts[idx - 1];
        if (typeof prev?.level === "number" && typeof hunt.level === "number" && hunt.level < prev.level) {
          problems.push(`hunt[${idx}].level (${hunt.level}) decreases below hunt[${idx - 1}].level (${prev.level}).`);
        }
        if (Number.isInteger(prev?.orbs) && Number.isInteger(hunt.orbs) && hunt.orbs < prev.orbs) {
          problems.push(`hunt[${idx}].orbs (${hunt.orbs}) decreases below hunt[${idx - 1}].orbs (${prev.orbs}).`);
        }
      }
    });
  }
  return problems;
}

export function simulateBountyHunts(bounty, {seeds = 24, cowboyDeck = deckAfter(TRAIL.length)} = {}) {
  const stages = [];
  const problems = [];
  for (let i = 0; i < bounty.hunts.length; i += 1) {
    const hunt = bounty.hunts[i];
    let cowboyWins = 0;
    let wizardWins = 0;
    let draws = 0;
    const winningSeeds = [];
    for (let seed = 0; seed < seeds; seed += 1) {
      const options = {
        decks: {cowboy: cowboyDeck, wizard: bounty.deck},
        baseOrbs: {cowboy: 5, wizard: hunt.base},
        first: "cowboy",
        ...(bounty.entrance === "board"
          ? {opening: {wizard: [{type: bounty.boss, health: hunt.orbs}]}}
          : {arrivals: {wizard: [{type: bounty.boss, turn: bounty.lands, health: hunt.orbs}]}}),
      };
      let state = createShowdown(seed, options);
      while (!state.result) {
        const level = state.active === "cowboy" ? 2 : hunt.level;
        state = playTurn(state, level).state;
      }
      if (state.result.winner === "cowboy") {
        cowboyWins += 1;
        if (winningSeeds.length < 3) winningSeeds.push(seed);
      } else if (state.result.winner === "wizard") {
        wizardWins += 1;
      } else {
        draws += 1;
      }
    }
    if (cowboyWins === 0) {
      problems.push(`hunt[${i}] had 0 Cowboy wins across seeds 0..${seeds - 1}.`);
    }
    stages.push({
      hunt: i + 1,
      level: hunt.level,
      bossOrbs: hunt.orbs,
      games: seeds,
      cowboyWins,
      wizardWins,
      draws,
      sampleWinningSeeds: winningSeeds,
    });
  }
  return {stages, problems};
}

export function verifyBountyPackage(packageDir, {root = ROOT, seeds = 24} = {}) {
  const absDir = resolve(root, packageDir);
  const missing = REQUIRED_FILES.filter((f) => !existsSync(resolve(absDir, f)));
  if (missing.length) {
    return {ok: false, packageDir, problems: missing.map((f) => `Missing required file: ${f}`), stages: []};
  }
  let bounty;
  try {
    bounty = JSON.parse(readFileSync(resolve(absDir, "bounty.json"), "utf8"));
  } catch (error) {
    return {ok: false, packageDir, problems: [`Invalid JSON in bounty.json: ${error.message}`], stages: []};
  }
  const problems = validateBountySchema(bounty);
  for (const doc of ["reward.md", "portrait-brief.md", "model-brief.md"]) {
    const text = readFileSync(resolve(absDir, doc), "utf8").trim();
    if (text.length < 40) problems.push(`${doc} is too short to be a reviewable brief.`);
    if (doc !== "reward.md" && !ART_GATE_RE.test(text)) {
      problems.push(`${doc} must state that no art/model/Tripo job starts before human gameplay approval.`);
    }
  }
  if (problems.length) {
    return {ok: false, packageDir, bountyId: bounty.id ?? null, problems, stages: []};
  }
  const sim = simulateBountyHunts(bounty, {seeds});
  return {
    ok: sim.problems.length === 0,
    packageDir,
    bountyId: bounty.id,
    boss: bounty.boss,
    reward: bounty.reward,
    problems: sim.problems,
    stages: sim.stages,
  };
}

function main(argv) {
  const [sub = "verify", ...rest] = argv;
  if (sub === "guard") {
    let raw = "";
    try { raw = readFileSync(0, "utf8"); } catch { raw = "{}"; }
    const payload = raw.trim() ? JSON.parse(raw) : {};
    const verdict = checkGuardPayload(payload);
    if (!verdict.allow) {
      console.error(verdict.reason);
      return 2;
    }
    return 0;
  }
  if (sub === "prepare") {
    const targetDir = rest[0] && !rest[0].startsWith("--") ? rest[0] : DEFAULT_PACKAGE;
    console.log(JSON.stringify({
      action: "prepare",
      authorAgent: AUTHOR_AGENT,
      reviewerAgent: REVIEWER_AGENT,
      targetDir,
      existingBountyIds: BOUNTIES.map((b) => b.id),
      deckSize: DECK_SIZE,
      hunts: HUNTS,
    }));
    return 0;
  }
  if (sub === "verify") {
    let targetDir = DEFAULT_PACKAGE;
    let seeds = 24;
    for (let i = 0; i < rest.length; i += 1) {
      if (rest[i] === "--seeds") {
        seeds = Number(rest[i + 1]);
        i += 1;
      } else if (!rest[i].startsWith("--")) {
        targetDir = rest[i];
      }
    }
    if (!Number.isInteger(seeds) || seeds < 1 || seeds > 500) {
      console.error("Usage: node scripts/verify-showdown-bounty-draft.mjs verify [dir] [--seeds 1..500]");
      return 2;
    }
    const result = verifyBountyPackage(targetDir, {seeds});
    console.log(JSON.stringify(result));
    return result.ok ? 0 : 1;
  }
  console.error("Usage: node scripts/verify-showdown-bounty-draft.mjs <prepare|verify|guard> [dir]");
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
