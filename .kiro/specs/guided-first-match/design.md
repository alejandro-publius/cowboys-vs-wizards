# Design: Guided first match preview (plan)

From #35: a pure function in `src/match/guide.js` from the current selection step and the Cowboy public view to one line of advice or nothing. Steps come from `src/match/selection.js` (idle, card-selected, choosing-tribute, choosing-slot, choosing-target, choosing-destination, confirm). The line reaches the screen through the prompt path in `src/ui/card-model.js` and `src/ui/cards.js`.

Verification design:
- Walk the real seed 0 opening through `applyAction` and `publicState`, drive the selection module, and collect each step's line. Assert order (GF-1), truth against the board (GF-2) and the stop rule (GF-3).
- Hidden information: vary what the viewer cannot see; the output must stay equal (GF-4).
- Off switch: the model's prompt with the parameter absent equals today's (GF-7).
- Optional generated variation: seeds 0 to 99 with cpu play, asserting every line is non-empty, one sentence and names no Wizard hand card. The issue does not require it; do not claim it unless built.

Open decision for Rachel and Alex: the wording of each line. This plan does not write the advice.

## As built
- `guideLine({view, options, progress})` takes the Cowboy public view, `selectionOptions` output and a progress record (`trackGuide` folds Engine events: first clash via `clashLog`, first Cowboy tribute summon). `src/main.js` keeps the record only when `?guide=1` and resets it in `createMatch`.
- `cardModel({guide})` appends the line to the prompt (`prompt + " " + line`) only while accepting input; absent or empty guide leaves the prompt unchanged.
- Wording decision made by this run, not approved by Rachel or Alex.
- The optional seeds 0 to 99 generated check was not built.
