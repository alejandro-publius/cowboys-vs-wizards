// Regression: native Kiro CLI reports its file read to PreToolUse as `read_file`. The fence
// denied that name, so the showdown-balancer could not read its brief.json. Writes stay confined.
import test from "node:test";
import assert from "node:assert/strict";
import {READ_TOOLS, WRITE_TOOLS, fenceDecision} from "../../scripts/contest-balance-fence.mjs";

const cwd = process.cwd();
const brief = ".artifacts/contest-balance/attempt-1/brief.json";

test("native Kiro CLI read_file is allowed as read-only", () => {
  for (const event of [
    {hook_event_name: "preToolUse", cwd, tool_name: "read_file", tool_input: {path: brief}},
    {hookEventName: "PreToolUse", cwd, toolName: "read_file", toolInput: {path: brief}},
  ]) {
    const decision = fenceDecision(event);
    assert.equal(decision.allow, true, decision.reason);
  }
  assert.ok(READ_TOOLS.includes("read_file"));
});

test("read-only names never double as write tools", () => {
  for (const tool of READ_TOOLS) assert.equal(WRITE_TOOLS.includes(tool), false, tool);
  assert.deepEqual([...WRITE_TOOLS].sort(), ["fs_write", "write"]);
});

test("writes outside the scratch card files stay denied", () => {
  for (const tool of ["write", "fs_write", "write_file", "str_replace", "execute_bash", "shell"]) {
    const decision = fenceDecision({hook_event_name: "preToolUse", cwd, tool_name: tool,
      tool_input: {command: "create", path: "src/game/contest-fence-probe.txt", file_text: "probe"}});
    assert.equal(decision.allow, false, `${tool}: ${decision.reason}`);
  }
  const real = fenceDecision({hook_event_name: "preToolUse", cwd, tool_name: "fs_write",
    tool_input: {command: "str_replace", path: ".kiro/specs/duel-card-pipeline/cards/gunslinger.json"}});
  assert.equal(real.allow, false, real.reason);
});
