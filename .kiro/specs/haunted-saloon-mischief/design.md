# Haunted Saloon refusal guidance and route checks

## Card guidance

The shared Showdown hand already disables a card when the active seat has no legal play for it. Its inline warning and the illustrated card’s tooltip use the same text. When tribute is missing, name a free troop in the player’s own hand if one is available. When a spell has no eligible enemy target, the player can hold the spell and end the turn. Keep the warning short enough for the graybox hand to retain its position after a mouse summon.

## Browser coverage

The audit serves the staged Pages tree on loopback. It waits for route-specific content to render in desktop Chrome with reduced motion enabled. It checks accessible names using Chrome’s accessibility tree, collects duplicate document IDs, and resolves visible label and description references within the active surface.

Each regular landing exposes one main landmark. The Saloon opens a named modal dialog that excludes the background from the accessibility tree. Duel, reference, poker and Saloon landings expose polite feedback. The Replay Room reveals its step status after the player chooses a branch. On the Saloon and Replay Room routes, Enter must produce readable text in an exposed polite live region.

The JSON report identifies each tested state and its findings. A failed route or check makes the command exit unsuccessfully.
