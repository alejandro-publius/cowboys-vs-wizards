# Bugfix Requirements Document

## Introduction

In Showdown, the Bear Trap card (effect "snare": "When an enemy troop attacks, it loses 2 orbs first. If that defeats it, the attack never lands.") can deal a fatal hit to the attacking troop. When that happens, the troop is correctly removed from the board, but the only combat log line for the trap says "its attack was cancelled". That wording is meant for Hex, which cancels the attack without hurting the troop, so players are not told that the Bear Trap defeated their troop. Fable (product owner) approved the fix: when the trap event reports zero orbs left (`left` is 0), the log SHALL say "defeated before it struck", and this check takes precedence over the "attack was cancelled" wording. Game rules, the trap event data, and all other log lines stay as they are.

Bug condition: a trap log line is shown for a trap event where `left` is 0 (a fatal Bear Trap, which also carries `stopped` = true).

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a Bear Trap springs on an attacking troop and the 2-orb loss reduces that troop to 0 orbs THEN the system shows the trap log line "Trap! <owner's Bear Trap> caught <troop>: its attack was cancelled." even though the troop was defeated

1.2 WHEN any trap event with `left` equal to 0 and `stopped` equal to true is turned into a log line THEN the system shows "its attack was cancelled" and the "defeated before it struck" wording is never shown

### Expected Behavior (Correct)

2.1 WHEN a Bear Trap springs on an attacking troop and the 2-orb loss reduces that troop to 0 orbs THEN the system SHALL show the trap log line "Trap! <owner's Bear Trap> caught <troop>: defeated before it struck."

2.2 WHEN any trap event with `left` equal to 0 is turned into a log line THEN the system SHALL show "defeated before it struck", checking `left` equal to 0 before checking `stopped`

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a Hex trap springs on an attacking troop (the troop keeps its non-zero orbs and the attack is stopped) THEN the system SHALL CONTINUE TO show "Trap! <owner's Hex> caught <troop>: its attack was cancelled."

3.2 WHEN a Bear Trap springs on an attacking troop and the troop survives with N orbs (N greater than 0) THEN the system SHALL CONTINUE TO show "Trap! <owner's Bear Trap> caught <troop>: it dropped to N and attacked anyway." and the attack SHALL CONTINUE TO land

3.3 WHEN a Bear Trap reduces an attacking troop to 0 orbs THEN the system SHALL CONTINUE TO remove the troop from the board and SHALL CONTINUE TO stop its attack from landing

3.4 WHEN a trap springs THEN the system SHALL CONTINUE TO emit the trap event with the same fields (`side`, `cardId`, `target`, `left`, `stopped`) and the same values as before, and the event contract SHALL CONTINUE TO describe `stopped` as "the attack never lands"

3.5 WHEN any event other than a trap event is turned into a log line THEN the system SHALL CONTINUE TO show exactly the same text as before

3.6 WHEN a trap log line is shown THEN the system SHALL CONTINUE TO use the same "Trap! <owner's card> caught <troop>: ..." prefix, owner and card naming, and closing period
