// PostFileSave command hook. Checks tracked documentation only; stdin is JSON.
import {readFileSync, mkdirSync, appendFileSync, realpathSync} from "node:fs";
import {spawnSync} from "node:child_process";
import path from "node:path";

const root = realpathSync(process.cwd());
const receipt = {
  at: new Date().toISOString(), file: null, tracked: false,
  status: "skipped-malformed", session_id: null, hook_event_name: null, output: "",
};
const clean = (value, limit) => typeof value === "string"
  ? value.replaceAll(root, "<PROJECT_ROOT>").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, limit)
  : null;
const outside = (relative) => relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);

function finish(status, message, code = 0) {
  receipt.status = status;
  receipt.output = clean(message, 2000) ?? "";
  const directory = path.join(root, ".artifacts/doc-link-hook");
  mkdirSync(directory, {recursive: true});
  appendFileSync(path.join(directory, "receipts.jsonl"), JSON.stringify(receipt) + "\n");
  process.stdout.write(`doc-link-hook: ${status}${receipt.file ? ` (${receipt.file})` : ""}\n`);
  process.exitCode = code;
}

function main() {
  let event;
  try { event = JSON.parse(readFileSync(0, "utf8")); }
  catch { return finish("skipped-malformed", "Expected a PostFileSave JSON object."); }
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return finish("skipped-malformed", "Expected a PostFileSave JSON object.");
  }
  receipt.session_id = clean(event.session_id, 128);
  receipt.hook_event_name = clean(event.hook_event_name, 64);
  if (event.hook_event_name !== "PostFileSave") return finish("skipped-irrelevant", "Not a PostFileSave event.");
  if (typeof event.file_path !== "string" || !event.file_path || event.file_path.includes("\0")) {
    return finish("skipped-malformed", "PostFileSave event has no valid file_path.");
  }
  // Do not change directory based on event input: the process checkout owns this hook.
  let absolute = path.resolve(root, event.file_path);
  let relative = path.relative(root, absolute);
  // macOS may report /var/... while cwd is /private/var/.... Resolve parent
  // aliases, retaining the final filename so a tracked symlink stays itself.
  if (outside(relative)) {
    try {
      absolute = path.join(realpathSync(path.dirname(absolute)), path.basename(absolute));
      relative = path.relative(root, absolute);
    } catch { return finish("skipped-outside", "Saved file is outside this checkout."); }
  }
  if (outside(relative)) return finish("skipped-outside", "Saved file is outside this checkout.");
  const file = relative.split(path.sep).join("/");
  if (!/^docs\/.+\.md$/.test(file)) return finish("skipped-irrelevant", "Saved file is not documentation Markdown.");
  receipt.file = clean(file, 512);
  const tracked = spawnSync("git", ["--literal-pathspecs", "ls-files", "--error-unmatch", "--", file], {cwd: root, encoding: "utf8"});
  if (tracked.status !== 0) return finish("skipped-untracked", "Saved documentation file is not tracked by Git.");
  try {
    if (outside(path.relative(root, realpathSync(absolute)))) {
      receipt.file = null;
      return finish("skipped-outside", "Saved file resolves outside this checkout.");
    }
  } catch { return finish("skipped-unavailable", "Saved documentation file is not available."); }
  receipt.tracked = true;
  const result = spawnSync(process.execPath, [path.join(root, "scripts/check-links.mjs")], {cwd: root, encoding: "utf8"});
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  const code = result.status ?? 1;
  const output = (result.stdout ?? "") + (result.stderr ?? "") + (result.error ? result.error.message : "");
  return finish(code === 0 ? "passed" : "failed", output, code);
}

main();
