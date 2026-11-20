# Showdown slice 2, the first hour: requirements

Author: Kiro CLI (Claude Opus 5.5), 2026-11-19, America/Los_Angeles. Job: graywave-requirements.
Source: [`docs/design/showdown-integration-kiro-brief.md`](../../../docs/design/showdown-integration-kiro-brief.md),
section "2. The first hour" and tool A ("A spec for slice 2") from PR 147. Issue 143 (slice 2), issue 37 (tools).
Base: `kiro/graywave-integrate` `cd764f1` (PR 148, the reviewed Camp candidate).

**Status: backfilled.** The slice 2 implementation already existed on the integration branch when this
spec was written. This spec was written afterwards from the brief and the existing code and tests. It
records what that code is required to do and which tests prove it. It does not describe how the code was
built. It changes no rule, reward, number, wording or behaviour. Rules, progression numbers, balance and
player-facing wording are Fable 5.2's.

IDs are `FH-R<requirement>.<criterion>` (FH = first hour) so they do not collide with the `R`-numbered
Orb Duel IDs in the same map. The test for each criterion is listed in
[`docs/requirement-test-map.md`](../../../docs/requirement-test-map.md#showdown-slice-2-the-first-hour).

## Glossary

- **Progress**: the plain object of `src/game/showdown/progress.js` (`newSave`, `settle`, `choose`, `migrate`, ...), stored under `cvw-showdown-save-v2` (a v1 Trail save is read from `cvw-showdown-trail-v1`).
- **Lane profile**: the lane game's record `cvw-player-v1`, written by `src/profile/player-profile.js`. Its five-hunt clears give Captured cards.
- **Inherited record**: `cvw-showdown-inherited-v1` = `{v: 1, source: "cvw-player-v1", cards: [...]}`, written by `src/game/showdown/inherited.js`.
- **Camp**: the graybox screen (`src/ui/showdown-camp.js`) that lists Trail duels, the collection, the deck and any card offer.
- **Save code**: the portable text export of Progress (`prototypes/showdown/savecode.js`). It is only offered by the prototype screen.

## Brief lines and where they are numbered

| Brief line (slice 2) | Requirement |
| --- | --- |
| Move `trail.js`, `progress.js` and `playtest.js` in. | FH-R1 |
| The camp replaces the title menu's Play, Wanted and Build Deck entries for the Showdown game. | FH-R2 |
| Join the save to the existing profile store. | FH-R3 |
| An existing profile must not lose what it earned: a Captured card already won in the lane game stays owned. | FH-R5 |
| Run `trail-sim.mjs`'s ramp check with the other tests. | FH-R4.2 |
| Done when 1: `progress.test.js` passes with only import paths changed, including the ramp test. | FH-R4 |
| Done when 2: a test loads a saved lane-era profile and shows its captured cards are still owned. | FH-R5 |
| Done when 3: in a browser a new profile wins Trail duels 1 and 2 and is paid a card each time, and reloading the page keeps them. | FH-R6 |
| (Scope of the join, not in the brief: device-local storage versus Fable's balance policy) | FH-R7 |

## Requirement FH-R1: The first-hour modules are pure modules in `src/game/showdown/`

1. `trail.js`, `progress.js` and `playtest.js` SHALL live in `src/game/showdown/`, and the `prototypes/showdown/` paths SHALL re-export exactly those modules, so the prototype screen, scripts and tests run the same code.
2. These modules SHALL have no DOM, rendering, filesystem, network or model dependency (AGENTS.md). Storage SHALL reach them only as a `Storage` argument passed in by the caller.

## Requirement FH-R2: The Camp is the Showdown game's entry

1. On a clean profile the graybox title menu SHALL offer Play and the lane duel link only. Wanted and Build Deck SHALL NOT be offered for the Showdown game.
2. WHEN the player presses Play THEN the Camp SHALL open with Boot Hill open and the other five Trail duels locked.
3. WHEN the player opens a Camp tile THEN the Showdown duel for that Trail entry SHALL open, not the lane duel.
4. WHEN the player leaves an unfinished duel THEN no result SHALL be recorded.
5. `?mode=lanes` SHALL show the lane menu and `?mode=match` SHALL still auto-start the lane duel, until slice 3.

## Requirement FH-R3: The Showdown save is joined to the profile store

1. A new profile SHALL load as `newSave()`, and loading SHALL write nothing.
2. A stored v1 Trail save SHALL load as `migrate()` reads it, and its key SHALL be kept.
3. WHEN Progress the next load would reset is offered for saving THEN the save SHALL be refused and nothing written.
4. WHEN a stored save is refused on load THEN it SHALL be kept once under its own key before it is replaced.
5. WHEN storage is blocked THEN the game SHALL load a new save, play on in memory and report that it was not saved, without throwing.
6. An unclaimed card offer SHALL survive a reload so it cannot be rolled again.
7. Whatever loads SHALL export to a save code and strictly import back unchanged.
8. The lane profile SHALL stay byte-identical across Showdown loads and saves.
9. A finished duel SHALL be logged once under `cvw-showdown-playtest-v1`, with only known fields and nothing personal; a reload SHALL read the same report; blocked storage SHALL keep the log in memory and say so.

## Requirement FH-R4: `progress.test.js` and the ramp run unchanged in `npm test`

1. `prototypes/showdown/progress.test.js` SHALL pass against the moved modules with no change beyond import paths. (It needed none: the prototype paths re-export `src/game/showdown/`.)
2. Its ramp test ("a cushion, then a ramp, all the way to the even match: bot players on 80 deals", built on `trail-sim.mjs`) SHALL run in `npm test` (`scripts/verify-duel.mjs`).
3. The first-hour cushion SHALL be checked on its own: any legal play wins Trail 1 and 2 on 80 deals, so a slice 2 regression is named.

## Requirement FH-R5: A lane-era Captured card stays owned

1. WHEN a lane profile with a Captured card is loaded THEN the Camp SHALL list that card as owned, by name, once, marked as from the lane game.
2. The capture SHALL be kept in the Inherited record, which only grows, is written only when a card is new, and is never overwritten when damaged.
3. The Inherited record SHALL persist on its own: reloads, a Trail win and a later loss of the lane profile SHALL keep the card owned.
4. A card owned in both games SHALL be listed once at the Showdown count, never the sum, and both records SHALL be kept unchanged.
5. Partial lane hunts and a clean profile SHALL create no Inherited record and write nothing.
6. The lane game SHALL still own its Captured cards after Showdown loads and saves.
7. In a browser, a lane veteran SHALL see the Captured card as owned on first load and again after a Trail win and reload, and the Inherited record SHALL list it.

## Requirement FH-R6: A new player wins Trail duels 1 and 2 in a browser, is paid, and keeps it

1. A new profile SHALL win Boot Hill by clicks alone and be paid Covered Wagon ×2 in place of Sheriff ×2, with a two-card offer.
2. Choosing an offered card SHALL add exactly one copy and clear the offer.
3. The Camp SHALL then mark Boot Hill won and open Raven Roost. Winning Raven Roost SHALL pay Outrider ×2 in place of Sheriff ×2.
4. While an offer is unclaimed, the offer SHALL come first and no Trail duel SHALL start; a reload SHALL offer the same two cards.
5. After reloads, the Camp SHALL show both wins, the rewards and chosen cards, and The Bone Fence open. Stored Progress SHALL equal the reference prototype's `newSave → settle → choose → settle → choose`.
6. A loss SHALL pay nothing and give the rematch one more Base orb, kept across a reload.

## Requirement FH-R7: Scope of inherited ownership (device storage versus balance policy)

This requirement records two different questions so they are not merged. Where the card is stored is an
integration fact Kiro owns. What the card may do in Showdown is balance policy Fable owns.

1. *Storage scope (integration).* Inherited ownership SHALL be local to the browser profile that holds the lane profile. It SHALL NOT be carried in the save code. The Camp SHALL say "They are not in your Trail deck and are not in save codes."
2. *Balance policy (Fable F1/F2, decided 2026-11-19, PR 148 issuecomment-7031816529).* A lane capture SHALL give no Showdown Progress ownership (`owned(progress, type)` is what Showdown alone loads), no Trail win, no hunt, no deck or side-deck card and no power, before or after the Trail. It SHALL stay in the keepsake record and be shown in the Camp. Each Showdown bounty SHALL pay its Legendary on its fifth hunt to every player, lane veteran or not.
3. *Carryover (same ruling: nothing from the lane game carries into Showdown progress).* Partial lane hunts and lane Frontier cards SHALL NOT carry. Start over SHALL reset Showdown progress only and SHALL leave the keepsake record and `cvw-player-v1` unchanged. Save codes SHALL NOT carry keepsakes. The graybox Camp has no Start over or save code until slice 3; until then the reference prototype's reset and `savecode.js` are checked.

*History:* before 2026-11-19 FH-R7.2 read "pending Fable F1/F2" and FH-R7.3 left F3–F5 open.

## Not covered by this spec

- Human playtests of the first hour: none run, none claimed. Clarity and fun need a person.
- Wording of the Camp lines and keywords: Fable's to approve.
- The Scout bot fix (`7e8e6eb`), which the PR 147 brief orders before slice 2. It is not on this branch.
- Slice 3 and the other tools (B: properties, C: Night Watch).
