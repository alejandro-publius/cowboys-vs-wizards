// Night Shift ambient activity hook. One command per automatically fired Kiro
// hook trigger (see .kiro/hooks/night-shift-activity.json).
//
// Usage: node scripts/saloon-activity.mjs <CanonicalTrigger>   (event JSON on stdin)
//
// Stores only {kind:'activity', actor, phase} on the separate ambient board
// through recordActivity from ./saloon-journal.mjs (recordEvent is the
// headline board and drops activity records). Never stores prompts, commands, paths, user or session
// IDs, free text, model input or output. Prints nothing and always exits 0, so
// it cannot change a PreToolUse, PermissionRequest or Stop outcome.
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

export const PHASES = Object.freeze([
  "SessionStart", "SessionEnd", "UserPromptSubmit", "Stop", "PermissionRequest",
  "PreToolUse", "PostToolUse", "PostFileCreate", "PostFileSave", "PostFileDelete",
  "PreTaskExecution", "PostTaskExecution", "PreCompact", "PostCompact",
]);
export const ACTORS = Object.freeze(["sheriff", "wizard", "hunter", "singularity"]);

const MAX_STDIN = 1 << 20;
const BY_LOWER = new Map(PHASES.map((p) => [p.toLowerCase(), p]));
// Other delivered names for the same automatic triggers. Manual / on-demand
// triggers are deliberately absent so they are ignored. pretaskexec and
// posttaskexec are the native Kiro CLI v1 spellings; they map onto the long
// internal phase names so persisted journal phases stay unchanged.
const LEGACY = new Map(Object.entries({
  pretaskexec: "PreTaskExecution",
  posttaskexec: "PostTaskExecution",
  agentspawn: "SessionStart",
  promptsubmit: "UserPromptSubmit",
  agentstop: "Stop",
  subagentstop: "Stop",
  filecreated: "PostFileCreate",
  fileedited: "PostFileSave",
  filesaved: "PostFileSave",
  filedeleted: "PostFileDelete",
}));

// Canonical trigger for a delivered or configured name, or null.
export function canonicalPhase(name) {
  if (typeof name !== "string" || name.length > 64) return null;
  const key = name.replace(/[\s_-]/g, "").toLowerCase();
  return BY_LOWER.get(key) ?? LEGACY.get(key) ?? null;
}

// The delivered event name wins when present; the configured trigger is used
// only when the runtime omits it. A delivered name we do not know is ignored.
export function resolvePhase(event, configured) {
  const delivered = event?.hook_event_name ?? event?.hookEventName;
  if (delivered !== undefined) return canonicalPhase(delivered);
  return canonicalPhase(configured);
}

// Agent and profile metadata a runtime may attach. Each is read as a string,
// or as an object's name/role. Only an exact allowlisted role is used.
const ROLE_FIELDS = [
  "agent_name", "agentName", "agent_role", "agentRole",
  "agent_profile", "agentProfile", "profile", "profile_name", "profileName",
];
const NESTED_FIELDS = ["agent", "agent_profile", "agentProfile", "profile"];
const CARD_PATH = /(^|\/)\.kiro\/specs\/duel-card-pipeline\/cards\//;
const FILE_FIELDS = ["file_path", "filePath", "path"];

function exactRole(value) {
  if (typeof value !== "string") return null;
  const role = value.trim().toLowerCase();
  return ACTORS.includes(role) ? role : null;
}

// Kiro 3.5 spec task tool input: {tasksFilePath, taskId, status}.
export function isSpecTaskInput(input) {
  return Boolean(input) && typeof input === "object"
    && typeof input.tasksFilePath === "string"
    && (typeof input.taskId === "string" || typeof input.taskId === "number")
    && typeof input.status === "string";
}

function touchesCards(event) {
  const places = [event, event.tool_input, event.toolInput].filter((v) => v && typeof v === "object");
  for (const place of places) {
    for (const field of FILE_FIELDS) {
      if (typeof place[field] === "string" && CARD_PATH.test(place[field].replace(/\\/g, "/"))) return true;
    }
  }
  return false;
}

// Who is shown noticing the event. Only an exact allowlisted role in the
// payload names a role; otherwise the action domain picks the observer
// (task -> hunter, card -> wizard, guard -> sheriff) and the Singularity
// watches everything else. This is an observer, never a claimed author.
export function resolveActor(event, phase) {
  for (const field of ROLE_FIELDS) {
    const role = exactRole(event[field]);
    if (role) return role;
  }
  for (const field of NESTED_FIELDS) {
    const nested = event[field];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;
    for (const key of [...ROLE_FIELDS, "name", "role"]) {
      const role = exactRole(nested[key]);
      if (role) return role;
    }
  }
  if (phase === "PreTaskExecution" || phase === "PostTaskExecution") return "hunter";
  if (isSpecTaskInput(event.tool_input) || isSpecTaskInput(event.toolInput)) return "hunter";
  if (touchesCards(event)) return "wizard";
  if (phase === "PermissionRequest") return "sheriff";
  return "singularity";
}

const ID_FIELDS = ["invocation_id", "invocationId", "hook_invocation_id", "tool_use_id", "toolUseId", "execution_id", "event_id"];
const ID_SHAPE = /^[A-Za-z0-9._:-]{1,128}$/;

// Opaque key derived from a runtime invocation id, or undefined so the
// journal generates one and repeated id-less events are each kept.
export function stableKeyFor(event, phase) {
  for (const field of ID_FIELDS) {
    const id = event[field];
    if (typeof id === "string" && ID_SHAPE.test(id)) {
      return `activity:${createHash("sha256").update(`${phase}|${id}`).digest("hex").slice(0, 24)}`;
    }
  }
  return undefined;
}

// Pure decision: the journal call to make for one hook run, or null.
export function activityFromHook(text, configured) {
  if (typeof text !== "string" || !text.trim() || text.length > MAX_STDIN) return null;
  let event;
  try { event = JSON.parse(text); } catch { return null; }
  if (!event || typeof event !== "object" || Array.isArray(event)) return null;
  const phase = resolvePhase(event, configured);
  if (!phase) return null;
  const actor = resolveActor(event, phase);
  return {record: {kind: "activity", actor, phase}, stableKey: stableKeyFor(event, phase)};
}

function readStdin() {
  try {
    const buf = readFileSync(0);
    return buf.length > MAX_STDIN ? "" : buf.toString("utf8");
  } catch {
    return "";
  }
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const call = activityFromHook(readStdin(), argv[0]);
    if (!call) return;
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const {recordActivity} = await import("./saloon-journal.mjs");
    if (call.stableKey) recordActivity(root, call.record, call.stableKey);
    else recordActivity(root, call.record);
  } catch {
    // Storage or journal failure must never affect the agent.
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().finally(() => { process.exitCode = 0; });
}
