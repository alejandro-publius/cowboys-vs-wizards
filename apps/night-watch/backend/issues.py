"""Opt-in GitHub issue publication for Night Watch findings.

One issue per finding key, labelled `kiro`. Titles and bodies are built from the
receipt's recomputed numbers and commits only. Text read back from GitHub is
compared with the marker string and never placed in a command. `gh` is run with
an argument list, never through a shell.
"""

import json
import os
import re
import subprocess
import tempfile

import lean

LABEL = "kiro"
LEDGER = "published.json"
SLUG = re.compile(r"[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9][A-Za-z0-9_.-]*")
TIMEOUT = 30


class PublishError(Exception):
    """Publication stopped. Nothing further is posted."""


def marker(key):
    return "<!-- night-watch-finding:%s -->" % key


def _pct(value):
    return "n/a" if value is None else "%.2f%%" % value


def _ci(metric):
    return "n/a" if not metric["ci95"] else "%.2f-%.2f%%" % tuple(metric["ci95"])


def issue_body(receipt, finding):
    cand, base, seeds = receipt["candidate"], receipt["baseline"], receipt["seeds"]
    measured, samples = receipt["measured"]["candidate"], receipt["samples"]["candidate"]
    lines = [
        "Night Watch finding from a fixed-seed CPU vs. CPU run. These are estimates for this bot and seed range,"
        " not human play.",
        "",
        "- Kind: %s" % finding["kind"],
        "- Candidate: %s" % cand["commit"],
        "- Baseline: %s%s" % (base["commit"], " (same commit)" if receipt["sameCommit"] else ""),
        "- Mode: %s; bot: %s" % (receipt["mode"], receipt["bot"]),
        "- Seeds: %d-%d, %d deals x %d = %d games" % (
            seeds["from"], seeds["to"], seeds["deals"], seeds["gamesPerDeal"], seeds["games"]),
        "- Candidate counts: %d Cowboy, %d Wizard, %d draws; %d first-player wins, %d second-player wins" % (
            samples["cowboy"], samples["wizard"], samples["draw"], samples["first"], samples["second"]),
        "- First-player share: %s (95%% CI %s, n=%d decisive)" % (
            _pct(measured["firstPlayer"]["share"]), _ci(measured["firstPlayer"]), measured["firstPlayer"]["decisive"]),
        "- Cowboy share: %s (95%% CI %s, n=%d decisive)" % (
            _pct(measured["cowboy"]["share"]), _ci(measured["cowboy"]), measured["cowboy"]["decisive"]),
    ]
    if receipt["band"]:
        lines.append("- Target band: %g-%g%% (operator-configured, not an approved design target)" % (
            receipt["band"]["low"], receipt["band"]["high"]))
    lines.append("- Lean verdict: %s; shift verdict: %s (threshold %g pp)" % (
        receipt["lean"]["verdict"], receipt["shift"]["state"], receipt["shift"]["threshold"]))
    lines.append("- Per-card data: not measured")
    lines += ["", "Reproduce:", ""]
    lines += ["    " + command for command in receipt["commands"]]
    lines += ["", marker(finding["key"])]
    return "\n".join(lines) + "\n"


def plan(receipt):
    """Recompute the findings from the counts, then draft one issue per finding."""
    try:
        found = lean.recheck(receipt)
    except (KeyError, TypeError, ValueError) as error:
        raise PublishError("The receipt was not accepted: %s" % error)
    return [{"key": f["key"], "title": f["title"], "body": issue_body(receipt, f)} for f in found]


def read_ledger(folder):
    try:
        with open(os.path.join(folder, LEDGER), encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except ValueError:
        raise PublishError("The publication ledger %s is damaged. Move it aside first." % os.path.join(folder, LEDGER))


def write_ledger(folder, ledger):
    handle, temp = tempfile.mkstemp(dir=folder, prefix=LEDGER + ".", suffix=".tmp")
    with os.fdopen(handle, "w", encoding="utf-8") as out:
        json.dump(ledger, out, indent=2, sort_keys=True)
        out.write("\n")
    os.replace(temp, os.path.join(folder, LEDGER))


def gh_env():
    env = {"GH_PROMPT_DISABLED": "1", "NO_COLOR": "1", "LC_ALL": "C.UTF-8"}
    for key in ("PATH", "HOME", "TMPDIR", "GH_TOKEN", "GITHUB_TOKEN", "GH_CONFIG_DIR"):
        if os.environ.get(key):
            env[key] = os.environ[key]
    return env


def run_gh(gh, args, run=subprocess.run):
    try:
        result = run([gh] + args, env=gh_env(), stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=TIMEOUT)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise PublishError("gh could not complete %s (%s)." % (args[:2], type(error).__name__))
    if result.returncode != 0:
        raise PublishError("gh %s failed: %s" % (" ".join(args[:2]), (result.stderr or "").strip()[-400:]))
    return result.stdout


def open_issue_with_marker(gh, slug, key, number, run):
    """Return the issue number when an open issue holds this finding's marker."""
    if number is not None:
        data = json.loads(run_gh(gh, ["issue", "view", str(number), "--repo", slug, "--json", "number,state,body"], run))
        if data.get("state") == "OPEN" and marker(key) in (data.get("body") or ""):
            return data["number"]
    found = json.loads(run_gh(gh, ["issue", "list", "--repo", slug, "--label", LABEL, "--state", "open",
                                   "--search", key + " in:body", "--json", "number,body", "--limit", "20"], run))
    for item in found:
        if marker(key) in (item.get("body") or ""):
            return item["number"]
    return None


def publish(receipt, slug, folder, gh=None, dry_run=True, run=subprocess.run):
    """Dry run (default) or create one labelled issue per new finding. Returns one result per finding."""
    if not isinstance(slug, str) or not SLUG.fullmatch(slug):
        raise PublishError("Name the GitHub repository as owner/name.")
    drafts = plan(receipt)
    ledger = read_ledger(folder)
    results = []
    for draft in drafts:
        entry = ledger.get(slug + "#" + draft["key"])
        known = entry.get("number") if isinstance(entry, dict) else None
        if dry_run:
            results.append({"key": draft["key"], "title": draft["title"], "body": draft["body"],
                            "action": "would-check-then-create", "ledgerIssue": known})
            continue
        if not gh:
            raise PublishError("Install the GitHub CLI (gh) and sign in to publish.")
        number = open_issue_with_marker(gh, slug, draft["key"], known, run)
        if number is not None:
            results.append({"key": draft["key"], "title": draft["title"], "action": "exists", "number": number})
            ledger[slug + "#" + draft["key"]] = {"number": number}
            write_ledger(folder, ledger)
            continue
        handle, body_file = tempfile.mkstemp(prefix="night-watch-issue-", suffix=".md")
        try:
            with os.fdopen(handle, "w", encoding="utf-8") as out:
                out.write(draft["body"])
            output = run_gh(gh, ["issue", "create", "--repo", slug, "--title", draft["title"],
                                 "--label", LABEL, "--body-file", body_file], run)
        finally:
            os.remove(body_file)
        created = re.search(r"https://github\.com/" + re.escape(slug) + r"/issues/(\d+)", output)
        if not created:
            raise PublishError("gh did not report the new issue's address. Check the repository before retrying.")
        number = int(created.group(1))
        ledger[slug + "#" + draft["key"]] = {"number": number}
        write_ledger(folder, ledger)
        results.append({"key": draft["key"], "title": draft["title"], "action": "created", "number": number})
    return results
