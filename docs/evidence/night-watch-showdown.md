# Night Watch on Showdown: first report (Scout fix pair)

Worker: Kiro CLI, job `nightwatch`, branch `kiro/graywave-nightwatch`, November 19, 2026 (America/Los_Angeles).
Brief: [showdown-integration-kiro-brief.md, item C](../design/showdown-integration-kiro-brief.md#c-night-watch-on-showdown) from #147. No rule, card or bot was changed or retuned.

## What changed

- `apps/night-watch/backend/showdown_sim.mjs` plays every deal twice, once with each faction moving first, using the snapshot's own `prototypes/showdown/rules.js` (`createShowdown(seed, {first})`, then the default `playTurn` level-2 bot for both seats). This is the loop of `prototypes/showdown/sim.mjs` with default options.
- `balance.py` gains a `mode` setting (`showdown` or `lanes`, saved default `lanes`). Showdown shares are divided by games (two per deal). Lane mode is unchanged except that snapshots now include the files the game tests import (`scripts`, `tests`, `src`, `prototypes/showdown`, `docs/evidence/boundary-properties`). Without them, lane mode at `a9aa828` already failed its own rule tests (`screen-cowboy-decks.mjs`, `src/match/clash-forecast.js` and `src/main.js` missing); observed before this change with a 50-seed run.
- Showdown mode also runs `prototypes/showdown/*.test.js` with `tests/game` before simulating.
- The nightly Crew job is registered as `server.py run --scheduled --mode showdown`. `run --mode` overrides the saved mode for one run. The UI has a Mode selector and divides by games in Showdown reports.

## The pair

| | Commit | Source |
|---|---|---|
| Before | `a9aa8280e574bd662405bfe60454db5a81466afd` | main, merge of #147 (base of `kiro/graywave-scout`) |
| After | `3dd47f1fb668f1b42edd72b50c898a0b1e622d74` | `kiro/graywave-scout` code commit, per `../graywave-scout-code.txt` |

The two commits differ only in `src/game/showdown/rules.js` and `tests/game/showdown-fair-bot.test.js`.

## Method

- Deals: seeds 0–999, 1,000 deals, 2,000 games per commit, both seats per deal. Default options (base orbs 5, second player +1 card, turn cap 80).
- Bot: `playTurn(state)` level 2 for both factions. Same deals for both commits.
- Command: `NIGHT_WATCH_DATA_DIR=<tmp> python3 apps/night-watch/backend/server.py run --mode showdown`, after saving the settings above with threshold 10 pp. Node v26.0.0, macOS.
- Candidate rule tests (tests/game plus the Showdown prototype tests): 318 passed.

## Results

| | Games | First-player wins | Cowboy wins | Draws |
|---|---|---|---|---|
| Before `a9aa828` | 2,000 | 1,149 (57.45%) | 1,185 (59.25%) | 0 |
| After `3dd47f1` | 2,000 | 1,142 (57.10%) | 1,188 (59.40%) | 0 |
| Change | | −0.35 pp | +0.15 pp | 0 |

Night Watch verdict: **steady** (no shift reached 10 pp). The lean Fable tunes against remains: about 57% to the first player and 59% to the Cowboys under this bot and these deals. These are estimates for this bot and seed range only.

Reproducibility: the comparison was run twice (reports `c7aee59425e7` at 21:42 PST and `fa15c87e1701` at 21:43 PST); all counts were identical. A cross-check with the prototype script gave the same shares: `node prototypes/showdown/sim.mjs 1000` printed 57.5% / 59.3% at `a9aa828` (this checkout) and 57.1% / 59.4% in the Scout worktree (code identical to `3dd47f1`, plus one docs commit).

Lane regression on the same pair (`--mode lanes`, seeds 0–999, CPU vs CPU, report `201574dcbf32`): candidate rule tests passed (265); both commits gave 424 Cowboy, 462 Wizard and 114 draws, as expected, since the Scout change touches only Showdown.

Raw records: [night-watch-showdown/scout-pair-reports.json](night-watch-showdown/scout-pair-reports.json).

## Checks run

- `python3 -m unittest test_night_watch -v` in `apps/night-watch/backend`: 12 passed (7 existing, 5 new Showdown tests: mode validation, both-seat parsing, games denominator, nightly command, and a runner fixture through an extracted snapshot).
- `node --check apps/night-watch/ui/index.mjs`: passed.

## Not done

- No scheduled Crew job was registered or triggered on this machine; the nightly command is covered by a unit test only.
- The Crew UI was not opened in a browser.

### Installed Night Watch dashboard

Kiro updated the existing Crew app from the [standalone mirror candidate](https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch/pull/1) at `bb37f6f9720e8710e62ec656d8d4102768f68207`. Ten shipped files matched the [canonical game source](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/171) by Git blob and file mode. The standalone Python suite passed all 29 tests. The CLI was 0.13.0 and the running gateway was 0.12.2.

For existing scheduled Showdown report `4195c6c07cda`, the authenticated gateway returned HTTP 200 and an unauthenticated request returned 403. Kiro opened the dashboard and reloaded the report. Its 1,000 deals, seeds 0–999, were played from both seats. Cowboys won 1,188 of 2,000 games (59.4%) and the first player won 1,142 (57.1%). The on-disk report, gateway response and rendered percentages agreed. Codex independently matched the full recorded revisions, both sets of win counts, the seed range and the simulator hash to the receipt. The earlier 0.1.2 panel showed 118.8% and 114.2% for that same report because it divided wins by the number of deals.

This was an update of an existing install. Kiro restored its original source and verified that settings, history and grants were preserved. The tested mirror revision remains available in the [standalone PR](https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch/pull/1). First-time installation and Devpost submission have separate evidence requirements.
