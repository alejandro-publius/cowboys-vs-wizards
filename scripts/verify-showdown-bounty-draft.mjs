// Showdown Wanted bounty draft sandbox verifier and PreToolUse guard.
// Validates packages drafted by `.kiro/agents/showdown-bounty-drafter.json` under `tasks/showdown-bounties/<id>/`
// against `src/game/showdown/cards.js`, `progress.js`, `trail.js`, and `rules.js` without modifying `src/game/`.
//
//   node scripts/verify-showdown-bounty-draft.mjs prepare [targetDir]
//   node scripts/verify-showdown-bounty-draft.mjs verify  [targetDir] [--seeds <n>=24]
//   node scripts/verify-showdown-bounty-draft.mjs guard [reviewer]  (PreToolUse stdin JSON check)
import {lstatSync, readFileSync, realpathSync} from "node:fs";
import {basename, isAbsolute, join, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {inputPaths, messageDecision, READ_TOOLS, SHELL_TOOLS, shellDecision, workspacePath, WRITE_TOOLS} from "./card-forge.mjs";
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
const ART_GATE_RE = /\bno (?:portrait|model|art|asset|tripo)\b[^.!?\n]*\bbefore\b[^.!?\n]*\b(?:human|owner|user)\b[^.!?\n]*\bapproval\b/i;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ACTIVE_BRIEF = "tasks/showdown-bounties/active-brief.json";
const SOURCE_READS = ["AGENTS.md", "src/game/showdown/cards.js", "src/game/showdown/progress.js", "src/game/showdown/trail.js"];
const REVIEW_COMMANDS = ["prepare", "verify"].map((mode) => `node scripts/verify-showdown-bounty-draft.mjs ${mode}`);
const WRITE_FIELDS = ["path", "file_path", "command", "text", "file_text", "content", "old_str", "new_str", "summary", "explanation"];

// Inspect existing components before following a path. Draft files and their directory may be new.
function checkFile(root, rel) {
  let path = root;
  const parts = rel.split("/");
  for (const [i, part] of parts.entries()) {
    path = join(path, part);
    const item = lstatSync(path, {throwIfNoEntry: false});
    if (!item) return;
    if (i < parts.length - 1 ? !item.isDirectory() : !item.isFile() || item.nlink !== 1) {
      throw new Error(`Expected a plain project path for ${rel}.`);
    }
  }
}

export function selectedBounty(root = ROOT) {
  checkFile(root, ACTIVE_BRIEF);
  const path = join(root, ACTIVE_BRIEF);
  if (!lstatSync(path, {throwIfNoEntry: false})) return {targetDir: DEFAULT_PACKAGE};
  const request = JSON.parse(readFileSync(path, "utf8"));
  if (typeof request?.id !== "string" || !ID.test(request.id) || typeof request.brief !== "string" || !request.brief.trim()) {
    throw new Error(`${ACTIVE_BRIEF} requires a kebab-case id and a non-empty brief.`);
  }
  return {targetDir: `tasks/showdown-bounties/${request.id}`, brief: request.brief};
}

export function checkGuardPayload(payload, root = ROOT, role = "author") {
  const deny = (reason) => ({allow: false, reason});
  const allow = {allow: true, reason: "ok"};
  try {
    const tool = payload?.tool_name ?? payload?.toolName ?? payload?.tool;
    const input = payload?.tool_input ?? payload?.toolInput ?? payload?.input;
    if (!["author", "reviewer"].includes(role) || !input || typeof input !== "object" || Array.isArray(input)) return deny("Unknown role or tool input.");
    const cwd = payload.cwd ?? root;
    if (typeof cwd !== "string" || !isAbsolute(cwd) || realpathSync(cwd) !== realpathSync(root)) return deny("Run from the project root.");
    if (tool === "send_message") return messageDecision(input);
    if (role === "reviewer" && SHELL_TOOLS.includes(tool)) return shellDecision(input, cwd, realpathSync(root), REVIEW_COMMANDS);

    const write = role === "author" && WRITE_TOOLS.includes(tool);
    if (!write && !READ_TOOLS.includes(tool)) return deny(`Tool ${tool} is outside the ${role} profile.`);
    const paths = inputPaths(input);
    if (!paths?.length) return deny("Missing target path.");
    if (write && (paths.length !== 1 || Object.keys(input).some((key) => !WRITE_FIELDS.includes(key))
      || (input.command !== undefined && !["create", "str_replace"].includes(input.command)))) {
      return deny("Use a single-file draft write.");
    }
    const {targetDir} = selectedBounty(root);
    const draftFiles = REQUIRED_FILES.map((name) => `${targetDir}/${name}`);
    for (const path of paths) {
      const {rel, error} = workspacePath(path, cwd, root);
      if (error) return deny(error);
      const readable = rel === ACTIVE_BRIEF || (role === "author" && SOURCE_READS.includes(rel)) || rel === "AGENTS.md";
      if (!draftFiles.includes(rel) && (write || !readable)) return deny(`Path outside the ${role} profile: ${rel}`);
      checkFile(root, rel);
    }
    return allow;
  } catch (error) {
    return deny(error.message);
  }
}

export function validateBountySchema(bounty, existingBounties = BOUNTIES) {
  const problems = [];
  if (!bounty || typeof bounty !== "object" || Array.isArray(bounty)) {
    return ["bounty.json must be a JSON object."];
  }
  if (typeof bounty.id !== "string" || !ID.test(bounty.id)) {
    problems.push("bounty.id must be a kebab-case identifier.");
  }
  if (existingBounties.some((b) => b.id === bounty.id)) {
    problems.push(`bounty.id "${bounty.id}" collides with an existing shipped bounty.`);
  }
  if (typeof bounty.name !== "string" || bounty.name.trim().length < 4) {
    problems.push("bounty.name must be a non-empty title.");
  } else if (existingBounties.some((b) => b.name.toLowerCase() === bounty.name.trim().toLowerCase())) {
    problems.push(`bounty.name "${bounty.name}" collides with an existing shipped bounty.`);
  }
  const bossSpec = typeof bounty.boss === "string" && TYPES[bounty.boss];
  if (!bossSpec || bossSpec.side !== "wizard" || bossSpec.kind !== "troop") {
    problems.push("bounty.boss must be an existing Wizard troop in TYPES.");
  }
  const rewardSpec = typeof bounty.reward === "string" && TYPES[bounty.reward];
  if (!rewardSpec || rewardSpec.side !== "cowboy") {
    problems.push("bounty.reward must be an existing Cowboy card in TYPES.");
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
      cowboyWinRate: cowboyWins / seeds,
      sampleWinningSeeds: winningSeeds,
    });
  }
  return {stages, problems};
}

export function verifyBountyPackage(packageDir, {root = ROOT, seeds = 24} = {}) {
  const absDir = resolve(root, packageDir);
  const relDir = relative(root, absDir);
  const inProject = relDir && !relDir.startsWith("..") && !isAbsolute(relDir);
  const files = {};
  const problems = [];
  for (const name of REQUIRED_FILES) {
    try {
      if (inProject) checkFile(root, join(relDir, name));
      else checkFile(absDir, name);
      files[name] = readFileSync(join(absDir, name), "utf8");
    } catch (error) {
      problems.push(error.code === "ENOENT" ? `Missing required file: ${name}` : `Cannot read ${name}: ${error.message}`);
    }
  }
  if (problems.length) return {ok: false, packageDir, problems, stages: []};
  let bounty;
  try {
    bounty = JSON.parse(files["bounty.json"]);
  } catch (error) {
    return {ok: false, packageDir, problems: [`Invalid JSON in bounty.json: ${error.message}`], stages: []};
  }
  problems.push(...validateBountySchema(bounty));
  if (typeof bounty?.id === "string" && bounty.id !== basename(absDir)) {
    problems.push("bounty.id must match its package directory.");
  }
  for (const doc of ["reward.md", "portrait-brief.md", "model-brief.md"]) {
    const text = files[doc].trim();
    if (text.length < 40) problems.push(`${doc} is too short to be a reviewable brief.`);
    if (doc !== "reward.md" && !ART_GATE_RE.test(text)) {
      problems.push(`${doc} must state that no art/model/Tripo job starts before human gameplay approval.`);
    }
  }
  if (problems.length) {
    return {ok: false, packageDir, bountyId: bounty?.id ?? null, problems, stages: []};
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
    let verdict;
    try {
      verdict = checkGuardPayload(JSON.parse(readFileSync(0, "utf8")), ROOT, rest[0] ?? "author");
    } catch (error) {
      verdict = {allow: false, reason: error.message};
    }
    if (!verdict.allow) {
      console.error(verdict.reason);
      return 2;
    }
    return 0;
  }
  if (sub === "prepare") {
    const selection = rest[0] ? {targetDir: rest[0]} : selectedBounty();
    console.log(JSON.stringify({
      action: "prepare",
      authorAgent: AUTHOR_AGENT,
      reviewerAgent: REVIEWER_AGENT,
      ...selection,
      existingBountyIds: BOUNTIES.map((b) => b.id),
      deckSize: DECK_SIZE,
      hunts: HUNTS,
    }));
    return 0;
  }
  if (sub === "verify") {
    let targetDir;
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
    const result = verifyBountyPackage(targetDir ?? selectedBounty().targetDir, {seeds});
    console.log(JSON.stringify(result));
    return result.ok ? 0 : 1;
  }
  console.error("Usage: node scripts/verify-showdown-bounty-draft.mjs <prepare|verify|guard> [dir]");
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
