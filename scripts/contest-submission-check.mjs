// Offline submission check for the Kiroween entry. Needs Node and Git only.
//
//   node scripts/contest-submission-check.mjs [--json]
//        [--demo <youtube url>] [--site <https url>] [--repo <github url>]
//
// Each item says whether it is "automated" (decided here from local files and
// Git) or "human" (cannot be decided offline: public visibility, video length,
// whether the page plays). Only automated failures make the exit code 1.
// Nothing here fetches a URL; a supplied link is checked for form and for
// presence in README.md only.
import {spawnSync} from "node:child_process";
import {readFileSync, existsSync, realpathSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {BEGIN, END, DOC_FILE, RECEIPT_FILE, parseReceipts, renderInto} from "./contest-usage-lib.mjs";

const LICENSE_NAMES = ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "LICENCE.md", "COPYING", "COPYING.md"];

// Ordered: more specific texts first. `osi` marks OSI-approved licenses.
const LICENSES = [
  {id: "AGPL-3.0", osi: true, all: ["gnu affero general public license", "version 3"]},
  {id: "LGPL-3.0", osi: true, all: ["gnu lesser general public license", "version 3"]},
  {id: "LGPL-2.1", osi: true, all: ["gnu lesser general public license", "version 2.1"]},
  {id: "GPL-3.0", osi: true, all: ["gnu general public license", "version 3"]},
  {id: "GPL-2.0", osi: true, all: ["gnu general public license", "version 2"]},
  {id: "Apache-2.0", osi: true, all: ["apache license", "version 2.0"]},
  {id: "MPL-2.0", osi: true, any: ["mozilla public license version 2.0", "mozilla public license, version 2.0"]},
  {id: "ISC", osi: true, all: ["permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted"]},
  {id: "MIT", osi: true, all: ["permission is hereby granted, free of charge, to any person obtaining a copy", "the software is provided \"as is\""]},
  {id: "BSD-3-Clause", osi: true, all: ["redistribution and use in source and binary forms", "neither the name"]},
  {id: "BSD-2-Clause", osi: true, all: ["redistribution and use in source and binary forms"]},
  {id: "Unlicense", osi: true, all: ["this is free and unencumbered software released into the public domain"]},
  {id: "CC0-1.0", osi: false, all: ["cc0 1.0 universal"]},
];

export function recognizeLicense(text) {
  const t = String(text).toLowerCase().replace(/[\u201c\u201d]/g, "\"").replace(/\s+/g, " ");
  for (const l of LICENSES) {
    if ((l.all && l.all.every((s) => t.includes(s))) || (l.any && l.any.some((s) => t.includes(s)))) return {id: l.id, osi: l.osi};
  }
  return null;
}

// Form checks only. Returns null when the URL is acceptable, else a reason.
export function linkProblem(kind, value) {
  let url;
  try { url = new URL(value); } catch { return "not a URL"; }
  if (url.protocol !== "https:") return "must use https";
  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (kind === "demo") {
    const id = host === "youtu.be" ? url.pathname.slice(1)
      : host === "youtube.com" ? (url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? "")
      : null;
    if (id === null) return "not a YouTube host";
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return "no YouTube video ID";
  }
  if (kind === "repo") {
    if (host !== "github.com") return "not a github.com URL";
    if (!/^\/[^/]+\/[^/]+\/?$/.test(url.pathname.replace(/\.git$/, ""))) return "not an owner/repo URL";
  }
  return null;
}

function parseArgs(argv) {
  const opts = {json: false, demo: null, site: null, repo: null};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (["--demo", "--site", "--repo"].includes(a)) opts[a.slice(2)] = argv[++i] ?? "";
    else throw new Error(`unknown argument: ${a}`);
  }
  return opts;
}

function git(root, args) {
  const r = spawnSync("git", args, {cwd: root, encoding: "utf8"});
  return {ok: r.status === 0, status: r.status, out: r.stdout ?? "", err: r.error};
}
const list = (out) => out.split("\0").filter(Boolean);

export function runChecks(root, opts = {}) {
  const items = [];
  const add = (id, kind, status, detail) => items.push({id, kind, status, detail});

  const top = git(root, ["rev-parse", "--show-toplevel"]);
  if (!top.ok) {
    add("git-repo", "automated", "fail", top.err ? "git is not available" : "not inside a Git checkout");
    return items;
  }
  if (realpathSync(top.out.trim()) !== realpathSync(root)) {
    add("git-repo", "automated", "fail", "run from the repository root");
    return items;
  }

  // .kiro/ is tracked, not ignored, and complete.
  const tracked = list(git(root, ["ls-files", "-z", "--", ".kiro"]).out);
  add("kiro-tracked", "automated", tracked.length ? "pass" : "fail",
    tracked.length ? `${tracked.length} tracked files under .kiro/` : "no tracked files under .kiro/");
  const dirIgnored = git(root, ["check-ignore", "-q", "--no-index", ".kiro/"]).status === 0;
  add("kiro-not-ignored", "automated", dirIgnored ? "fail" : "pass",
    dirIgnored ? ".kiro/ matches an ignore rule" : ".kiro/ matches no ignore rule");
  const trackedIgnored = list(git(root, ["ls-files", "-z", "-ci", "--exclude-standard", "--", ".kiro"]).out);
  if (trackedIgnored.length) add("kiro-tracked-but-ignored", "automated", "warn", `${trackedIgnored.length} tracked .kiro files also match ignore rules: ${trackedIgnored.slice(0, 5).join(", ")}`);
  const untracked = list(git(root, ["ls-files", "-z", "-o", "--exclude-standard", "--", ".kiro"]).out);
  add("kiro-untracked", "automated", untracked.length ? "warn" : "pass",
    untracked.length ? `${untracked.length} .kiro files are not committed: ${untracked.slice(0, 5).join(", ")}` : "no uncommitted .kiro files");
  const badJson = tracked.filter((f) => f.endsWith(".json") && existsSync(path.join(root, f))).filter((f) => {
    try { JSON.parse(readFileSync(path.join(root, f), "utf8")); return false; } catch { return true; }
  });
  add("kiro-json", "automated", badJson.length ? "fail" : "pass",
    badJson.length ? `invalid JSON: ${badJson.join(", ")}` : "every tracked .kiro JSON file parses");

  // Root license.
  const licenseFile = LICENSE_NAMES.find((n) => existsSync(path.join(root, n)));
  if (!licenseFile) add("license", "automated", "fail", "no LICENSE or COPYING file at the repository root");
  else {
    const isTracked = git(root, ["ls-files", "--error-unmatch", "--", licenseFile]).ok;
    const known = recognizeLicense(readFileSync(path.join(root, licenseFile), "utf8"));
    const status = !isTracked ? "fail" : !known ? "warn" : known.osi ? "pass" : "warn";
    const what = known ? `recognized as ${known.id}${known.osi ? " (OSI-approved open source)" : " (not an OSI-approved software license)"}` : "license text not recognized; confirm by hand";
    add("license", "automated", status, `${licenseFile} ${isTracked ? "tracked" : "NOT tracked"}; ${what}`);
  }

  // Remote: local fact only. Public visibility is a human check.
  const origin = git(root, ["remote", "get-url", "origin"]);
  const originUrl = origin.ok ? origin.out.trim() : "";
  const onGitHub = /^(https:\/\/|git@|ssh:\/\/git@)github\.com[/:]/.test(originUrl);
  add("remote", "automated", onGitHub ? "pass" : "warn",
    origin.ok ? (onGitHub ? "origin is a github.com remote" : "origin is not a github.com remote") : "no origin remote");

  // Usage page: present, has markers, and every local Stop receipt is rendered.
  const docPath = path.join(root, DOC_FILE);
  if (!existsSync(docPath)) add("usage-doc", "automated", "fail", `${DOC_FILE} missing`);
  else {
    const doc = readFileSync(docPath, "utf8");
    if (!doc.includes(BEGIN) || !doc.includes(END)) add("usage-doc", "automated", "fail", `${DOC_FILE} lacks contest-usage markers`);
    else {
      const rp = path.join(root, RECEIPT_FILE);
      const receipts = existsSync(rp) ? parseReceipts(readFileSync(rp, "utf8")) : [];
      const {added} = renderInto(doc, receipts);
      const rows = (doc.slice(doc.indexOf(BEGIN), doc.indexOf(END)).match(/^\| `[0-9a-f]{16}` \|/gm) ?? []).length;
      add("usage-doc", "automated", added ? "warn" : "pass",
        `${rows} observed rows; ${added ? `${added} local receipts not rendered (run node scripts/contest-usage-render.mjs)` : "no unrendered local receipts"}`);
    }
  }

  // Explicit links: form and README presence are automated; reachability is human.
  const readme = existsSync(path.join(root, "README.md")) ? readFileSync(path.join(root, "README.md"), "utf8") : "";
  for (const kind of ["demo", "site", "repo"]) {
    const value = opts[kind];
    if (value == null) {
      add(`${kind}-link`, "human", "human", `no --${kind} URL supplied; nothing checked`);
      continue;
    }
    const problem = linkProblem(kind, value);
    if (problem) { add(`${kind}-link`, "automated", "fail", `--${kind}: ${problem}`); continue; }
    add(`${kind}-link`, "automated", readme.includes(value) ? "pass" : "fail",
      readme.includes(value) ? `--${kind} URL is well-formed and appears in README.md` : `--${kind} URL is well-formed but not in README.md`);
  }
  const youtube = (readme.match(/https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s)>\]]+/g) ?? []).length;
  add("readme-youtube", "automated", "info", `${youtube} YouTube links found in README.md (counted, not opened)`);

  for (const [id, detail] of [
    ["human-repo-public", "Open the GitHub repository signed out and confirm it is public, with .kiro/ and LICENSE visible."],
    ["human-site-plays", "Open the project URL in a fresh browser and finish one duel."],
    ["human-video", "Watch the YouTube demo signed out: public or unlisted as the rules allow, under three minutes, shows the running game and Kiro use."],
    ["human-writeup", "Read the Kiro write-up and confirm every claim links to a receipt."],
  ]) add(id, "human", "human", detail);
  return items;
}

function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (error) {
    console.error(String(error.message));
    process.exitCode = 2;
    return;
  }
  const items = runChecks(process.cwd(), opts);
  const failed = items.filter((i) => i.kind === "automated" && i.status === "fail");
  if (opts.json) console.log(JSON.stringify({ok: failed.length === 0, items}, null, 2));
  else {
    for (const i of items) console.log(`${i.status.toUpperCase().padEnd(5)} ${i.kind.padEnd(9)} ${i.id}: ${i.detail}`);
    console.log(`${failed.length ? "FAILED" : "OK"}: ${failed.length} automated failures, ${items.filter((i) => i.kind === "human").length} human checks listed`);
  }
  process.exitCode = failed.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
