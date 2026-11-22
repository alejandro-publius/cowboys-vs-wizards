// Pure helpers for the contest usage hook and its renderer. No network, no npm.
// Records only sanitized facts; never prompts, tool inputs, values or paths.
import {createHash} from "node:crypto";

export const RECEIPT_DIR = ".artifacts/kiro-contest-usage";
export const RECEIPT_FILE = `${RECEIPT_DIR}/receipts.jsonl`;
export const DOC_FILE = "docs/KIRO_USAGE.md";
export const BEGIN = "<!-- contest-usage:begin -->";
export const END = "<!-- contest-usage:end -->";
export const DUPLICATE_WINDOW_MS = 5000;

const SESSION = /^[A-Za-z0-9_-]{1,128}$/;
const FIELD = /^[a-z][a-z0-9_]{0,39}$/;

const CATEGORY = new Map(Object.entries({
  fs_read: "read", read: "read", read_file: "read", glob: "read", grep: "read",
  grep_search: "read", list_directory: "read", code: "read", knowledge: "read",
  fs_write: "write", write: "write", str_replace: "write", fs_write_file: "write",
  execute_bash: "shell", execute_cmd: "shell", shell: "shell", bash: "shell",
  web_fetch: "web", web_search: "web", remote_web_search: "web",
  use_aws: "aws",
  use_subagent: "delegate", subagent: "delegate", run_workflow: "delegate",
  delegate: "delegate", tool_call: "delegate",
}));
export const CATEGORIES = ["read", "write", "shell", "web", "aws", "delegate", "mcp", "other"];

export function sessionOf(value) {
  return typeof value === "string" && SESSION.test(value) ? value : null;
}

// Fixed category for a tool name. The name itself is never stored.
export function toolCategory(name) {
  if (typeof name !== "string" || !name) return "other";
  const known = CATEGORY.get(name);
  if (known) return known;
  if (name.startsWith("@") || name.includes("::") || /^mcp[_:]/.test(name) || name.includes("/")) return "mcp";
  return "other";
}

// Names of top-level event fields only (sorted, capped). Values are dropped.
export function fieldNames(event) {
  return Object.keys(event).filter((key) => FIELD.test(key)).sort().slice(0, 24);
}

export function receiptId(record) {
  const basis = [record.session ?? "-", record.event, record.at, record.turn ?? 0].join("|");
  return createHash("sha256").update(basis).digest("hex").slice(0, 16);
}

export function parseReceipts(text) {
  const out = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line);
      if (value && typeof value === "object" && value.v === 1 && typeof value.id === "string") out.push(value);
    } catch { /* ignore a torn or foreign line */ }
  }
  return out;
}

// Build the receipt for one hook event, given prior receipts. Returns the
// record to append, or null when nothing should be written.
export function buildRecord(event, prior, {now, root, envSession, cwdReal}) {
  const at = new Date(now).toISOString();
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return finalize({event: "malformed", session: null, at, actions: ["skipped-malformed"]});
  }
  const name = event.hook_event_name;
  const session = sessionOf(event.session_id);
  const flags = {
    fields: fieldNames(event),
    cwd_is_checkout: typeof event.cwd === "string" ? cwdReal(event.cwd) === root : null,
    env_session_set: envSession != null,
    env_session_matches: envSession != null && session != null ? envSession === session : null,
  };
  if (name === "PostToolUse") {
    return finalize({event: "PostToolUse", session, at, category: toolCategory(event.tool_name), flags, actions: ["recorded-tool"]});
  }
  if (name !== "Stop") {
    return finalize({event: "other", session, at, flags, actions: ["skipped-irrelevant"]});
  }
  const mine = prior.filter((r) => r.session === session && session != null);
  const stops = mine.filter((r) => r.event === "Stop");
  const last = stops.at(-1);
  const since = last ? mine.filter((r) => r.event === "PostToolUse" && r.at > last.at) : mine.filter((r) => r.event === "PostToolUse");
  if (last && since.length === 0 && Date.parse(at) - Date.parse(last.at) < DUPLICATE_WINDOW_MS) {
    return null; // same turn reported twice; keep one receipt
  }
  const tools = {};
  for (const r of since) tools[r.category] = (tools[r.category] ?? 0) + 1;
  return finalize({event: "Stop", session, at, turn: stops.length + 1, tools, flags, actions: ["recorded-stop"]});
}

function finalize(record) {
  const out = {v: 1, ...record};
  out.id = receiptId(out);
  return out;
}

const cell = (s) => String(s).replace(/[|\r\n]/g, " ");

export function rowFor(r) {
  const tools = CATEGORIES.filter((c) => r.tools?.[c]).map((c) => `${c} ${r.tools[c]}`).join(", ") || "none observed";
  const f = r.flags ?? {};
  const match = `cwd ${f.cwd_is_checkout == null ? "absent" : f.cwd_is_checkout ? "yes" : "no"}; env ${!f.env_session_set ? "unset" : f.env_session_matches == null ? "no event ID" : f.env_session_matches ? "match" : "differs"}`;
  return `| \`${r.id}\` | ${r.session ? `\`${r.session}\`` : "unknown"} | ${r.at.replace(/\.\d+Z$/, "Z")} | ${r.turn} | ${cell(tools)} | ${cell((f.fields ?? []).join(", ") || "none")} | ${match} | ${cell((r.actions ?? []).join(", "))} |  |`;
}

// Append rows for Stop receipts whose IDs are not yet in the document.
// Existing rows are kept byte-for-byte. Returns {text, added}.
export function renderInto(doc, receipts) {
  const begin = doc.indexOf(BEGIN);
  const end = doc.indexOf(END);
  if (begin < 0 || end < begin) throw new Error(`${DOC_FILE} is missing the ${BEGIN} / ${END} markers`);
  const block = doc.slice(begin, end);
  const present = new Set([...block.matchAll(/^\| `([0-9a-f]{16})` \|/gm)].map((m) => m[1]));
  const seen = new Set();
  const fresh = receipts
    .filter((r) => r.event === "Stop" && !present.has(r.id) && !seen.has(r.id) && seen.add(r.id))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1));
  if (!fresh.length) return {text: doc, added: 0};
  const head = block.endsWith("\n") ? block : `${block}\n`;
  return {text: doc.slice(0, begin) + head + fresh.map(rowFor).join("\n") + "\n" + doc.slice(end), added: fresh.length};
}
