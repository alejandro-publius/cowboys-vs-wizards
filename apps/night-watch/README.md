# Night Watch

Night Watch runs inside the Kiro Crew dashboard. Compare Cowboys vs. Wizards revisions on the same CPU match seeds, see faction and starting-seat win shares, and draft a GitHub issue when a run crosses the alert threshold or fails a check.

## Verify the standalone extension

Run the small dependency-free Python tests from the **repository root** before integrating changes to Night Watch:

~~~sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s apps/night-watch/backend -p 'test_*.py' -v
node --check apps/night-watch/ui/index.mjs
~~~

The checks cover configuration boundaries, alert thresholds and isolated report storage. They do not substitute for a full Crew browser installation or a scheduled-job run.

## Install

Use Kiro Crew 0.12.2 or later, Git, Python 3.9 or later, and Node 22.18 or later. Install from this directory on macOS or Linux.

~~~sh
kirocrew app install "$PWD"
~~~

In Crew’s Library, find **Night Watch**, review its install source and enable it. If Crew asks for execution trust, choose **Trust this app alone**. Open **Night Watch** in Crew. Under **Settings**, enter the absolute path to a local Cowboys vs. Wizards checkout. Choose baseline and candidate branches, tags or commits that contain the playable engine. Use a fixed baseline and a working branch as the candidate to track new commits. Save the settings and choose **Run balance check**.

Choose a **Mode**. **Showdown** plays each deal twice, once with each faction moving first, through the commit's `prototypes/showdown/rules.js` and its level-2 bot, the same loop as `prototypes/showdown/sim.mjs`. Its report shows the first-player share and the Cowboy share over all games (two per deal). **Lane duel** runs `scripts/simulate-matches.mjs` as before.

Night Watch resolves the refs to commits, runs the candidate's game-rule tests and replays the chosen seed range for both commits. It tests the committed code from the checkout on this computer. Reports show the exact revisions, seed range, outcome shifts and any card-spec changes. The app keeps the 20 latest reports.

The defaults compare seeds 0–999 (deals in Showdown) and flag a faction win-share shift of at least 10 percentage points or a first-seat advantage that grows by at least that much. Results describe these CPU policies and seeds. A rules failure is recorded with diagnostic output. When the checkout has a GitHub origin, eligible reports include an **Open GitHub issue draft** link with the run details.

## Target band (lean) and receipts

The shift check above is relative: it compares the candidate with the baseline. A lean check is absolute: it compares the candidate's first-player share and Cowboy share (over decisive games) with a **target band** you set, for example 45–55%. It runs even when baseline and candidate are the same commit. No design target has been approved, so the band is empty by default and the lean verdict reads `unconfigured`.

Each share carries a Wilson 95% interval and its sample size. A metric is `within` when its whole interval lies inside the band, `lean` (toward first/second or cowboy/wizard) when its whole interval lies outside, and `inconclusive` otherwise. Games are treated as independent, an approximation, since each Showdown deal is played from both seats. No per-card data is measured.

Every report stores a `night-watch-receipt/1` object under `receipt`: full commit SHAs, the rules blob, seed range, raw two-seat counts, shares and intervals, band, lean and shift verdicts, runner hash and commands that reproduce the counts. For a one-off check that leaves the saved settings and history alone:

~~~sh
python3 backend/server.py evaluate --repo /path/to/checkout --candidate origin/main \
  --first-seed 0 --count 1000 --band-low 45 --band-high 55 --out receipt.json
~~~

## Publish findings as GitHub issues (opt-in)

~~~sh
python3 backend/server.py issues --receipt receipt.json            # dry run: prints each draft
python3 backend/server.py issues --receipt receipt.json --publish  # creates issues with gh
~~~

`--report latest` (or a report id) reads a stored report instead of a file. Each finding (a lean metric or a shift alert) becomes at most one issue labelled `night-watch`. Night Watch finds it again by the `<!-- night-watch-finding:KEY -->` marker in any state. An open issue is reused. A closed issue that also holds the same `<!-- night-watch-rules:BLOB -->` marker counts as resolved and is not filed again, so retries and closed findings never duplicate. Only a lean that persists after the rules file changed opens a new issue. The lean key leaves out the commit, so a lean that persists across commits keeps one issue. Night Watch recomputes the verdicts from the receipt's counts before drafting, builds titles and bodies from those numbers only, and runs `gh` with an argument list. The repository must already have a `night-watch` label.

Night Watch never uses the `kiro` label or a `/kiro` line, which assign Kiro Web ([docs](https://kiro.dev/docs/web/github/)). It never reads, comments on or edits an issue after filing it, so a filed issue cannot start an agent or another run.

### Scheduled issues (opt-in project setting)

The scheduled job is read-only by default (`autoIssues: "off"`). Set **Scheduled issues** to *One issue per reproduced out-of-band lean* (`autoIssues: "lean"`, which needs Showdown mode and a target band) to let each scheduled run file issues. Optionally set **Issue repository** (`issueRepo`, owner/name). Then, after each scheduled run:

1. Only lean findings count (the whole 95% interval outside the band). Shift alerts stay as draft links.
2. The Night Shift reviewer re-runs the finding's counts from a fresh `git archive` snapshot: `node scripts/night-review.mjs check --finding <report>` in this app's checkout, with a 120 s limit. If the reviewer is missing, times out or gets different counts, nothing is filed.
3. At most two issues per run, deduplicated as above. The run's report records the outcome under `publication`.

Choosing a card and a number, and any change to cards or rules, stays with Fable/Alex through `node scripts/night-review.mjs run …` (see `docs/evidence/night-shift-review.md`). Nothing is merged automatically.

## Schedule a nightly check

Save the settings and verify one manual run first. From this app directory, register a Kiro Crew command job.

~~~sh
python3 backend/server.py schedule --time 02:00 --timezone America/Los_Angeles
~~~

The job runs `server.py run --scheduled --mode showdown`, so nightly checks play Showdown whatever mode the manual settings hold. It files issues only when Scheduled issues is on (see above). Run `python3 backend/server.py run --mode lanes` for a one-off lane comparison.

Crew runs the scheduled command locally. It records a report in the same history as manual runs, with **Scheduled** as the trigger. Manage the job in Crew’s **Schedule** panel. To remove it from the terminal, use this command.

~~~sh
python3 backend/server.py schedule --remove
~~~

The app and job share the local Night Watch data directory. Keep the computer and Crew running for scheduled checks. Reload Night Watch to load reports created by the schedule. The checkout and its Git refs must remain accessible to the computer running Crew. The scheduled command does not fetch remote refs; fetch the checkout when you want origin/main to reflect newer published commits. The NIGHT_WATCH_NODE environment variable can select an absolute Node executable when the launcher uses a different PATH.
