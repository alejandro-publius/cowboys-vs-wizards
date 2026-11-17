# Trap lab paired report comparator (issue #124)

**Experimental, synthetic, local only.** Compares one T1 report and one BASE report exported from the [trap placeholder lab](../trap-placeholder/README.md) ("Export current playtest report") for the same seed and Wizard CPU. It approves no trap card name, copy count, deck, art, 3D model, animation or audio. No human has played a match for this tool, and its output is not human playtest evidence, balance or a win rate.

## Use

```sh
node experiments/trap-playtest-compare/run.mjs <T1.json> <BASE.json>
node experiments/trap-playtest-compare/run.mjs <T1.json> <BASE.json> --notes
```

Either file order works. The CLI reads only the two named files (each at most 1 MiB), prints Markdown to stdout and writes nothing. It makes no network request and stores nothing. File names and paths do not appear in the output or in error messages. Exit codes: 0 compared, 1 refused (the reason is on stderr), 2 bad arguments.

Local page (optional): serve the repository root on loopback, as for the lab, then open the page:

```sh
python3 -m http.server 8108 --bind 127.0.0.1
# http://127.0.0.1:8108/experiments/trap-playtest-compare/index.html
```

Choose the two files and press "Compare reports". The page reads the chosen files in the browser with the File API only after the button is pressed. It renders with `textContent`, and its Content-Security-Policy blocks every request except its own scripts (`connect-src 'none'`). It uploads nothing and uses no storage or cookies. "Show the typed notes" is off by default.

## What is compared

[compare.js](compare.js) (pure, browser-safe, no imports) exports `compareReports(first, second, { includeNotes: false })` and `formatMarkdown(comparison)`.

A pair is accepted only when both files are schema `cowboys-vs-wizards/trap-placeholder-playtest-report`, version 1, source `synthetic-developer-lab`, one T1 and one BASE, the same integer seed (0 to 4294967295) and the same Wizard CPU (easy, normal or hard). Every field is checked against the exporter's exact key lists. A file with an unexpected field, a missing field, a wrong type, a count that is not a nonnegative safe integer, counts that add up to more than `publicEvents`, an event-list length that disagrees with the metrics, or trap counts in BASE is refused. The error names the field. It never repeats the untrusted value or the name of an unexpected key.

Only these values reach the output, copied one by one:

- seed, Wizard CPU, and per scenario the match status, round, and result outcome, reason and ending round;
- the report's own `metrics`: `publicEvents`, `roundStart`, and `trapSet`, `trapTrigger`, `spell` and `phaseEnd` for the Cowboy and the Wizard. These are tallies of public Cowboy-view events made by the exporter. `roundStart` counts round-start events, and round 1 has none, so a match that ends in round 5 shows 4;
- the metric limits `eventsTruncated`, `eventsDropped` and `publicEventsIncluded`.

The raw `publicEvents` list is never read beyond its length and never copied, so no card ID from it appears. The reports' disclaimers, hidden Wizard data, timestamps and paths are not in the output.

## Completeness

The pair is **complete** only when both reports have match status `terminal` (the controller's status after a result) and a valid result (outcome win, loss or draw with a matching winner and loser, a reason code and a round 1 to 9). Only then are the same-outcome, same-reason, ending-round difference (T1 minus BASE) and count differences computed. If either match is idle, still in play, in error, or terminal without a result, the pair is **incomplete**, interpretation is **blocked**, and those differences are not computed. Each report's counts are still shown.

When a report hit the exporter's 500-event cap or dropped events it could not sanitize, a warning says so, and says that a zero or low count does not show that the event did not happen. An empty event list in the report (exported without "include events") is not read as zero events; the counts come from `metrics`.

## Notes

`humanNotes` is validated in every report, but no note text is copied unless `includeNotes` is exactly `true` (`--notes` on the CLI, the checkbox on the page). Notes are shown as stored after the exporter's cleaning rules (control and bidi characters removed, at most 1000 code points). The CLI escapes Markdown and HTML characters in notes. The page shows them as plain text. The comparator does not summarise, score or interpret notes.

## Test

```sh
node --test experiments/trap-playtest-compare/compare.test.js
```

Not part of `npm test`. Reports in the test come from the real exporter on real lab matches: `createLab()` on a fake synchronous scheduler, with the Cowboy played by `chooseAction` through the controller. Hostile cases edit copies of those reports. The test covers both input orders, determinism, partial and idle reports, truncated and dropped events, schema, seed, CPU and scenario mismatches, malformed counts, unknown keys, `__proto__` keys, accessors, sentinel extras, no mutation, notes privacy and escaping, CLI read-only behaviour under Node's `--permission` read-only grant, and a headless Chrome smoke of the page on loopback (skipped if Chrome is not at the default macOS path). These are synthetic matches, not playtests.

Evidence: [docs/evidence/kiro-trap-playtest-compare-124.md](../../docs/evidence/kiro-trap-playtest-compare-124.md).
