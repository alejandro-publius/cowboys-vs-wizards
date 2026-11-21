// The showdown-presenter Kiro agent denies its own write tools on Fable's src/game/showdown/rules.js.
// Native trial receipts: docs/evidence/showdown-presenter-guard.md. Agent-scoped only, not a security boundary.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const agent = JSON.parse(readFileSync(new URL("../../.kiro/agents/showdown-presenter.json", import.meta.url), "utf8"));
const rules = agent.permissions.rules;

test("showdown-presenter denies fs_write on exactly src/game/showdown/rules.js", () => {
  const denies = rules.filter((rule) => rule.effect === "deny");
  assert.deepEqual(denies, [{capability: "fs_write", match: ["src/game/showdown/rules.js"], effect: "deny"}]);
});

test("showdown-presenter allows no shell command naming rules.js and no fs_write over src/", () => {
  for (const rule of rules.filter((r) => r.effect === "allow")) {
    for (const pattern of rule.match) {
      assert.ok(!pattern.includes("rules.js"), pattern);
      if (rule.capability === "fs_write") assert.ok(!pattern.startsWith("src/"), pattern);
    }
  }
});
