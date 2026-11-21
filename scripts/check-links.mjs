// Offline link check: every relative link and image in the tracked Markdown
// files must point at a file or folder that exists, and a #fragment on a link
// to a Markdown page (or a same-page #fragment) must name one of that page's
// headings or explicit anchors, as GitHub renders them. No network, no
// dependency; web addresses are skipped. Usage, from the project root:
//   node scripts/check-links.mjs
// Prints each broken link as file:line -> target and exits 1 if there is one.
import {execFileSync} from "node:child_process";
import {existsSync, readFileSync, statSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

// [text](target), ![alt](target) and "[label]: target" definitions. A target
// may be wrapped in <> and followed by a "title".
// Matching from "](" also catches the outer link of [![image](a)](b).
const INLINE = /\]\(\s*/g;
const DEFINITION = /^ {0,3}\[[^\]]+\]:\s*/;

// A destination may contain balanced parentheses, or escaped punctuation.
// The outer ')' ends an inline link; it is not part of the destination.
function destinationAt(line, start) {
  let target = "", depth = 0;
  const angle = line[start] === "<";
  for (let i = start + Number(angle); i < line.length; i += 1) {
    const char = line[i];
    if (char === "\\" && /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(line[i + 1] ?? "")) {
      target += line[++i];
      continue;
    }
    if (angle) {
      if (char === ">") return target;
    } else {
      if (/\s/.test(char) || (char === ")" && depth === 0)) return target;
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
    }
    target += char;
  }
  return angle || depth !== 0 ? null : target;
}

// Code spans end at a run of exactly the same number of backticks.
// A lone, unmatched run is ordinary text, not the rest of the line as code.
function withoutCodeSpans(line) {
  const runs = [...line.matchAll(/`+/g)];
  let result = "", cursor = 0;
  for (let i = 0; i < runs.length; i += 1) {
    const start = runs[i];
    const closing = runs.findIndex((run, j) => j > i && run[0].length === start[0].length);
    if (closing < 0) continue;
    const end = runs[closing].index + runs[closing][0].length;
    result += line.slice(cursor, start.index) + " ".repeat(end - start.index);
    cursor = end;
    i = closing;
  }
  return result + line.slice(cursor);
}

export function linksIn(markdown) {
  const found = [];
  let fence = null;
  let paragraph = false, indentedCode = false, listIndent = null;
  markdown.split("\n").forEach((text, index) => {
    const mark = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
    if (fence !== null) {
      if (mark && mark[1][0] === fence[0] && mark[1].length >= fence.length && /^\s*$/.test(mark[2])) {
        fence = null;
        paragraph = false;
      }
      return;
    }
    if (mark && (mark[1][0] !== "`" || !mark[2].includes("`"))) {
      fence = mark[1];
      return;
    }
    if (!text.trim()) {
      paragraph = false;
      return;
    }
    const indent = text.match(/^[ \t]*/)[0].replace(/\t/g, "    ").length;
    const list = /^[ \t]*(?:[-+*]|\d+[.)])[ \t]+/.exec(text);
    if (list) listIndent = list[0].replace(/\t/g, "    ").length;
    else if (listIndent !== null && indent < listIndent) listIndent = null;
    // Four-space list contents and paragraph continuations are still prose.
    indentedCode = !list && indent >= (listIndent ?? 0) + 4 && (!paragraph || indentedCode);
    if (indentedCode) return;
    paragraph = true;
    const line = withoutCodeSpans(text);
    const targets = [...line.matchAll(INLINE)].map((match) => destinationAt(line, match.index + match[0].length));
    const definition = DEFINITION.exec(line);
    if (definition) targets.push(destinationAt(line, definition[0].length));
    for (const target of targets) if (target !== null) found.push({line: index + 1, target});
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

// The anchors GitHub gives a Markdown page: one per heading (the rendered text in
// lower case, punctuation removed while letters, digits, marks, "_", "-" and
// spaces stay, each space made a hyphen; a repeated heading gets -1, -2 and so
// on), plus explicit id="…" or name="…" anchors in HTML. Fenced code is skipped.
export function anchorsIn(markdown) {
  const anchors = new Set(), seen = new Map();
  const add = (heading) => {
    const slug = heading
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
      .replace(/<[^>]*>/g, "")
      .replace(/(^|[^\p{L}\p{N}])_+([^_]+?)_+(?=[^\p{L}\p{N}]|$)/gu, "$1$2")
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}_\- ]/gu, "")
      .replace(/ /g, "-");
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    anchors.add(count ? `${slug}-${count}` : slug);
  };
  let fence = null, previous = "";
  for (const text of markdown.split("\n")) {
    const mark = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
    if (fence !== null) {
      if (mark && mark[1][0] === fence[0] && mark[1].length >= fence.length && /^\s*$/.test(mark[2])) fence = null;
      previous = "";
      continue;
    }
    if (mark && (mark[1][0] !== "`" || !mark[2].includes("`"))) {
      fence = mark[1];
      previous = "";
      continue;
    }
    for (const match of withoutCodeSpans(text).matchAll(/<[a-z][a-z0-9]*\s[^>]*?\b(?:id|name)\s*=\s*["']([^"']+)["']/gi)) anchors.add(match[1]);
    const atx = /^ {0,3}#{1,6}(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/.exec(text);
    if (atx) add((atx[1] ?? "").trim());
    // A setext heading: a paragraph line underlined with = or -.
    else if (/^ {0,3}(=+|-+)[ \t]*$/.test(text) && previous.trim() && !/^ {0,3}(#|[-+*][ \t]|\d+[.)][ \t]|>|\|)/.test(previous)) add(previous.trim());
    previous = atx ? "" : text;
  }
  return anchors;
}

// The #fragment a link asks for, or null when it has none or names source lines (#L12, #L3-L9).
export function fragmentOf(target) {
  const at = target.indexOf("#");
  if (at < 0 || at === target.length - 1) return null;
  let fragment = target.slice(at + 1);
  try {
    fragment = decodeURIComponent(fragment);
  } catch {
    // keep the text as written
  }
  return /^L\d+(C\d+)?(-L\d+(C\d+)?)?$/.test(fragment) ? null : fragment;
}

// The Markdown page whose anchors a link's fragment is checked against: the target itself, a folder's
// README.md (what GitHub shows for a folder), or null for any other file.
function pageFor(to) {
  const full = path.join(root, to);
  if (statSync(full).isDirectory()) {
    const readme = path.posix.join(to, "README.md");
    return existsSync(path.join(root, readme)) ? readme : null;
  }
  return /\.md$/i.test(to) ? to : null;
}

export function checkLinks() {
  const files = execFileSync("git", ["ls-files", "-z", "--", "*.md"], {cwd: root, encoding: "utf8"}).split("\0").filter(Boolean).sort();
  const pages = new Map();
  const anchorsOf = (page) => {
    if (!pages.has(page)) pages.set(page, anchorsIn(readFileSync(path.join(root, page), "utf8")));
    return pages.get(page);
  };
  let links = 0, anchors = 0;
  const broken = [];
  for (const file of files) {
    for (const {line, target} of linksIn(readFileSync(path.join(root, file), "utf8"))) {
      const samePage = target.startsWith("#");
      const to = samePage ? file : targetPath(file, target);
      if (to === null) continue;
      if (!samePage) {
        links += 1;
        if (!existsSync(path.join(root, to))) {
          broken.push({file, line, target});
          continue;
        }
      }
      const fragment = fragmentOf(target);
      const page = fragment === null ? null : pageFor(to);
      if (page === null) continue;
      anchors += 1;
      const known = anchorsOf(page);
      if (!known.has(fragment) && !known.has(fragment.toLowerCase())) broken.push({file, line, target});
    }
  }
  return {files: files.length, links, anchors, broken};
}

if (import.meta.main) {
  const {files, links, anchors, broken} = checkLinks();
  for (const {file, line, target} of broken) console.log(`${file}:${line} -> ${target}`);
  console.log(`${files} Markdown files, ${links} relative links and images, ${anchors} section anchors, ${broken.length} broken`);
  process.exit(broken.length ? 1 : 0);
}
