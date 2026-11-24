# Night Shift: repair scout, Saloon runs and Boot Hill Poker

**Status:** public draft for owner review. Kiro generated the workflow results below. Claude Opus 5.5 wrote this guide from their archived receipts. Every figure comes from a linked file unless it is marked as coming from the Kiro run record.

## Repair scout: `wf_80aa97dac058694f`

The native Kiro workflow ended **failed** at its scout step after the card compiler refused six edits. Apart from that failure, none of the 76 measured edits qualified. So the workflow played no fresh confirmation games, nominated nothing and applied no change. Under the [repair protocol](../../../.kiro/specs/night-shift-repair/requirements.md), confirmation runs only after a nomination.

| Measure | Value |
| --- | ---: |
| Candidate edits: every in-bounds ±1 change to attack, health or stars on the brief's 15 troop cards | 82 |
| Measured | 76 |
| Refused by the card compiler | 6 |
| Measured edits passing [NSB-1 and NSB-2](../../../.kiro/specs/night-shift-balance-contract/requirements.md) on both cohorts | 0 |
| Scout games: 76 edits × 2 cohorts × 320 games, plus 640 baseline games | 49,280 |

- **Cohorts:** `scout-1` and `scout-2` have 160 deals each, starting at seeds 630100000 and 630200000. Each deal is played once from each starting seat, with the level-2 bot on both sides, at base `8ec0fe7195414fb1cba94d20e6c8c8a362fea669`. The Cowboys won 65.00% of baseline games on scout-1 and 60.00% on scout-2. The first-player share was 58.75% on both.
- **Refusals:** attack 1 → 0 on Sheriff, Outrider, Covered Wagon and Skeleton (`attack must be a positive integer`), and health 5 → 6 on Mounted Billy and Dragon (`health must be an integer from 1 to 5`). Eight more ±1 edits fell outside the brief's bounds and never became candidates.
- **Receipts:** [scout.json](scout.json), which records its cache state as `computed (none cache)`, and the attempt-1 [brief.json](brief.json). `scout.json` does not record the workflow ID or the terminal state. Both come from the [native Kiro run record](native-runs.json).

### Strongest candidate: Sheriff health 3 → 2

This edit ranks first under the preregistered ordering recorded in `scout.json`. The ordering sorts by an edit's worst miss of NSB-1 or NSB-2 across both cohorts, here 0.3125 pp, then by distance from an even split. It ranks edits and nominates none. The before and after results are paired: each cohort replays the same 320 deal-and-seat games.

| Cohort | Cowboy wins, before → after | First-player share, before → after | NSB-1, 45–55% | NSB-2, first-player skew ≤ 9.75 pp |
| --- | ---: | ---: | --- | --- |
| scout-1 | 65.00% (208/320) → 51.875% (166/320) | 58.75% → 57.50% | Pass | Pass |
| scout-2 | 60.00% (192/320) → 55.3125% (177/320) | 58.75% → 59.0625% | Fail, 0.3125 pp over | Pass |

On scout-2 the 55% cap allows 176 Cowboy wins out of 320. The edit had 177, one win over the cap.

### Separate from the Billy 100k proof

The [Billy seat audit](../billy-seat-audit/README.md) is an earlier result, nominated separately. Billy attack 2 → 1 came from the original three-proposal run. It was measured on 100,000 Node engine duels at source `eedab9385931e093e156fdb7885c470eb2ec64eb`, with 51.920% Cowboy wins against 59.792% at attack 2. This scout nominated nothing. In it, the same Billy edit measured 56.25% Cowboy wins on scout-1 and 51.25% on scout-2, so it missed NSB-1 on scout-1 by 1.25 pp. The two results come from different source commits and cohorts and are reported separately.

## Agent Arena: `wf_d5aad547ec014474`

The native Kiro workflow played the **Cautious Sheriff** playbook (Cowboys) against the **Reckless Wizard** playbook (Wizards). It was verified at 2026-11-23T02:12:47.728Z.

| Measure | Value |
| --- | ---: |
| Games: seeds 0–7, each played from both starting seats | 16 |
| Wins, Cautious Sheriff–Reckless Wizard | 13–3, no draws |
| Wins by starting seat: Cowboy first; Wizard first | 6–2; 7–1 |
| Games ending at a Base | 16 |
| Turns, min / mean / max | 11 / 17.5 / 27 |
| Recorded replay: seed 0, Cowboy first | 54 decisions, 19 turns, Cautious Sheriff win |

An earlier run, `wf_ca086c54e37eac39`, was refused before any play because its first Wizard playbook had an invalid schema. It played no games and is not in the archive (Kiro run record).

Receipt: [showcase.json](../saloon-agent-arena/showcase.json)

## Card Forge: `wf_a81a1969da647d72`

The native Kiro workflow turned a plain-language request into **Dusty Pete**, a Cowboy troop in the Covered Wagon slot (2 copies, Rig, Guard). The verifier passed it at base `b00a5e18b8ad07ec8759635a399cc8117c900fa0` on 2026-11-23T02:14:20.101Z. It ran in a disposable snapshot, and one of its passed checks is "Live cards and engine files unchanged".

| Card | Attack | Health | Stars |
| --- | ---: | ---: | ---: |
| Covered Wagon (the slot) | 1 | 4 | 4 |
| Dusty Pete | 1 | 5 | 2 |

- The verifier played seeds 0–15 from both seats: 32 baseline games and 32 candidate games. Every game ended at a Base.
- Dusty Pete was summoned in 27 of the 32 candidate games, 37 times in total.
- The Cowboys won 19 of 32 baseline games and 26 of 32 with Dusty Pete.

**Validation scope:** the verifier's ten check lines cover the request, the draft schema, the slot, compilation, legal endings from both seats, seeded replays, summoning and unchanged live files. None of them is a balance gate, so the win counts describe these 32 games only. The archive check recomputes the summaries and pairing from the 64 stored game records. It does not replay the games, because that needs the verifier's snapshot.

Receipt: [showcase.json](../player-card-forge/showcase.json)

## Boot Hill Poker (experimental)

Boot Hill Poker is a standalone two-seat five-card draw: you play the Cowboy against a deterministic local Wizard bot. It has no accounts, cash, betting or network, and it does not touch Showdown ([README](../../../experiments/boot-hill-poker/README.md)).

- Terminal: `node experiments/boot-hill-poker/cli.mjs --seed 17`
- Browser: serve `experiments/boot-hill-poker/` over local HTTP and open `index.html?seed=17`.

[`verify-poker-kit.mjs`](../../../scripts/verify-poker-kit.mjs) plays poker as both arms of the paired duel kit that Showdown uses. By default it plays 500 deals from seed 1, from both seats. It checks completeness, replay, classification and the rejection of malformed outcomes. Then it evaluates NSB-1 and NSB-2 for description only: a share outside the Showdown band is reported, not treated as a defect, and a pass is not a fairness claim. No poker results are archived here.

## Commands

| What it checks | Command |
| --- | --- |
| Reconstructs the nearest scouting edit (Sheriff health 3 → 2) and one deal | `node scripts/scout-ruling.mjs --verify` |
| Validates both Arena playbooks, then replays the 16-game series and the 54-decision replay with the arena engine; the series summary and the replay must match the archive | `node scripts/saloon-showcases.mjs check-archive docs/evidence/saloon-agent-arena` |
| Re-audits the Forge showcase and recomputes its summaries and pairing from the stored records, without replaying games | `node scripts/saloon-showcases.mjs check-archive docs/evidence/player-card-forge` |
| Poker paired-kit check | `node scripts/verify-poker-kit.mjs` |
| Tests as run on every pull request | `npm test` |

[`saloon-showcases.mjs`](../../../scripts/saloon-showcases.mjs) and `verify-poker-kit.mjs` exit with 0 on success, 1 on a refusal or failed check, and 2 on a usage error.
