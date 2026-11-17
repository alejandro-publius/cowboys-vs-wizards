// Offline link check: every relative link and image in the tracked Markdown
// files must point at a file or folder that exists. No network, no
// dependency; web addresses and same-page anchors are skipped, and a
// #fragment is not checked against headings. Usage, from the project root:
//   node scripts/check-links.mjs
// Prints each broken link as file:line -> target and exits 1 if there is one.
import {execFileSync} from "node:child_process";
import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

// [text](target), ![alt](target) and "[label]: target" definitions. A target
// may be wrapped in <> and followed by a "title".
// Matching from "](" also catches the outer link of [![image](a)](b).
const INLINE = /\]\(\s*(<[^>]*>|[^)\s]+)/g;
const DEFINITION = /^\s{0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)/;

export function linksIn(markdown) {
  const found = [];
  let fence = null;
  markdown.split("\n").forEach((text, index) => {
    const mark = /^\s*(```|~~~)/.exec(text)?.[1];
    if (mark && (fence === null || fence === mark)) {
      fence = fence === null ? mark : null;
      return;
    }
    if (fence !== null) return;
    const line = text.replace(/`[^`]*`/g, ""); // inline code is not a link
    const targets = [...line.matchAll(INLINE)].map((match) => match[1]);
    const definition = DEFINITION.exec(line);
    if (definition) targets.push(definition[1]);
    for (const target of targets) found.push({line: index + 1, target: target.replace(/^<|>$/g, "")});
  });
  return found;
}

// The path a relative target names, from the project root, or null when the
// target is a web address, another scheme or a same-page anchor.
export function targetPath(file, target) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//") || target.startsWith("#")) return null;
  let clean = target.split("#")[0].split("?")[0];
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // keep the text as written
  }
  return clean.startsWith("/") ? clean.slice(1) : path.posix.join(path.posix.dirname(file), clean);
}

export function checkLinks() {
  const files = execFileSync("git", ["ls-files", "-z", "--", "*.md"], {cwd: root, encoding: "utf8"}).split("\0").filter(Boolean).sort();
  let links = 0;
  const broken = [];
  for (const file of files) {
    for (const {line, target} of linksIn(readFileSync(path.join(root, file), "utf8"))) {
      const to = targetPath(file, target);
      if (to === null) continue;
      links += 1;
      if (!existsSync(path.join(root, to))) broken.push({file, line, target});
    }
  }
  return {files: files.length, links, broken};
}

if (import.meta.main) {
  const {files, links, broken} = checkLinks();
  for (const {file, line, target} of broken) console.log(`${file}:${line} -> ${target}`);
  console.log(`${files} Markdown files, ${links} relative links and images, ${broken.length} broken`);
  process.exit(broken.length ? 1 : 0);
}
