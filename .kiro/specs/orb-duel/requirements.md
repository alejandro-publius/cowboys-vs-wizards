# Requirements Document

## Introduction

Orb Duel adds a card-match mode to the Cowboys vs. Wizards board prototype. Each side has a 12-card deck, three lanes and a base with five orbs. Players summon troops (with tribute for higher tiers), cast spells, and troops clash across lanes once per round for up to nine rounds. Numeric rules come from `docs/kiro-task-01.md` and are a **working draft, balance unproven**.

The spec states requirements only. Fable owns the Engine (jobs A and C, committed on branch `fable/match-engine` at d01b513) and the CPU (job D, in progress, not committed). Kiro owns the interaction and presentation work. This document does not assign or duplicate Fable's jobs. The completed Fable exports (`createMatch(seed)`, `legalActions(state, side)`, `applyAction(state, action)` returning `{ ok, state, events }`, `publicState(state, side)`) and the event schema in `docs/evidence/fable-match-engine.md` on that branch are integration dependencies. The UI adapts to them, and no duplicate engine is required. Event types are summon, spell, damage, defeat, phase-end, phase-start, clash, round-start, draw and result. Clash events arrive in the second side's end-phase result: damage events for lanes 0 to 2, then all defeat events. In the first playable version the human controls Cowboys and the CPU controls Wizards. The existing attack demo and the approved haunted Western art are preserved.

**Milestones**
- **Milestone 1** (Requirements 1 to 5): draw, select, summon a character onto a tile, show troop and base orbs.
- **Milestone 2** (Requirements 6 to 8): turns, simultaneous clash, spells.
- **Milestone 3** (Requirements 9 to 12): CPU, match end, restart, and playback input lock and cancellation.

## Glossary

- **Engine**: The pure JavaScript rules module in `src/game/`. It has no DOM, rendering, filesystem, network or model dependencies.
- **Match**: One game from seeded setup to a terminal result.
- **Round**: One sequential action phase for each side, followed by one clash. A Match has at most nine Rounds.
- **Card_Instance**: One uniquely identified card in a deck.
- **Zone**: Exactly one of deck, hand, board or discard.
- **Troop**: A summoned Card_Instance occupying a Slot, with integer health 0 to max (max 1 to 5). Health 0 means defeated.
- **Health_Orb**: One unit of Troop health, displayed above the Troop.
- **Stars**: A Troop card's summon tier. Stars are not a spendable resource.
- **Tribute**: Distinct friendly Troops chosen by the player and discarded to pay a summon.
- **Slot**: One of three positions per side. Slots facing each other form a Lane.
- **Base**: A side's structure (Saloon or Gateway) with five Base_Orbs. Base health is an integer 0 to 5.
- **Clash**: The simultaneous attack resolution at the end of a Round.
- **Action**: One validated Engine input (summon, spell, or end phase).
- **Revision**: A counter of committed Engine state changes.
- **CPU**: The deterministic computer opponent.
- **Card_UI**: The 2-D HTML overlay showing deck, hand and prompts.
- **Orb_Display**: The procedural 3-D orbs for Troops and Bases.
- **Match_Controller**: The browser-side module, not part of the Engine, that owns the committed Engine state, generates and records seeds, and sequences turns, CPU requests and playback.
- **Player_View**: `publicState(state, "cowboy")`, the human player's permitted view of the Match.
- **Presenter**: The module that plays Engine events in order against a displayed copy of the Player_View.

## Draft Card Table (working draft, balance unproven)

| Side | Card | Stars | Health | Attack | Copies |
| --- | --- | --- | --- | --- | --- |
| Cowboy | Sheriff | 2 | 3 | 1 | 6 |
| Cowboy | Billy | 5 | 4 | 2 | 3 |
| Cowboy | Mounted Billy | 7 | 5 | 3 | 1 |
| Cowboy | Deadeye (spell) | n/a | n/a | n/a | 2 |
| Wizard | Skeleton | 1 | 3 | 1 | 6 |
| Wizard | Wizard | 5 | 4 | 2 | 3 |
| Wizard | Dragon | 8 | 5 | 3 | 1 |
| Wizard | Singularity (spell) | n/a | n/a | n/a | 2 |

Deadeye removes one Health_Orb from a chosen living enemy Troop. Singularity removes one Health_Orb from a chosen enemy Troop, then optionally moves a surviving target to a chosen adjacent empty enemy Slot.

## Requirements

### Requirement 1: Seeded Deck Setup

**User Story:** As a player, I want a reproducible shuffled deck and opening hand, so that a seed replays the same match.

#### Acceptance Criteria

1. WHEN a Match is created, THE Engine SHALL give each side 12 uniquely identified Card_Instances matching the draft card table.
2. WHEN a Match is created with a seed, THE Engine SHALL shuffle each deck so that the same seed produces the same order.
3. WHEN a Match is created, THE Engine SHALL deal four cards to each hand and SHALL draw no card in Round 1.
4. WHEN a Round from 2 to 9 begins, THE Engine SHALL move one card from each side's deck to that side's hand if the deck is not empty.
5. WHILE a deck is empty, THE Engine SHALL continue the Match.
6. THE Engine SHALL keep each Card_Instance in exactly one Zone at all times.
7. THE Engine SHALL create no new Card_Instance after Match creation.
8. THE Engine SHALL set each Base to five orbs and provide three Slots per side at Match creation.
9. THE Engine SHALL require an explicit integer seed and SHALL NOT generate one.
10. WHEN a new Match is started without a supplied seed, THE Match_Controller SHALL generate an integer seed and pass it to the Engine.
11. WHERE a seed is supplied for testing through a seed field or `?seed=` parameter, THE Match_Controller SHALL pass that seed to the Engine.
12. THE Match_Controller SHALL record the seed used and THE Card_UI SHALL display it in the match details so that the Match can be replayed.
13. THE Engine SHALL NOT reshuffle a deck or offer a mulligan after the opening deal, including for seeds 14, 27 and 47.

### Requirement 2: Card Selection

**User Story:** As a player, I want to select a card in my hand, so that I can choose where to play it.

#### Acceptance Criteria

1. THE Card_UI SHALL display the deck count, the hand count, and one element per held card showing name, stars or spell type, health and attack.
2. WHEN the player clicks a hand card during the player's action phase, THE Card_UI SHALL mark that card selected and unmark any other card.
3. WHEN the player clicks the selected card again, THE Card_UI SHALL deselect it.
4. WHILE it is not the player's action phase, THE Card_UI SHALL ignore hand clicks.
5. WHEN a selection is cancelled, THE Card_UI SHALL leave Engine state, card Zones and RNG unchanged.
6. THE Engine SHALL apply no hand size limit and SHALL NOT force discarding.

### Requirement 3: Atomic Summon and Tribute

**User Story:** As a player, I want to summon a troop and pay its tribute in one step, so that a mistake never costs me cards.

#### Acceptance Criteria

1. THE Engine SHALL require zero Tribute for 1 to 4 stars, one Troop for 5 to 6 stars, and two Troops for 7 or more stars.
2. WHEN a summon Action is submitted, THE Engine SHALL validate the card, Tribute and destination Slot before changing any state.
3. WHEN a summon Action is valid, THE Engine SHALL commit the card, Tribute, destination and summon allowance together.
4. THE Engine SHALL accept only distinct friendly Troops as Tribute.
5. WHEN the board is full and Tribute is paid, THE Engine SHALL allow the destination to be a Slot vacated by that Tribute.
6. WHEN a summon completes, THE Engine SHALL set the Troop's health to its maximum and move each Tribute Card_Instance to discard exactly once.
7. IF a summon Action is invalid, stale, duplicate, wrong-side or already used this Round, THEN THE Engine SHALL reject it and leave state, card Zones and RNG unchanged.
8. THE Engine SHALL allow each side at most one summon per Round.

### Requirement 4: Tribute Selection Flow

**User Story:** As a player, I want to pick tribute and a destination before confirming, so that I control what I give up.

#### Acceptance Criteria

1. WHEN the player selects a troop card requiring Tribute, THE Card_UI SHALL prompt for the required number of friendly Troops.
2. IF the player has fewer friendly Troops than the Tribute required, THEN THE Card_UI SHALL show a message stating the shortfall and SHALL NOT start tribute selection.
3. WHEN the player cancels at any step, THE Card_UI SHALL discard the pending selection and submit no Action.
4. WHEN the player confirms card, Tribute and destination, THE Card_UI SHALL submit one summon Action with an action ID and the expected Revision.
5. IF the player chooses an occupied or opposing Slot that is not vacated by Tribute, THEN THE Card_UI SHALL show a message that the Slot is invalid.

### Requirement 5: Orb Display

**User Story:** As a player, I want to see health orbs on troops and bases, so that I can read health at a glance.

#### Acceptance Criteria

1. WHILE a Troop model is displayed, THE Orb_Display SHALL show exactly as many Health_Orbs above the Troop as the Troop's displayed health.
2. WHILE a Base's displayed health is B from 0 to 5, THE Orb_Display SHALL show exactly B Base_Orbs for that Base.
3. WHEN the impact cue of a damage or spell event plays, THE Orb_Display SHALL change that target's displayed orbs from the event's `before` value to its `after` value.
4. THE Orb_Display SHALL generate orbs procedurally without requiring orb assets.
5. WHEN a summon event is emitted, THE renderer SHALL place the Troop at the destination Slot's world position.
6. WHEN a Troop's displayed health reaches zero during a Clash, THE renderer SHALL keep the Troop model in place with zero orbs until every attack in that Clash snapshot has finished, including the defeated Troop's own attack, and SHALL then remove the model.
7. WHEN a spell defeats a Troop, THE renderer SHALL remove the Troop model after the spell's impact cue finishes.
8. WHEN a Clash is presented, THE renderer SHALL play the attack of every Troop in the Clash snapshot and SHALL NOT skip or cancel an attack because its attacker reached zero health.

### Requirement 6: Round Flow

**User Story:** As a player, I want clear sequential turns without a timer, so that I can decide at my own pace.

#### Acceptance Criteria

1. WHEN a Match is created, THE Engine SHALL choose the starting side from the seed and alternate the starting side each Round.
2. WHILE a side's action phase is active, THE Engine SHALL permit at most one summon and at most one spell cast by that side.
3. WHEN a side submits an end-phase Action, THE Engine SHALL end that side's action phase.
4. IF a side casts a spell and also summons in the same Round, THEN THE Engine SHALL require the summon to precede the spell.
5. THE Engine SHALL apply no time limit to an action phase.
6. WHEN both sides have ended their action phases, THE Engine SHALL resolve one Clash and begin the next Round unless the Match is terminal.
7. THE Engine SHALL reject each Action that carries a stale Revision or a previously committed action ID.

### Requirement 7: Clash

**User Story:** As a player, I want all lanes to fight at once, so that outcomes do not depend on lane order.

#### Acceptance Criteria

1. WHEN a Clash begins, THE Engine SHALL snapshot every Troop's attack from the same state, including newly summoned Troops.
2. WHEN a lane has an opposing Troop, THE Engine SHALL apply the attacker's full attack to that Troop and apply no excess to the Base.
3. WHEN a lane has no opposing Troop, THE Engine SHALL reduce the opposing Base health by the attacker's full attack, for both factions.
4. THE Engine SHALL clamp all health at zero.
5. WHEN all damage is applied, THE Engine SHALL remove defeated Troops to discard exactly once, then decide the result.
6. THE Engine SHALL apply Clash damage to both sides in a single resolution without halting after the first Base reaches zero.

### Requirement 8: Spells

**User Story:** As a player, I want spells with real effects, so that I have options beyond summoning.

#### Acceptance Criteria

1. WHEN the side holding a Deadeye submits an Action targeting a living enemy Troop, THE Engine SHALL remove one Health_Orb from that Troop, whether or not the caster's own board is empty.
2. WHEN the side holding a Singularity submits an Action, whether or not the caster's own board is empty, THE Engine SHALL remove one Health_Orb from the chosen enemy Troop and, if the Action names a destination and the Troop survives, move it to that adjacent empty enemy Slot, as one validated Action.
3. IF a spell has no valid target, THEN THE Engine SHALL reject the cast and keep the card in hand.
4. IF a Singularity Action names a destination that is not an adjacent empty enemy Slot or whose target is defeated, THEN THE Engine SHALL reject the entire Action.
5. WHEN a spell resolves, THE Engine SHALL move the spell Card_Instance to discard exactly once and any defeated target to discard exactly once.
6. THE Engine SHALL count a spell cast against the side's one-cast-per-Round limit only after validation succeeds.

### Requirement 9: CPU Opponent

**User Story:** As a player, I want a predictable CPU opponent, so that every match has an opponent that plays fairly.

#### Acceptance Criteria

1. WHEN it is the CPU's action phase, THE CPU SHALL choose only from the Engine's legal Actions.
2. THE CPU SHALL receive only `publicState(state, "wizard")` as Match input.
3. THE CPU SHALL choose by a documented heuristic with deterministic tie-breaks and SHALL NOT use a language model.
4. WHEN the same seed and inputs are replayed, THE CPU SHALL choose the same Actions.
5. WHEN no summon or spell is legal, THE CPU SHALL submit an end-phase Action.
6. THE CPU SHALL control the Wizards side in the first playable version.

### Requirement 10: Match Result

**User Story:** As a player, I want a clear win, loss or draw, so that the match has a definite end.

#### Acceptance Criteria

1. WHEN a Clash leaves both Bases at zero, THE Engine SHALL record a draw.
2. WHEN a Clash leaves exactly one Base at zero, THE Engine SHALL record that side as the loser.
3. WHEN the Round 9 Clash completes with neither Base at zero, THE Engine SHALL record the side with higher Base health as the winner, or a draw if equal.
4. WHILE a Match is terminal, THE Engine SHALL reject all Actions.
5. WHEN a result is recorded, THE Card_UI SHALL display Victory, Defeat or Draw from the Player_View result outcome (`win`, `loss` or `draw`) and a restart control.

### Requirement 11: Restart, Engine API and Replay

**User Story:** As a developer and player, I want a pure engine API and clean restart, so that matches replay and the renderer stays separate.

#### Acceptance Criteria

1. THE Engine SHALL expose functions to create a seeded Match, list legal Actions, apply an Action, and derive public state and events.
2. THE Engine SHALL contain no DOM, rendering, filesystem, network or model dependencies.
3. WHEN the same seed and Action sequence are applied, THE Engine SHALL produce identical state and events.
4. WHEN the player activates restart, THE Match_Controller SHALL start a new Match by passing to `createMatch` the supplied seed if a seed was pinned, or otherwise a newly generated seed.
5. WHEN a restart occurs, THE renderer and Card_UI SHALL remove all troop models, orbs and result displays from the previous Match before showing the new state.

### Requirement 12: Playback, Input Lock and Cancellation

**User Story:** As a player, I want each action and Clash to play out in order before I can act again, so that what I see always matches the Match.

#### Acceptance Criteria

1. THE Card_UI, Presenter and renderer SHALL read only the Player_View and Engine events, and SHALL NOT read the full Engine state.
2. THE Presenter SHALL apply damage values from Engine events and SHALL NOT compute damage.
3. WHEN the playback queue drains, THE Presenter SHALL hold a displayed state equal to the current Player_View.
4. IF the Presenter receives an unsupported event type, THEN THE Presenter SHALL raise an explicit development error naming the type and SHALL NOT skip the event silently.
5. WHILE playback is running, THE Match_Controller SHALL ignore hand, Slot and end-phase input and submit no Action.
6. THE Match_Controller SHALL request a CPU Action only after the playback queue drains.
7. WHEN a restart or a switch between Orb Duel and the attack demo occurs, THE Match_Controller SHALL cancel all pending animation callbacks, impact callbacks and queued CPU Actions of the previous Match.
8. IF a callback or CPU Action from a previous Match fires after a restart or mode switch, THEN THE Match_Controller SHALL discard it without changing the new Match's Engine state, displayed state or renderer.
9. WHEN the player switches mode, THE renderer SHALL keep the existing attack demo available and unchanged.

## Asset Gaps

Existing in `assets/models/` (static exports; the audit of these eight GLBs found no skins, joints or clips): `billy.glb`, `wizard.glb`, `board.glb`, `cowboy-tile.glb`, `wizard-tile.glb`, `saloon.glb`, `gateway.glb`, `revolver.glb`. Billy and Wizard motion is procedural in the renderer.

Card concept references (approved direction, production textures and their import PENDING):
- Approved card BACK concept: `~/Downloads/Amethyst Horseshoe Arcana.png` (1060x1484, brass horseshoes and amethyst on dark red-purple). The unaudited `~/Downloads/card back 3d model.glb` is about 70 MB and outside the repo.
- Approved card FRONT concept: file not yet identified (see Open Questions).
- The crown-and-dust card files in Downloads belong to another project and are not references.

Missing:
- Models and explicit asset and animation tasks for Sheriff, Mounted Billy, Skeleton and Dragon.
- Animation clips or rigs for those four troops beyond the existing procedural rig.
- Production card front and back textures and their import (card designs are not to be redesigned).
- Spell-effect art for Deadeye as a card (an existing revolver shot exists) and Singularity relocation visuals beyond the existing demo effect.
- Audio beyond synthesized prototype sounds.

### Requirement 13: Prototype Asset Fallbacks

These acceptance criteria describe the retired lane duel.

#### Acceptance Criteria

1. THE Engine SHALL use the card table statistics regardless of which models exist.
2. WHERE a model is missing, THE renderer SHALL show a clearly labelled temporary stand-in, and THE renderer SHALL NOT present duplicated Billy or Wizard models or placeholder movement as final assets.
3. THE Card_UI SHALL render plain HTML text cards as a temporary visual that is not the final approved design.
4. THE Orb_Display SHALL use procedural orbs.
5. THE renderer SHALL preserve the existing attack demo and approved haunted Western art.
6. The unaudited `card back 3d model.glb` SHALL NOT be committed raw.

## Decisions and Open Questions

Decisions recorded: the human controls Cowboys and the CPU controls Wizards; the 12-card decks and nine-round limit are unproven balance defaults. Seeds 14, 27 and 47 are known opening-hand playtest concerns (job A tests found no zero-tribute troop in the active side's opening hand). Card concept direction is approved and not to be redesigned.

Unresolved:
- **OQ-A**: Which file is the approved card FRONT concept? The user must name it.
- **OQ-B**: Is the 12-card, nine-round balance acceptable? Playtesting is pending, including seeds 14, 27 and 47.
- **OQ-C**: What animation approach will Sheriff, Mounted Billy, Skeleton and Dragon use? Asset and animation tasks are required.
