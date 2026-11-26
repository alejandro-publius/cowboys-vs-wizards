// The docs index (docs/README.md) lists everything directly in docs/, no
// relative Markdown link in the repository points at a missing file, and no
// #fragment on a link to a Markdown page names a heading that is not there.
import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {anchorsIn, checkLinks, fragmentOf, linksIn, targetPath} from "../../scripts/check-links.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

// Links that were already broken when this check was added, as "file -> target".
// Keep historical exceptions explicit if a source truly must stay untouched.
const KNOWN_BROKEN = [];

test("links: the parser finds links, images and definitions, and skips code", () => {
  const found = linksIn("[a](gone.md) ![i](<my pic.png> \"t\") `[no](code.md)`\n```\n[no](fence.md)\n```\n[![b](in.png)](out.md#h)\n[ref]: ../up.md");
  assert.deepEqual(found.map(({target}) => target), ["gone.md", "my pic.png", "in.png", "out.md#h", "../up.md"]);
  assert.equal(targetPath("docs/a.md", "../up.md#h"), "up.md");
  assert.equal(targetPath("docs/a.md", "sub/x%20y.md?z=1"), "docs/sub/x y.md");
  for (const skipped of ["https://example.com/a.md", "mailto:a@example.com", "#top"]) assert.equal(targetPath("docs/a.md", skipped), null);
});

test("links: destinations preserve parentheses and escaped punctuation", () => {
  const found = linksIn(String.raw`[plan](plan(v2).md) ![map](images/map((old)).png "title") [escaped](plan\(v2\).md)` + "\n[ref]: plan(v2).md");
  assert.deepEqual(found.map(({target}) => target), ["plan(v2).md", "images/map((old)).png", "plan(v2).md", "plan(v2).md"]);
});

test("links: code delimiter lengths do not hide real links or expose code examples", () => {
  const cases = [
    "    [example](missing.md)\n[real](README.md)",
    "\t[example](missing.md)\n[real](README.md)",
    "````markdown\n```\n[example](missing.md)\n````\n[real](README.md)",
    "~~~~markdown\n~~~\n[example](missing.md)\n~~~~~\n[real](README.md)",
    "``[example](missing.md)`` [real](README.md)",
    "``one ` tick [example](missing.md)`` [real](README.md)",
  ];
  for (const markdown of cases) assert.deepEqual(linksIn(markdown).map(({target}) => target), ["README.md"], markdown);
  assert.deepEqual(linksIn("an unmatched ` [real](README.md)").map(({target}) => target), ["README.md"]);
  for (const markdown of ["Paragraph\n    [real](README.md)", "- List item\n\n    [real](README.md)", "- List item\n    - [real](README.md)"]) {
    assert.deepEqual(linksIn(markdown).map(({target}) => target), ["README.md"], markdown);
  }
});

test("links: anchors follow GitHub's heading slugs, repeats and explicit anchors, and skip code", () => {
  const anchors = anchorsIn([
    "# Release line and scoreboard",
    "## Fable’s answer: the `npm test` [run](x.md) (Nov. 19)!",
    "## Repeat",
    "## Repeat",
    "### _Emphasis_ and **bold**",
    "```",
    "## Not a heading",
    "```",
    "    ## Indented code",
    "Text with <a id=\"custom-spot\"></a> in it",
    "Setext title",
    "============",
    "#hashtag is not a heading",
  ].join("\n"));
  for (const expected of ["release-line-and-scoreboard", "fables-answer-the-npm-test-run-nov-19", "repeat", "repeat-1",
    "emphasis-and-bold", "custom-spot", "setext-title"]) assert.ok(anchors.has(expected), expected);
  for (const absent of ["not-a-heading", "indented-code", "hashtag-is-not-a-heading"]) assert.ok(!anchors.has(absent), absent);
  assert.equal(fragmentOf("a.md#Part-2"), "Part-2");
  assert.equal(fragmentOf("a.md#caf%C3%A9"), "café");
  for (const none of ["a.md", "a.md#", "x.js#L12", "x.js#L3-L9"]) assert.equal(fragmentOf(none), null, none);
});

test("links: every relative link and image in tracked Markdown points at something that exists", () => {
  const {files, links, broken} = checkLinks();
  assert.ok(files > 0 && links > 0, "found Markdown files and links to check");
  const found = broken.map(({file, target}) => `${file} -> ${target}`);
  assert.deepEqual(found.filter((each) => !KNOWN_BROKEN.includes(each)), [], "new broken links");
  assert.deepEqual(KNOWN_BROKEN.filter((each) => !found.includes(each)), [], "allow-list entries that are no longer broken");
});

test("links: docs/README.md lists every file and folder directly in docs/", () => {
  const tracked = execFileSync("git", ["ls-files", "-z", "--", "docs"], {cwd: root, encoding: "utf8"}).split("\0").filter(Boolean);
  const entries = new Set(tracked.map((file) => {
    const [, name, ...rest] = file.split("/");
    return rest.length ? `${name}/` : name;
  }));
  entries.delete("README.md");
  const listed = new Set(linksIn(readFileSync(new URL("../../docs/README.md", import.meta.url), "utf8")).map(({target}) => target));
  assert.deepEqual([...entries].filter((entry) => !listed.has(entry)).sort(), [], "in docs/ but missing from docs/README.md");
});
