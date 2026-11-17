# Kiro evidence: guided trial seed picker in the trap placeholder lab (issue #122)

Date: 2026-11-17 (America/Los_Angeles). Worker: Kiro V3 session (the brief names Kiro CLI 3.4.0; the session metadata names the client "Kiro IDE"), model `claude-opus-5.5` as named in the session context; the session was requested with `--model claude-opus-5.5`. Credits and usage: none were emitted to the worker, so none are recorded. Base: main `c2b619cdee5b4a412511c9cd4c5ef658f9575a6b` (includes the #120 seed kit). Branch `kiro/trap-seed-picker-122`, one local commit, not pushed or merged.

## Problem

A tester running the #120 T1 seeds in the local lab had to copy each seed, scenario and CPU level from [seed-plan.md](../../experiments/trap-playtest-kit/seed-plan.md) by hand, and the paired BASE run needed the same seed again. This task adds a form-filling picker. It does not start matches, does not collect feedback and is not a playtest.

## Change

- [index.html](../../experiments/trap-placeholder/index.html): a "Guided trial seeds" fieldset after the status line: native labelled select "Guided T1 trial" (one placeholder option in the HTML), a detail line, buttons "Prepare trial — does not start" and "Prepare paired BASE at current seed — does not start", and a polite live status line.
- [app.js](../../experiments/trap-placeholder/app.js): options built at load from `pickSeeds()` and `CATEGORIES` in the browser-safe [seeds.js](../../experiments/trap-playtest-kit/seeds.js) (six T1 categories A-F plus the optional T2 example). No seed is written in the page; no Node-only module is imported. Prepare writes only `#seed`, `#scenario` and `#cpu-level` (normal) and redraws. It calls no `session.start`, `restart`, `leave`, controller action or `focus()`, and touches neither notes nor export. Paired BASE validates the seed field with the controller's rule and keeps that seed. The lab status line now also says "Seed field N applies on Start." when a valid seed in the field differs from the active match; the seed field's `change` event redraws, as the selects already did.
- [README.md](../../experiments/trap-placeholder/README.md): new section on the picker and its caveats.
- New [trap-placeholder-seed-picker.test.js](../../tests/experiments/trap-placeholder-seed-picker.test.js): 2 Node tests and 1 Chrome smoke.

Unchanged: `src/`, cards and decks, the main app, `lab.js`, `scenarios.js`, `playtest-report.js`, the seed kit, other experiments, existing tests, packages, scripts, CI and assets. `style.css` was not needed. `docs/kiro-build-log.md` was outside the owned paths and was not edited.

## What is shown

Each option label and detail line gives the seed, the first side and the Cowboy's synthetic trap and spell positions with their round, from the kit. A position from 4 up reads "drawn at round N start if the match is still going"; for E and F the detail adds that the round is reached only if neither base falls first. The Wizard's order and trap ID are never shown. The page help notes that knowing positions before play can change play.

## Verification (2026-11-17, this worktree)

| Check | Result |
| --- | --- |
| `node --test tests/experiments/trap-placeholder-seed-picker.test.js` | 3 of 3 pass, Chrome/157.0.8103.79 |
| `node --test tests/experiments/trap-placeholder.test.js` | 7 of 7 pass |
| `node --test tests/experiments/trap-placeholder-scenarios.test.js` | 8 of 8 pass (Chrome smoke ran) |
| `node --test tests/experiments/trap-placeholder-report.test.js` | 7 of 7 pass (Chrome smoke ran) |
| `node --test tests/experiments/trap-placeholder-keyboard.test.js` | 1 of 1 pass (Chrome) |
| `npm test` | 313 of 313 pass (baseline 313) |
| `node scripts/check-links.mjs` | 0 broken links |
| `git diff --check` | clean |

The Node tests check that `pickSeeds()` gives categories A-F with six distinct seeds, three Cowboy-first and three Wizard-first, each on its category's fixed side; that `renderPlan(pickSeeds())` equals the committed `seed-plan.md` byte for byte; and that each picked seed's T1 (or T2) opening has 12 cards per side and BASE's first side. The source test checks the label, buttons and live region, a single HTML option, the `seeds.js` import, no Node-only import, no picked seed literal and no start, restart, leave, focus, notes or export call in the picker code, and no remote URL, network or storage API or synthetic trap ID in the page source.

The Chrome smoke (headless installed Chrome, 127.0.0.1 server, CDP `Input.dispatchKeyEvent` and `Input.dispatchMouseEvent`):

1. Load: form `0 / FIXTURE / normal`, picker empty, eight options (placeholder, A-F, T2) labelled from the plan.
2. Tab to the select, key "a" (typeahead) chooses A; detail names seed 55, Cowboy first, trap 0 and spell 2 in the opening hand; form and match unchanged.
3. Tab, Enter on Prepare trial: focus stays on the button; form `55 / T1 / normal`; trial status "Prepared A: seed 55, scenario T1, Wizard CPU normal. Nothing started: the current match is unchanged. Press Start."; lab status still seed 0 FIXTURE with both pending notes; after 800 ms the status, log length and hand are the same.
4. Mouse click Start: seed 55, T1, normal, no pending note; Cowboy hand equals `openingFor(55, "T1")`; deck plus hand is 12 per side; no Wizard synthetic trap ID in the DOM. Export: `trap-playtest-T1-normal-seed-55.json`, T1/55/normal, typed note kept.
5. Mouse click Prepare paired BASE: form `55 / BASE / normal`; reminder to export and Clear notes; match unchanged; note not cleared; an export now still says T1/55.
6. Start: BASE, seed 55; hand equals `createMatch(55)`; both trap zones read "traps not enabled in this scenario". Export `trap-playtest-BASE-normal-seed-55.json`, BASE/55/normal.
7. Seed field "12x": Paired BASE refuses and changes nothing.
8. Key "t" chooses T2, Prepare and Start: seed 35, T2, hand equals `openingFor(35, "T2")`; export T2/35.
9. No Wizard synthetic trap ID in any of the four exports; 21 requests, all loopback or blob; no cookie or storage; 0 runtime errors.

## Limits

- Automation only. No human played these trials and no feedback was collected. Nothing here is screen reader, visual or human accessibility evidence.
- The select was driven by Chrome letter typeahead, not by opening its popup.
- The picker runs `pickSeeds()` (10,000-seed scan) at page load; it took about 32 ms in Node on this machine. Browser timing was not measured.
- Approves no trap card, copy count, deck, art, model, animation or audio.
