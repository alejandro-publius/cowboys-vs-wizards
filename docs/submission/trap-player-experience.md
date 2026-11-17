# Trap zone: player experience contract (issue #83)

Author: Kiro CLI V3. Base: `main` 1d42ad7. Text only. No source, art, model, animation, sound, style, card or spec change. Evidence and method: [kiro-trap-ux-contract.md](../evidence/kiro-trap-ux-contract.md).

**Status: PROPOSAL, nothing shipped.** It describes how one trap zone per side should read and behave, so 3D work does not start from guesses. Rules come from [requirements](../../.kiro/specs/trap-zone/requirements.md) and [design](../../.kiro/specs/trap-zone/design.md) (flag `traps`, default off). This document does not name, stat or draw any trap card (requirements R7, O1). Where it says "the trap", it means any card of kind `trap`.

## 1. Fit with the current game

- Three lanes per side, a hand, a 12-card deck, seeded matches (`?seed=0`, `?seed=60`). The zone is a fourth, separate slot per side. It is not a lane, holds no troop and has no orbs.
- Current selection flow (`src/match/selection.js`): pick a card, pick tributes/slot/target, then confirm or cancel. A trap reuses this: pick card, pick the zone, confirm or cancel. No drag is required.
- Current lanes are buttons with `aria-pressed` and a spoken label ("Your lane 2: ..."). The latest clash is a polite live region. The trap zone follows both habits.
- Rejections already come back as a plain sentence. Trap rejections do the same.

## 2. Open decisions that change the text

These are **undecided**. Both options are written out. Neither is approved. Owner decides after issue #78.

### D-A. Spell allowance or a separate `trapSet` allowance

| | A1. Shares the spell allowance (`castUsed`) | A2. Separate `trapSet` (the current spec, R2) |
|---|---|---|
| Round rule | One spell **or** one trap each round | One trap and one spell each round |
| Hand text when blocked | "You already used your spell for this round." | "You already set a trap this round." |
| Pro | Fewer actions to learn. Matches the existing "one spell" idea | Trap never competes with spells. Matches spec R2 |
| Con | A trap costs a spell, which may make traps feel like a tax. Changes a rule the spec kept fixed | One more allowance to explain. More actions per round |
| Rule display | One "Spell/Trap" marker | Two markers: "Spell" and "Trap" |

### D-B. Full cancel or one-damage ward

| | B1. Full cancel (current spec R4) | B2. One-damage ward |
|---|---|---|
| Effect | The strongest enemy attacker's attack does nothing this clash | The strongest enemy attacker's attack deals 1 less damage this clash (minimum 0) |
| Armed hint (setter only) | "Armed. Stops the strongest attacker." | "Armed. Weakens the strongest attacker by 1." |
| Reveal line | "Trap sprung: {card} stopped {troop} in lane {n}." | "Trap sprung: {card} reduced {troop}'s attack in lane {n} by 1." |
| Pro | Easy to read and to show: one attack visibly stops | Smaller swing, less chance of a stalled turn |
| Con | A single trap can remove the biggest threat | The reveal is harder to see, since a hit may still land. The same highest-attack target is used; the visual/log handling of zero damage is not specified yet |
| Event shape | Fits `trap-trigger` with `cancelled` (design section 4) | Needs a new field; not designed |

Copy below is written for B1/A2 (the spec as written) with the alternatives in brackets. A change in either decision changes only these strings, not the flow.

## 3. State-by-state flow

Wording is plain, one idea per line. `{x}` is filled at run time.

| # | State | What the player sees | Action | Text (visible and spoken) |
|---|---|---|---|---|
| 1 | **Empty zone** | An unmarked slot labelled "Trap" on each side. | None needed | "Your trap zone: empty." Enemy: "Enemy trap zone: empty." |
| 2 | **Choose from hand** | Trap cards in the hand are marked playable. Tap one; it is marked chosen. The empty own zone is the only highlighted target. | Pick card | Card label: "{name}, trap, playable now." Prompt: "Choose your trap zone." |
| 3 | **Set and confirm** | Zone chosen. A confirm and a cancel button appear, as for summons. | Confirm or Cancel | Prompt: "Set {name} face down? It works from next round, and stays hidden." Buttons: "Set trap", "Cancel". |
| 4 | **Face-down, unarmed** (set round) | Own side: card shown with an "Not armed yet" tag. Enemy view: a face-down marker only. | None | Own: "Your trap: {name}, face down. Not armed until next round." Enemy sees: "Enemy trap: face down." |
| 5 | **Armed** (next round start) | Tag changes to "Armed". Enemy marker unchanged. | None | Own: "Your trap is armed." Enemy: no new text. |
| 6 | **Trigger** (a valid enemy attacker exists at the clash) | Clash log gains a line before damage lines. | None | "Trap sprung: {name} stopped {troop} in lane {n}." [B2: "reduced {troop}'s attack in lane {n} by 1."] |
| 7 | **Reveal and discard** | The card turns face up for both sides, then goes to the discard. Zone shows empty again. | None | "{name} revealed and discarded." Zone: "Your trap zone: empty." |
| 8 | **Restart and replay** | New match: every zone empty, no trigger text from the old match. Same seed gives the same sequence. | Restart or seed link | "New match. Trap zones: empty." |

Notes on step 6: if no valid enemy attacker exists, the trap stays armed and nothing is said (design section 4, no waste). Step 5 has no event, so no sound or log line is needed.

## 4. Edge states

| Case | Behaviour | Text |
|---|---|---|
| **Cancel** | At the confirm step, Cancel returns to no selection. The card stays in hand; no event. Tapping the chosen card again also clears it (as today). Escape cancels. | "Trap not set." |
| **Occupied zone** | Trap cards in hand are not playable. Tapping one explains why. The setter's own zone shows its card; the zone is not a valid target. | "Your trap zone is full. Your trap sprang or is waiting." [Short: "Trap zone is full."] |
| **Last round** (round 9, `MAX_ROUNDS`) | A trap set in the last round can never trigger (design section 1). Allow it, but warn before confirm. | "This is the last round. This trap will not work." Buttons unchanged. |
| **Invalid action** | Nothing changes. One sentence in the existing message area. | "Only trap cards can go there." / "Choose a card first." / "Trap already set this round." [A1: "Spell or trap already used this round."] |
| **Traps off** (flag off) | No zone drawn, no trap text anywhere. The match looks as it does today. | none |
| **Hidden opponent identity** | The enemy zone never shows a name, art or stats before trigger. The set event is public as "set a trap", with no card. | "Enemy set a trap." |
| **Public events** | `trap-set` (redacted for the enemy), `trap-trigger` (public, reveals the card), then the discard. They appear in the clash log in event order, before damage. | see rows 6 and 7 |
| **Both traps at once** | Each trap is judged against the board before either takes effect (R9). Two reveal lines appear in side order, then damage. Neither stops the other. | "Trap sprung: ..." twice, then "Both traps resolved." (optional) |

## 5. Keyboard and screen reader

- Order: hand cards, then own lanes, then own trap zone, then enemy lanes, then enemy trap zone. Same tab order as today with one extra stop per side.
- The trap zone is a button, like a lane. It carries `aria-pressed` while chosen and a label that states side, state and card (own only): "Your trap zone: {name}, face down, armed."
- Enter or Space selects and confirms the focused item. Escape cancels. No drag, no hover-only information.
- Prompts and rejections go to the existing polite live region. The clash log announces trap lines in order. Do not announce row 5 (arming) as an interruption.
- The enemy zone label never includes the card. Test this with a screen reader and by reading the DOM, not only by eye.
- Never rely on colour alone: use the text tags "Face down", "Not armed yet", "Armed".

## 6. Mobile and reduced motion

- Target size: the trap zone, its confirm and cancel buttons are at least 44 by 44 CSS pixels (the size already used for title-menu controls), with space between them. Not measured yet; a phone check is pending.
- The zone must stay inside the board on a narrow phone in portrait without hiding a lane or the hand. If it cannot, that is a layout decision for the owner, not a silent shrink.
- Tags and prompts wrap; no text is clipped at 200% zoom.
- Reduced motion (`prefers-reduced-motion` or the existing "reduce card motion" setting): the reveal is an instant face change plus the log line. No flip, shake or slide. Text carries all meaning, so nothing is lost.

## 7. Acceptance test matrix

All rows are **pending**. Layer: R = rules (Node, no DOM), U = UI/DOM, M = manual (screen reader, phone). Trap cards use a test fixture (requirement R7).

| ID | Check | Layer | Source |
|---|---|---|---|
| T1 | Flag off: state, events and seed 0 and 60 replays equal `main` | R | R8 |
| T2 | Empty zone: label reads "empty" both sides | U | flow 1 |
| T3 | Trap card in hand is marked playable only when zone empty and allowance free | R, U | R1, R2 |
| T4 | Set requires confirm; Cancel and Escape leave hand and state unchanged | U | flow 3 |
| T5 | Set round: own sees name and "Not armed yet"; enemy view has no card id (DOM and `view`) | R, U | R5 |
| T6 | A trap set in round N does not trigger at the round N clash | R | R3 |
| T7 | Armed in round N+1; triggers on a valid enemy attacker; no attacker means it stays | R | R4 |
| T8 | Reveal then discard; card is in exactly one place at all times | R | R6 |
| T9 | Occupied zone: second set rejected with text | R, U | R1 |
| T10 | Spell and troop cards are rejected as traps | R | R2 |
| T11 | Round 9: warning shown, trap never fires | R, U | design 1 |
| T12 | Both sides armed: result independent of side order | R | R9 |
| T13 | Restart clears both zones; a late callback from the old match changes nothing | R, U | R10 |
| T14 | Same seed and actions give the same events | R | R8 |
| T15 | CPU sees only its own trap and never the player's card | R | R11 |
| T16 | Keyboard only: full set and cancel without a pointer | U, M | section 5 |
| T17 | Screen reader reads zone state, prompts, rejections and trigger lines in order; enemy name never read before reveal | M | section 5 |
| T18 | Controls at least 44 px on a phone; board fits in portrait | M | section 6 |
| T19 | Reduced motion: reveal has no movement; log line still shown | U, M | section 6 |
| T20 | Decision text (A1/A2, B1/B2) matches the chosen option, and the other option's strings are absent | U | section 2 |

## 8. 20-second trap demo beat (hypothetical)

**PENDING. Use only if the trap zone is shipped and the owner approves it.** Nothing here is footage, and no trap art exists. It would use the seeded match and existing screens plus the zone.

| Time | Beat | On screen |
|---|---|---|
| 0:00 to 0:04 | Choose a trap card, the zone lights up | "Choose your trap zone." |
| 0:04 to 0:08 | Confirm. Face-down marker appears. Enemy side shows only a marker | "Set {name} face down?" then "Your trap: face down." |
| 0:08 to 0:11 | End the round. Tag changes to Armed | "Your trap is armed." |
| 0:11 to 0:17 | The enemy attacks. Trap sprung. Card revealed, the attack stops | "Trap sprung: ..." |
| 0:17 to 0:20 | Card goes to discard, zone empty | "Your trap zone: empty." |

Needs: an approved card and art source, the rule decisions in section 2, and a real recording. Do not describe it as shipped before then.

## 9. Owner decisions still open

1. D-A: shared spell allowance or separate `trapSet` (pending #78).
2. D-B: full cancel or one-damage ward (pending #78).
3. Whether to allow setting a trap in the last round with a warning, or block it.
4. Placement of the zone on a narrow phone.
5. Trap card name, art, copy count and deck migration (requirements O1, O2).
6. Equal-attack tie-break (requirements O3).
