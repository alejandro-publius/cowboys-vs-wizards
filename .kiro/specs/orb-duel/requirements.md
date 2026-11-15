# Requirements Document

## Introduction

Orb Duel adds a full card-match game mode to the Cowboys vs. Wizards board prototype. The player builds a hand of troop and spell cards, summons characters onto the three-lane board, and battles a CPU opponent. Each base starts with five orbs; the first side to lose all five orbs loses the match. Troops display 1–5 orbs above their heads. The match proceeds in rounds: both sides take actions simultaneously, then troops clash across matching lanes.

The feature builds on `src/render/scene.js`, `src/render/rig.js`, and `src/physics/gravity.cjs` without replacing existing "fire / cast / exchange" playback. All new logic is additive.

> **Milestone 1** covers the draw-select-summon-display loop: drawing a card, selecting it in the hand UI, placing a troop onto a tile, and showing its health orbs. Requirements 1–5 define Milestone 1 in full detail. Requirements 6–13 define the broader match rules and are staged for later milestones.

---

## Open Questions — Must Be Resolved Before Later Milestones

The following questions have no answer in the current codebase or design brief. They are flagged here so the user can review and decide before the design and task phases cover those milestones.

> **OQ-1 — Troop attack values**: No damage per attack is defined. What attack damage does each troop deal per combat step?
>
> **OQ-2 — Spell effects**: Beyond the existing singularity and revolver animations, what do spell cards do? Do they deal direct damage, buff troops, debuff enemies, or something else? Which animations already in `makeEffects()` can be reused?
>
> **OQ-3 — Lane-matching with multiple troops**: When a player controls troops in more than one lane, does each troop attack only the troop directly across from it (1:1 pairing), or does a troop attack the first troop it reaches regardless of lane?
>
> **OQ-4 — Open-lane stacking**: If a player has troops in lanes 1 and 2 but lane 3 is open, can the lane-3 attack hit the base multiple times in the same round (e.g., once for each unblocked troop), or at most once per round?
>
> **OQ-5 — Sacrifice selection**: When a troop summon costs one or two sacrifices, does the player choose which friendly troop(s) to remove, or does the system auto-remove the weakest or oldest?
>
> **OQ-6 — CPU AI strategy**: Should the CPU play randomly (pick a legal action uniformly at random), use a simple priority rule (always summon the highest-star troop it can afford), or something more elaborate?
>
> **OQ-7 — Star ratings for existing characters**: What star rating does Billy (cowboy troop) have? What star rating does the wizard have? This determines sacrifice cost.
>
> **OQ-8 — Hand size cap**: Is there a maximum number of cards the player may hold? If a draw would exceed the cap, is the drawn card discarded or is the draw skipped?
>
> **OQ-9 — Spell targeting**: Can a spell target friendly troops, enemy troops, the opposing base, or any subset? Is targeting freeform or card-specific?
>
> **OQ-10 — Round resolution order**: When both players finish their actions, are combat steps resolved simultaneously (damage applied to both sides at once) or sequentially (player attacks first, then CPU)?

---

## Glossary

- **Match**: A complete game session from first draw through victory, defeat, or draw.
- **Round**: One cycle in which both players take actions and then combat resolves.
- **Hand**: The cards currently available to a player, dealt from the player's Deck.
- **Deck**: A fixed 12-card set of Troop_Cards and Spell_Cards belonging to one player.
- **Troop_Card**: A card that summons a Troop onto a Tile when played.
- **Spell_Card**: A card that triggers an effect without placing a Troop.
- **Troop**: A character occupying a Tile on the board, with an attack value and health orbs.
- **Tile**: One of the six board positions (indices 0–5). Tiles 0–2 are on the cowboy side; tiles 3–5 are on the wizard side.
- **Friendly Tile**: A Tile on the same side of the board as the acting player (cowboy tiles 0–2 for the human player, wizard tiles 3–5 for the CPU).
- **Empty Tile**: A Tile with no Troop currently occupying it.
- **Lane**: A matched pair of tiles facing each other across the board (tile 0 ↔ tile 3, tile 1 ↔ tile 4, tile 2 ↔ tile 5).
- **Troop Zone**: The set of three Friendly Tiles belonging to one side.
- **Base**: Each side's structure on the board (Saloon for the cowboy side, Gateway for the wizard side), represented by five Base_Orbs.
- **Base_Orb**: One of the five orbs representing a Base's remaining life. Destroying all five Base_Orbs on a side ends the match.
- **Troop_Orb**: One of the 1–5 orbs displayed above a Troop, representing its remaining health points.
- **Star_Cost**: The mana-like cost printed on a card (1–8 stars).
- **Starting Pool Size**: The total number of cards belonging to one player at the start of a Match, equal to 12.
- **Sacrifice**: Removing a friendly Troop from a Tile to reduce the Star_Cost threshold for summoning a higher-cost Troop.
- **Action_Phase**: The portion of a Round in which each player selects summons and spells before combat resolves.
- **Combat_Phase**: The portion of a Round in which Troops attack across matching Lanes.
- **CPU**: The computer-controlled opponent.
- **Orb_Display**: The 3-D orb meshes rendered above a Troop or alongside a Base.
- **Card_UI**: The 2-D HTML overlay showing the player's Hand, turn indicator, and round counter.
- **Game_Controller**: The JavaScript module that owns match state (round, hands, board occupancy, scores) and drives the Round loop.
- **Troop_Registry**: The data structure mapping card IDs to troop stats (star cost, max health orbs, attack value, character kind, height).
- **Spell_Registry**: The data structure mapping spell card IDs to spell effects and targeting rules.

---

## Requirements

### Requirement 1: Deck Initialisation and Opening Hand

**User Story:** As a player, I want to start a match with four cards in my hand drawn from a shuffled 12-card deck, so that every match begins from a randomised but bounded set of choices.

#### Acceptance Criteria

1. WHEN a Match begins, THE Game_Controller SHALL initialise each player's Deck with exactly 12 cards, where the Deck contains at least one card at each integer Star_Cost value from 1 to 8.
2. WHEN a Match begins, THE Game_Controller SHALL shuffle each Deck using a seeded pseudo-random function and SHALL record the seed so that replaying the Match with the same seed produces the same shuffle order.
3. IF no seed is provided at Match start, THEN THE Game_Controller SHALL generate a seed automatically and expose it to both players before the first Round begins.
4. WHEN a Match begins, THE Game_Controller SHALL deal exactly four cards to each player's Hand from the top of their shuffled Deck.
5. WHEN a Match begins, THE Game_Controller SHALL verify that the four dealt cards are a subset of the original 12-card Deck and that the union of the Hand and the remaining undealt Deck cards equals the original 12-card Deck with no duplicated card instances; IF this invariant is violated, THEN THE Game_Controller SHALL halt the Match and report an error indicating a deck integrity failure.

> **Asset gap**: No card definitions (names, art, star costs, stats) exist in the repository. A `cardData.js` or equivalent module must be created before this requirement can be fully implemented. See OQ-7 for star rating decisions.

---

### Requirement 2: Per-Round Card Draw

**User Story:** As a player, I want to draw one card at the start of each round after the first, so that my options expand as the match progresses.

#### Acceptance Criteria

1. WHEN a Round begins, IF the Round number is greater than 1, THE Game_Controller SHALL move the top card of the active human player's Deck to the bottom of that player's Hand.
2. WHEN a Round begins, IF the Round number is greater than 1 and the active human player's Deck contains zero cards, THE Game_Controller SHALL leave the player's Hand unchanged and advance to the next step of the round.
3. WHEN a Round begins, IF the Round number is greater than 1, THE Game_Controller SHALL move the top card of the CPU player's Deck to the bottom of the CPU player's Hand, applying the same draw rules as for the human player.
4. WHEN a Round begins, IF the Round number is greater than 1 and the CPU player's Deck contains zero cards, THE Game_Controller SHALL leave the CPU player's Hand unchanged and advance to the next step of the round.
5. THE Game_Controller SHALL maintain the invariant that, for each player, the count of cards in Hand plus the count of cards remaining in Deck equals that player's Starting Pool Size minus the total number of cards that player has played in all previous rounds.

> **Open question OQ-8**: No hand size cap is defined. This requirement assumes unlimited hand size until OQ-8 is resolved.

---

### Requirement 3: Card Selection in the Hand UI

**User Story:** As a player, I want to click a card in my hand to select it, so that I can then choose where to summon or cast it.

#### Acceptance Criteria

1. THE Card_UI SHALL render one card element per card in the player's Hand, displaying the card's name, Star_Cost, and type (troop or spell).
2. WHEN the player clicks a card element, THE Card_UI SHALL mark that card as selected by applying a selected visual state — defined as a raised vertical offset of 12px and a highlighted border — and SHALL remove the selected visual state from any other card in the hand.
3. WHEN a selected card is clicked again, THE Card_UI SHALL deselect it by removing the selected visual state and returning the card to the same visual state as an unselected card.
4. WHILE the Action_Phase is not active, THE Card_UI SHALL render all cards in the hand in a visually disabled state and SHALL ignore any click events on card elements without hiding the hand.
5. WHEN the player clicks a card element while another card is already selected, THE Card_UI SHALL deselect the previously selected card and apply the selected visual state to the newly clicked card.
6. IF the selected card is a Troop_Card and all three friendly Tiles are occupied, THEN THE Card_UI SHALL display an inline message directly below the hand row indicating that no empty tile is available, and SHALL NOT proceed to tile selection.
7. WHERE spell targeting is not yet implemented (Milestone 1 scope), THE Card_UI SHALL accept Spell_Card selection but SHALL display a placeholder message directly below the hand row indicating that spell targeting is not yet available, rather than proceeding to any targeting flow.

> **Asset gap**: No card artwork exists. Cards SHALL be rendered as styled HTML elements with text only until art assets are provided.

---

### Requirement 4: Troop Summoning onto a Tile

**User Story:** As a player, I want to place a selected Troop_Card onto one of my empty tiles, so that my troop enters the board and can fight.

#### Acceptance Criteria

1. WHEN a Troop_Card is selected and the player clicks an Empty Friendly Tile, THE Game_Controller SHALL remove the Troop_Card from the Hand and mark that Tile as occupied by the summoned Troop.
2. WHEN a Troop is summoned, THE Game_Controller SHALL call `rigActor(models[kind], kind, height)` with the character kind and the height value defined for that kind in the Troop_Registry, and add the returned root to the Three.js scene at the Tile's world position.
3. WHEN a Troop is summoned, THE Game_Controller SHALL set the Troop's initial health to the max health orbs defined in the Troop_Registry for that card.
4. IF the player has already summoned one Troop this round, THEN THE Game_Controller SHALL reject a second summon attempt and display an inline message stating the per-round summon limit of one has been reached.
5. IF the selected Troop_Card has a Star_Cost of 5 or 6 and the player has zero friendly Troops currently occupying board Tiles, THEN THE Game_Controller SHALL reject the summon and display an inline message stating one sacrifice is required.
6. IF the selected Troop_Card has a Star_Cost of 7 or above and the player has fewer than two friendly Troops currently occupying board Tiles, THEN THE Game_Controller SHALL reject the summon and display an inline message stating two sacrifices are required.
7. WHEN a sacrifice is required, THE Game_Controller SHALL enter a sacrifice-selection state and prompt the player to click one or two of their own occupied Tiles to designate as sacrifices before the summon completes; the player may cancel this selection, upon which THE Game_Controller SHALL return the Troop_Card to the Hand and exit the sacrifice-selection state without modifying board state.
8. WHEN a sacrifice Troop is designated, THE Game_Controller SHALL remove its `rigActor` root from the scene and free its Tile before placing the new Troop.
9. WHEN summoning completes, THE Game_Controller SHALL emit a `"summoned"` event carrying the card ID, tile index, and player side.
10. THE Game_Controller SHALL enforce that the number of occupied friendly Tiles after a summon equals the number before the summon, minus the sacrifice count, plus one.
11. IF a Troop_Card is selected and the player clicks a Tile that is either already occupied or belongs to the opponent, THEN THE Game_Controller SHALL ignore the click and display an inline message indicating the Tile is not a valid summon target.

> **Open question OQ-5**: Sacrifice selection (player choice vs. automatic) is unresolved. Requirement 4.7 assumes player choice; revise if OQ-5 is resolved differently.
>
> **Asset gap**: No Troop_Registry exists. A `troopRegistry.js` module must be created with at minimum Billy (cowboy) and the wizard as entries, including star cost (OQ-7), max health orbs (1–5), attack value (OQ-1), and height.

---

### Requirement 5: Troop Health Orb Display

**User Story:** As a player, I want to see health orbs floating above each troop on the board, so that I can read remaining health at a glance.

#### Acceptance Criteria

1. WHEN a Troop is summoned, THE Orb_Display SHALL render a row of orbs above the Troop's head, with the count equal to the Troop's max health orbs (1–5).
2. THE Orb_Display SHALL attach each orb as a Three.js `Object3D` child of the Troop's `root`, positioned 0.25 world units above the head bone along its local Y-axis and spaced 0.18 world units apart horizontally, centred on the head bone's X position, so that the row remains centred above the head across all animation poses.
3. WHILE a Troop is on the board, THE Orb_Display SHALL update orb visibility every frame so that orbs beyond the Troop's current health are hidden (opacity 0) and orbs within current health are visible (opacity 1).
4. WHEN a Troop's health reaches zero, THE Orb_Display SHALL set all of that Troop's orbs to hidden (opacity 0).
5. WHEN a Troop's health reaches zero, THE Game_Controller SHALL remove the Troop's root from the scene.
6. THE Orb_Display SHALL render Base_Orbs for each Base as five `Object3D` instances placed in world space 0.5 world units in front of the Base structure's origin, spaced 0.18 world units apart horizontally and centred on the Base structure's X position.
7. WHEN a Base takes one point of damage, THE Orb_Display SHALL hide the rightmost visible Base_Orb for that Base.
8. THE Orb_Display SHALL render each orb with a minimum opacity of 1.0 and an emissive intensity sufficient to remain distinguishable under the existing hemisphere and directional lighting without requiring new light sources.
9. WHILE a Troop is on the board with current health H where H is in [1, maxHealth], THE Orb_Display SHALL keep exactly H Troop_Orbs visible and all remaining Troop_Orbs hidden for that Troop.
10. WHILE a Base has current health B where B is in [0, 5], THE Orb_Display SHALL keep exactly B Base_Orbs visible and all remaining Base_Orbs hidden for that Base.

> **Asset gap**: No orb mesh or sprite exists. The Orb_Display SHALL generate orbs procedurally (e.g., `THREE.OctahedronGeometry`) with an emissive material until dedicated assets are provided.

---

### Requirement 6: Action Phase and Round Structure

**User Story:** As a player, I want each round to have a clear action window followed by automatic combat, so that the match feels structured and predictable.

#### Acceptance Criteria

1. THE Game_Controller SHALL advance the match through Rounds in sequence, beginning with Round 1.
2. WHEN a Round begins, THE Game_Controller SHALL enter the Action_Phase, start a 60-second countdown timer, and permit the player to perform at most one summon action and at most one spell play action during that phase.
3. IF the player attempts a second summon or a second spell play within the same Action_Phase, THEN THE Game_Controller SHALL reject the action and display an error indicating that the action limit for that type has been reached for this round.
4. WHEN the player confirms their actions, THE Game_Controller SHALL immediately end the Action_Phase countdown and execute the CPU's Action_Phase turn, then enter the Combat_Phase.
5. IF the 60-second Action_Phase timer expires before the player confirms, THEN THE Game_Controller SHALL execute the CPU's Action_Phase turn with whatever actions the player had performed, then enter the Combat_Phase.
6. WHEN the Combat_Phase begins, THE Game_Controller SHALL resolve combat for Lane 1, then Lane 2, then Lane 3 in that fixed order before returning to the next Round's Action_Phase.
7. WHEN the Game_Controller transitions to a new phase, THE Card_UI SHALL update to display the current round number and the active phase (player Action_Phase, CPU Action_Phase, or Combat_Phase).

> **Open question OQ-10**: Simultaneous vs. sequential damage resolution is unresolved. Requirement 6.6 fixes lane ordering; the resolution order within each lane defers to the design phase after OQ-10 is resolved.

---

### Requirement 7: Lane Combat Resolution

**User Story:** As a player, I want troops to fight the troop directly across from them in the same lane, so that lane strategy matters.

#### Acceptance Criteria

1. WHEN the Combat_Phase begins for a Lane that has a Troop on both sides, THE Game_Controller SHALL apply each Troop's attack value as damage to the opposing Troop's health, where damage equals the attacking Troop's attack value as a whole number subtracted from the defending Troop's current health.
2. WHEN the Combat_Phase begins for a Lane that has a friendly Troop but no opposing Troop, THE Game_Controller SHALL apply that Troop's attack value as damage to the opposing Base, reducing the opposing Base's health by a whole number equal to the attacking Troop's attack value.
3. WHEN the Combat_Phase begins for a Lane that has an opposing Troop but no friendly Troop, THE Game_Controller SHALL apply no damage to the friendly Base from that Lane.
4. IF a Troop's health falls to zero or below after all three Lanes have been resolved in the current Combat_Phase, THEN THE Game_Controller SHALL remove that Troop from its Tile and trigger the Orb_Display removal animation.
5. THE Game_Controller SHALL resolve all three Lanes in a single Combat_Phase before any Troop is removed, so that mutual kills are evaluated after all damage has been applied across all Lanes.
6. IF a Base's health falls to zero or below after all three Lanes have been resolved in the current Combat_Phase, THEN THE Game_Controller SHALL mark that Base as defeated and prevent further damage from being applied to it in subsequent Combat_Phases.
7. WHEN the Combat_Phase begins, THE Game_Controller SHALL resolve Lanes in a fixed order from Lane 1 to Lane 3 for damage calculation purposes, with all removals deferred until after Lane 3 is resolved.

> **Open question OQ-1**: Attack values are undefined. Placeholder values must be assigned in the Troop_Registry until OQ-1 is resolved.
> **Open question OQ-3**: Lane 1:1 pairing is assumed here; revise if OQ-3 is resolved differently.
> **Open question OQ-4**: Open-lane multi-hit stacking is assumed to be capped at one Base_Orb per open lane per Combat_Phase; revise if OQ-4 is resolved differently.

---

### Requirement 8: Spell Card Play

**User Story:** As a player, I want to play a spell card during the action phase to trigger a targeted effect, so that I have tactical options beyond troop placement.

#### Acceptance Criteria

1. WHEN the player plays a Spell_Card during the Action_Phase, THE Game_Controller SHALL remove the Spell_Card from the Hand and prompt the player to designate a target if the spell's targeting rules in the Spell_Registry require one.
2. WHEN the player confirms a designated target for a Spell_Card during the Action_Phase, THE Game_Controller SHALL look up the spell's effect and targeting rules in the Spell_Registry and apply the effect to the designated target.
3. IF the Spell_Card requires a target and no valid target exists on the board, THEN THE Game_Controller SHALL return the Spell_Card to the Hand and display an inline message indicating no valid target is available.
4. THE Game_Controller SHALL allow at most one Spell_Card play per player per Round; IF the player attempts to play a second Spell_Card in the same Round, THEN THE Game_Controller SHALL reject the action and display an inline message indicating the spell limit for the Round has been reached.
5. WHEN a spell effect is applied, THE Game_Controller SHALL emit a `"spell-played"` event carrying the card ID, caster side, and a target descriptor containing the target's board position and unit identifier.
6. IF the Spell_Card requires a target, THEN THE Game_Controller SHALL define a valid target as any unit or board position that satisfies the targeting rules specified for that spell in the Spell_Registry.

> **Open question OQ-2**: Spell effects are undefined. The Spell_Registry cannot be fully specified until OQ-2 is resolved.
> **Open question OQ-9**: Spell targeting scope is undefined. This requirement defers targeting rules to the design phase after OQ-9 is resolved.

---

### Requirement 9: CPU Opponent Decision-Making

**User Story:** As a player, I want the CPU opponent to take legal actions each round, so that every match has an opponent to play against.

#### Acceptance Criteria

1. WHEN it is the CPU's Action_Phase, THE Game_Controller SHALL evaluate all legal actions available to the CPU, where a legal action is a summon whose star cost is covered by the CPU's current stars and whose target board zone is unoccupied, or a spell card present in the CPU's hand whose resource cost is met.
2. WHEN it is the CPU's Action_Phase and at least one legal action exists, THE Game_Controller SHALL select one legal action at random from the set of legal actions and execute it.
3. WHEN it is the CPU's Action_Phase, THE Game_Controller SHALL complete action selection and execution within 50 milliseconds, measured from the start of the CPU's Action_Phase to the moment the selected action is applied to game state.
4. IF the CPU has no legal action because its hand is empty, all board zones it controls are occupied, or its current stars are fewer than the star cost of every card in its hand, THEN THE Game_Controller SHALL record a pass for the CPU's action and advance to the next phase without modifying game state.
5. WHILE the CPU's Action_Phase is active, THE Game_Controller SHALL enforce that the CPU performs at most one summon and at most one spell play, applying the same per-round limits as the player.

> **Open question OQ-6**: CPU AI strategy is set to uniform-random legal-action selection as the default; revise if OQ-6 is resolved with a more sophisticated strategy.

---

### Requirement 10: Base Destruction and Match End

**User Story:** As a player, I want the match to end when a base's orbs are all destroyed, so that there is a clear win condition.

#### Acceptance Criteria

1. WHEN a Base's orb count reaches zero, THE Game_Controller SHALL halt all ongoing game actions and determine the match result before any further game state changes occur.
2. IF only the player's Base reaches zero orbs, THEN THE Game_Controller SHALL record the match result as "defeat".
3. IF only the CPU's Base reaches zero orbs, THEN THE Game_Controller SHALL record the match result as "victory".
4. IF both Bases reach zero orbs within the same Combat_Phase, THEN THE Game_Controller SHALL record the match result as "draw".
5. WHEN the Game_Controller records a match result, THE Card_UI SHALL display the result ("Victory", "Defeat", or "Draw") and a restart button within 1 second, where the restart button resets the game to its initial state as if launched fresh.
6. WHEN the player's turn begins, IF the Deck contains zero cards and the Hand contains zero cards and no player Troops are on the board, THEN THE Game_Controller SHALL record the match result as "draw" and end the match.

---

### Requirement 11: Match Restart

**User Story:** As a player, I want to restart the match from the result screen, so that I can play again without reloading the page.

#### Acceptance Criteria

1. WHEN the player clicks the restart button on the result screen, THE Game_Controller SHALL restore all Three.js scene objects to their initial positions and orientations.
2. WHEN the player clicks the restart button on the result screen, THE Game_Controller SHALL reset the round counter to 1, restore both Bases to their starting hit-point values, and rebuild both players' Decks to their full starting composition.
3. WHEN a restart occurs, THE Orb_Display SHALL remove all Troop_Orb and Base_Orb meshes from the scene.
4. WHEN a restart occurs, THE Orb_Display SHALL recreate all Base_Orb meshes for the new match with all five orbs visible.
5. WHEN a restart occurs, THE Card_UI SHALL clear the hand display and deal each player an opening hand of four cards from their newly shuffled Deck.
6. WHEN a restart occurs, THE Game_Controller SHALL hide the result screen and return the display to the in-match view.
7. IF a restart is triggered while a round resolution animation is still playing, THEN THE Game_Controller SHALL complete or cancel the animation before applying the reset, and SHALL NOT leave any scene objects in a mid-animation state.

---

### Requirement 12: Card Count and Star Cost Invariants

**User Story:** As a developer, I want the game's card and cost rules to be verifiable as invariants, so that bugs in card management are caught by automated tests.

#### Acceptance Criteria

1. THE System SHALL maintain a conservation invariant such that for each player, the sum of cards in Hand, Deck, and cards that have left Hand during the match (including played, sacrificed, and discarded cards) equals exactly the Starting Pool Size of 12.
2. WHEN a summon resolves, THE System SHALL reject the summon if the number of Troops already occupying that player's Troop Zone equals 3, leaving the Troop Zone unchanged.
3. IF a card's Star_Cost is greater than 4, THEN THE System SHALL require the player to sacrifice exactly `ceil((Star_Cost − 4) / 2)` Troops from their Troop Zone as part of the summon; IF a card's Star_Cost is 4 or less, THEN THE System SHALL require zero sacrifices.
4. WHILE the Combat_Phase is active, THE System SHALL enforce that each player has had at most one summon resolve and at most one spell resolve since the start of that round.

---

### Requirement 13: Asset Stubs for Missing Content

**User Story:** As a developer, I want placeholder implementations for every missing asset so that the game is runnable end-to-end before final art is delivered.

#### Acceptance Criteria

1. THE Troop_Registry SHALL provide at minimum two entries: a cowboy troop using `billy.glb` and a wizard troop using `wizard.glb`, each with a star cost of 1, a max health orb count of 3, and an attack value of 1.
2. THE Spell_Registry SHALL provide at minimum one entry per faction, each with an effect function that accepts its target argument and returns without modifying game state, so that spell card selection completes without throwing a runtime error.
3. IF dedicated orb assets are not present, THEN THE Orb_Display SHALL generate orb meshes procedurally using `THREE.OctahedronGeometry` with a radius of 0.2 and an emissive material.
4. IF card artwork is not present, THEN THE Card_UI SHALL render each card as a `<div>` element displaying the card's name, star cost, and type as visible text nodes.
5. WHEN a stub registry entry or stub asset source is replaced with a final asset, THE Game_Controller and display modules SHALL produce identical observable game behavior without changes to their own source files.
