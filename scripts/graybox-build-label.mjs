// The public build label the graybox page carries (K-087): the first 12 hex characters of the git
// commit it was built from, plus "+local" when that checkout had uncommitted changes to the files
// the page is built from. It is the same commit scripts/write-build-identity.mjs puts in build.json
// for a Pages release. No user, device, time or path goes into it. Without git (an exported source
// tree) it is null, and the page says its build is not identified rather than guessing one.
import {execFileSync} from "node:child_process";

export const BUILD_LABEL_PATTERN = /^[0-9a-f]{12}(\+local)?$/;
// What the graybox page is built from (scripts/build-graybox.mjs): its sources, the build script and the locked dependencies.
const INPUTS = ["src", "scripts/build-graybox.mjs", "scripts/graybox-build-label.mjs", "package.json", "package-lock.json"];

export function grayboxBuildLabel(cwd) {
  const git = (...args) => execFileSync("git", args, {cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]}).trim();
  let commit, dirty;
  try {
    commit = git("rev-parse", "HEAD");
    dirty = git("status", "--porcelain", "--", ...INPUTS) !== "";
  } catch { return null; }
  if (!/^[0-9a-f]{40}$/.test(commit)) return null;
  return `${commit.slice(0, 12)}${dirty ? "+local" : ""}`;
}
