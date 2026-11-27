// Offline verification for Devpost 3:2 gallery PNGs and official Kiroween rules Q&A (DGR-1..DGR-6).
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {HEIGHT, SHOTS, WIDTH, readPngDimensions, verifyGalleryManifest} from "../../scripts/capture-devpost-gallery.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const GUIDE = readFileSync(join(ROOT, "docs/submission/devpost-form-qa-and-gallery.md"), "utf8");
const NARRATION = readFileSync(join(ROOT, "docs/submission/judge-demo-narration.md"), "utf8");

test("DGR-1 & DGR-2: all 5 Devpost gallery PNGs exist at 1200x800 (3:2) and match manifest SHA-256 digests", () => {
  const verdict = verifyGalleryManifest("docs/evidence/devpost-gallery", ROOT);
  assert.equal(verdict.ok, true, verdict.problems.join("; "));
  assert.equal(verdict.images.length, 5);
  for (const img of verdict.images) {
    assert.equal(img.width, WIDTH);
    assert.equal(img.height, HEIGHT);
    assert.ok(img.bytes >= 20_000);
  }
  assert.equal(readPngDimensions(Buffer.from("not-a-png")), null);
});

test("DGR-3: form Q&A guide answers all 8 official Kiroween topics and their sub-questions", () => {
  for (let i = 1; i <= 8; i += 1) {
    assert.match(GUIDE, new RegExp(`^### Topic ${i}:`, "m"), `missing Topic ${i}`);
  }
  assert.match(GUIDE, /How did they differ when used together\?/);
  assert.match(GUIDE, /Which Kiro app did you try them in\?/);
  assert.match(GUIDE, /What did MCP enable that otherwise would have been difficult or impossible\?/);
  assert.match(GUIDE, /Did PBT help catch any issues you might have missed with unit tests\?/);
  assert.match(GUIDE, /No third-party registry Power was used\./);
});

test("DGR-4: personal builder reflection prompts are preserved as explicit [OWNER] placeholders", () => {
  assert.match(GUIDE, /How did this compare to vibe coding\?[\s\S]*?\[OWNER/);
  assert.match(GUIDE, /Was there a particular strategy that made the biggest difference\?[\s\S]*?\[OWNER/);
  assert.match(GUIDE, /#KiroweenHackathon26/);
});

test("DGR-5: pre-existing work and third-party asset disclosure template is included", () => {
  assert.match(GUIDE, /## 3\. Pre-Existing Work & Third-Party Asset Disclosure/);
  assert.match(GUIDE, /Three\.js 0\.185\.1/);
  assert.match(GUIDE, /fast-check 4\.11\.0/);
  assert.match(GUIDE, /October 30, 2026/);
});

test("DGR-6: 1:20 demo narration is free of third-party AI/browser trademarks and all 5 gallery files are linked", () => {
  const nov26Cut = NARRATION.split("## Earlier 1:59 cut")[0];
  for (const forbidden of ["Fable", "Codex", "Claude", "ChatGPT", "Chrome"]) {
    assert.equal(new RegExp(`\\b${forbidden}\\b`, "i").test(nov26Cut), false, `1:20 narration mentions ${forbidden}`);
  }
  for (const shot of SHOTS) {
    assert.ok(GUIDE.includes(`../evidence/devpost-gallery/${shot.file}`), `missing link for ${shot.file}`);
  }
});
