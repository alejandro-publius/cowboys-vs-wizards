// PreToolUse fence for the showdown-balancer agent (.kiro/agents/showdown-balancer.json).
// Reads one hook event as JSON on stdin and exits 0 to allow the tool call or 2 to block it
// (the reason goes to stderr, which Kiro shows to the agent). Any error blocks: fail closed.
//
// Allowed:
//   - read-only file tools (read, fs_read, read_file, glob, grep); native Kiro CLI reports its
//     file read to PreToolUse as read_file;
//   - a write tool (write, fs_write) whose single `path` is exactly an existing card JSON file
//     inside the open scratch snapshot of the current attempt:
//       .artifacts/contest-balance/attempt-<1..6>/scratch/.kiro/specs/duel-card-pipeline/cards/<card>.json
//     where the scratch holds the coordinator's marker, the attempt has no review receipt yet,
//     the card is listed in the marker's troop whitelist, and no path component is a symlink.
// Blocked: shell, code, every MCP tool (none are approved), unknown tools, unknown input shapes,
// path traversal, absolute paths outside the workspace, the real card directory, every other file.
//
// Hook input fields accepted (Kiro CLI hook event): hook_event_name, cwd, tool_name, tool_input;
// camelCase spellings (hookEventName, toolName, toolInput) are accepted as the same fields.
import {existsSync, lstatSync, readFileSync, realpathSync} from "node:fs";
import {isAbsolute, join, relative, resolve, sep} from "node:path";
import {fileURLToPath} from "node:url";

export const MARKER = ".contest-balance-scratch.json";
export const MAX_ATTEMPTS = 6;
export const READ_TOOLS = Object.freeze(["read", "fs_read", "read_file", "glob", "grep"]);
export const WRITE_TOOLS = Object.freeze(["write", "fs_write"]);
export const WRITE_COMMANDS = Object.freeze(["create", "str_replace"]);
// Write-capable or unreviewed MCP tools are never approved for the balancer.
export const APPROVED_MCP = Object.freeze([]);
const CARD_PATH = /^\.artifacts\/contest-balance\/attempt-([1-9][0-9]*)\/scratch\/\.kiro\/specs\/duel-card-pipeline\/cards\/([a-z][a-z0-9-]{0,31})\.json$/;

const allow = (reason) => ({allow: true, reason});
const deny = (reason) => ({allow: false, reason});

// Every component from `root` down to `rel` must exist and be a real directory or file, not a link.
function linkFree(root, rel) {
  let at = root;
  for (const part of rel.split("/")) {
    at = join(at, part);
    const stat = lstatSync(at, {throwIfNoEntry: false});
    if (!stat) return `${relative(root, at)} does not exist`;
    if (stat.isSymbolicLink()) return `${relative(root, at)} is a symbolic link`;
  }
  return lstatSync(at).isFile() ? null : `${rel} is not a regular file`;
}

export function fenceDecision(event, {cwd: fallbackCwd = process.cwd()} = {}) {
  if (!event || typeof event !== "object" || Array.isArray(event)) return deny("hook event is not a JSON object");
  const hook = event.hook_event_name ?? event.hookEventName;
  if (hook !== undefined && !/^pre_?tool_?use$/i.test(String(hook))) return deny(`unexpected hook event ${JSON.stringify(hook)}`);
  const tool = event.tool_name ?? event.toolName;
  if (typeof tool !== "string" || !tool) return deny("tool name missing");
  if (READ_TOOLS.includes(tool)) return allow(`${tool} is read-only`);
  if (tool.startsWith("@") || tool.includes("/") || tool.startsWith("mcp")) {
    return APPROVED_MCP.includes(tool) ? allow(`${tool} is an approved MCP tool`) : deny(`MCP tool ${tool} is not approved for the balancer`);
  }
  if (!WRITE_TOOLS.includes(tool)) return deny(`tool ${tool} is not allowed for the balancer (no shell, code or other tools)`);

  const input = event.tool_input ?? event.toolInput;
  if (!input || typeof input !== "object" || Array.isArray(input)) return deny("write input is not an object");
  for (const key of ["paths", "operations", "file_path", "target", "destination"]) {
    if (key in input) return deny(`write input field ${key} is not supported; one path only`);
  }
  if (input.command !== undefined && !WRITE_COMMANDS.includes(input.command)) return deny(`write command ${JSON.stringify(input.command)} is not allowed`);
  const raw = input.path;
  if (typeof raw !== "string" || !raw) return deny("write path missing");
  if (/[\0\\%~]/.test(raw) || raw.includes("//") || raw.split(/[/]/).some((part) => part === ".." || part === ".")) {
    return deny(`write path ${JSON.stringify(raw)} contains traversal or unusual characters`);
  }
  const cwdRaw = event.cwd ?? fallbackCwd;
  if (typeof cwdRaw !== "string" || !isAbsolute(cwdRaw)) return deny("hook cwd is not an absolute path");
  const root = realpathSync(cwdRaw);
  const rel = isAbsolute(raw) ? relative(root, raw) : raw;
  if (!rel || rel.startsWith("..") || isAbsolute(rel) || rel.split(sep).join("/") !== rel) return deny(`write path ${raw} is outside the workspace`);
  const m = CARD_PATH.exec(rel);
  if (!m) return deny(`write path ${rel} is not a card JSON file in an open contest-balance scratch snapshot`);
  const attempt = Number(m[1]);
  const card = m[2];
  if (attempt > MAX_ATTEMPTS) return deny(`attempt ${attempt} is beyond the cap of ${MAX_ATTEMPTS}`);
  const links = linkFree(root, rel);
  if (links) return deny(links);
  if (realpathSync(join(root, rel)) !== resolve(root, rel)) return deny(`${rel} does not resolve to itself`);
  const attemptDir = join(root, ".artifacts/contest-balance", `attempt-${attempt}`);
  const markerFile = join(attemptDir, "scratch", MARKER);
  const markerLinks = linkFree(root, relative(root, markerFile));
  if (markerLinks) return deny(`scratch marker missing or unsafe: ${markerLinks}`);
  if (existsSync(join(attemptDir, "receipt.json"))) return deny(`attempt ${attempt} is already reviewed and closed`);
  let marker;
  try { marker = JSON.parse(readFileSync(markerFile, "utf8")); } catch { return deny("scratch marker is not valid JSON"); }
  if (marker?.schema !== "contest-balance/scratch@1" || marker.attempt !== attempt) return deny("scratch marker does not match this attempt");
  if (!Array.isArray(marker.cards) || !marker.cards.includes(card)) return deny(`${card} is not a whitelisted troop card for this attempt`);
  return allow(`${rel} is an existing whitelisted card in open attempt ${attempt}`);
}

// Hook entry point: stdin JSON in, exit 0 or 2 out.
export function runHook(text, options) {
  let decision;
  try { decision = fenceDecision(JSON.parse(text), options); } catch (error) { decision = deny(`fence error: ${error.message}`); }
  return decision;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let text = "";
  try { text = readFileSync(0, "utf8"); } catch { text = ""; }
  const decision = runHook(text);
  if (decision.allow) process.exit(0);
  process.stderr.write(`contest-balance fence blocked this tool call: ${decision.reason}\n`);
  process.exit(2);
}
