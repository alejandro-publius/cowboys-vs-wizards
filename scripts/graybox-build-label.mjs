// The public build label the graybox page carries (K-087): the first 12 hex characters of the git
// commit it was built from, plus "+local" when that checkout had uncommitted changes to the files
// the page is built from. It is the same commit scripts/write-build-identity.mjs puts in build.json
// for a Pages release. No user, device, time or path goes into it. Without git (an exported source
// tree) it is null, and the page says its build is not identified rather than guessing one.
import {execFileSync} from "node:child_process";

export const BUILD_LABEL_PATTERN = /^[0-9a-f]{12}(\+local)?$/;
// Shared rules and installed dependency versions can affect every page. Each renderer adds its
// own embedded files, so editing the illustrated title does not mark an offline graybox build.
const COMMON = ["src", "scripts/graybox-build-label.mjs", "package.json", "package-lock.json"];
const CAMP = ["scripts/build-graybox.mjs", "scripts/outrider-gate.mjs", "scripts/outrider-ledger.mjs",
  "experiments/showdown-outrider/decision", "docs/evidence/outrider-gate/receipt.json",
  "docs/evidence/outrider-gate/night-watch-engine.json", "docs/evidence/night-shift/receipt.json", "prototypes/showdown/rules.js"];
const ILLUSTRATIONS = ["assets/cards/showdown-diorama.webp", "assets/scenes/showdown-storybook.webp",
  "assets/scenes/showdown-title.webp", "assets/scenes/showdown-camp.webp"];
const REFERENCE = ["build.mjs", "index.html", "style.css", "main.js", "cards.js", "contract.js", "rules.js",
  "progress.js", "trail.js", "savecode.js"].map((file) => `prototypes/showdown/${file}`);

export function grayboxBuildLabel(cwd, page = "graybox") {
  const inputs = page === "reference" ? REFERENCE : page === "illustrated" ? [...CAMP, ...ILLUSTRATIONS] : CAMP;
  const git = (...args) => execFileSync("git", args, {cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]}).trim();
  let commit, dirty;
  try {
    commit = git("rev-parse", "HEAD");
    dirty = git("status", "--porcelain", "--", ...COMMON, ...inputs) !== "";
  } catch { return null; }
  if (!/^[0-9a-f]{40}$/.test(commit)) return null;
  return `${commit.slice(0, 12)}${dirty ? "+local" : ""}`;
}
