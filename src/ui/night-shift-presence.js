// Night Shift ambient presence: projects stored activity records to the two
// displayable fields and gives each a short on-screen line. Pure; no DOM.
// These lines describe what an observer notices. They are not the decisive
// gameplay actions (confirmed jobs, blocks, edits, posters, passed bells).

export const ACTIVITY_PHASES = Object.freeze([
  "SessionStart", "SessionEnd", "UserPromptSubmit", "Stop", "PermissionRequest",
  "PreToolUse", "PostToolUse", "PostFileCreate", "PostFileSave", "PostFileDelete",
  "PreTaskExecution", "PostTaskExecution", "PreCompact", "PostCompact",
]);
export const ACTIVITY_ACTORS = Object.freeze(["sheriff", "wizard", "hunter", "singularity"]);

const ACTOR_NAME = Object.freeze({
  sheriff: "Sheriff",
  wizard: "Wizard",
  hunter: "Hunter",
  singularity: "Singularity",
});

const SEEN = Object.freeze({
  SessionStart: "a lamp lit for a new session",
  SessionEnd: "a lamp go dark",
  UserPromptSubmit: "a new request come in",
  Stop: "the agent pause",
  PermissionRequest: "someone ask leave to act",
  PreToolUse: "a tool being reached for",
  PostToolUse: "a tool set back down",
  PostFileCreate: "a new page appear",
  PostFileSave: "a page get saved",
  PostFileDelete: "a page torn out",
  PreTaskExecution: "a task start",
  PostTaskExecution: "a task wrap up",
  PreCompact: "notes being tidied",
  PostCompact: "notes tidied away",
});

// {actor, phase} from an allowlisted activity record, or null.
export function cleanActivityFields(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  if (input.kind !== undefined && input.kind !== "activity") return null;
  const {actor, phase} = input;
  if (!ACTIVITY_ACTORS.includes(actor) || !ACTIVITY_PHASES.includes(phase)) return null;
  return {actor, phase};
}

// Short ambient line such as "Hunter sees a task start", or null.
export function activityLabel(record) {
  const clean = cleanActivityFields(record);
  if (!clean) return null;
  return `${ACTOR_NAME[clean.actor]} sees ${SEEN[clean.phase]}`;
}
