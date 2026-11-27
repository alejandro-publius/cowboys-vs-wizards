# Antigravity’s art-first Showdown interface

On November 26, Antigravity proposed shorter card-face rules and aiming cues, counts on occupied 3D stacks, and a Saloon layout that gave Billy’s table more space. Git records Alex as the author of `6c6413f` on `antigravity/art-first-minimal-ui`. [Pull request #242](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/242)

Codex adapted the proposal to the playable Saloon release at `36ed4b6`.

- The Saloon opens at the character book. Each entry uses its duel hand portrait and offers a playable card move. Billy’s duel and the Hellfire table have their own stations. Antigravity’s darker summary text applies to Balance test results in the shift recording. [Saloon room](../../src/ui/showdown-3d/saloon-room.js) · [Recording styles](../../src/ui/showdown-3d/saloon-tables.css)
- Hand cards name their targets and units, including the uncovered-troop restriction in Even Fight. The illustrated aiming cue describes the current choice, with full instructions available to keyboard and screen-reader players. [Illustrated hand and prompts](../../src/ui/showdown-3d/table-ui.js) · [Hand-face checks](../../tests/match/showdown-hand-faces.test.js) · [Aiming checks](../../tests/match/art-first-minimal-ui.test.js)
- Occupied decks show their counts, graveyards show `✝` and a count, and set traps show `▲` and a count. The referee reads public counts and trap capacity, including when the stacks are empty. [Board labels](../../src/ui/showdown-3d/scene.js) · [Referee observer](../../src/ui/showdown-3d/referee-observer.js)

The staged browser check exercises the first-screen controls, looks up each book portrait in the battle atlas, and resolves combat choices with the full accessible descriptions. [Staged route checks](../../scripts/check-pages-tree.mjs) · [Book portrait checks](../../scripts/check-character-book.mjs)

During integration, Codex ran `node --test tests/match/art-first-minimal-ui.test.js`. All five checks passed, including a Guard behind a face-down trap, Even Fight targeting, and a Raise payment that returns a different troop.
