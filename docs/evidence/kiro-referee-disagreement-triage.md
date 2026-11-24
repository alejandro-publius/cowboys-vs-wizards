# Referee disagreement triage: first divergences, not downstream errors

2026-11-23 (America/Los_Angeles). Kiro CLI, model claude-opus-5.5. Read-only triage of the preserved first run. Nothing was rerun, and no game, adapter or referee file changed.

## Sources read

- Receipt: `proof/referee/receipts/first-run-6e2f2f904791e114e177577277ca4efee52a59b2d9b1e23d751daba2fa16fcd6.json`. Baseline head `4bdd86b4`, referee tree `b37a1478…`, 2,500 inputs, 155,868 actions, 2,613 mismatches in 45 duels (92 rejected-by-engine, 253 rejected-by-referee, 2,268 state). 2,477 of 2,500 duels completed.
- Per-duel data: the matching `.mismatches.jsonl`. Each line is one duel with `duel`, `seed`, `firstStep`, `firstTurn` and every mismatch from the first divergence on. Lines run about 190 KB each (8.4 MB for 45 lines), so I read three of them in full: lines 1 to 3, in duel order.
- Code: `src/game/showdown/rules.js` (`legalActions`, `applyAction`), `scripts/referee/engine.mjs` (`canonicalAction`, `applyInput`), `scripts/referee/adapter.mjs`, and `proof/referee/SCHEMA.md` (referee rulings R1 to R17).
- Rulebook: I did not reread it. The rulebook comparison below comes from the earlier note [`kiro-referee-first-divergence.md`](kiro-referee-first-divergence.md).

## Why 45 observations, not 2,613

After the first divergence, the engine state and the referee state differ, and every later step is compared on top of that difference. In the three duels I read, nearly all of the later mismatches have the same JSON paths as the first divergence (the Hellfire card in hand versus in the discard, and `allowances.other`). The rest follow directly from it:

- **Seed 180, step 16, rejected-by-referee.** The Wizard casts Hellfire for real on turn 5. The engine accepts it. The referee rejects it with `card-not-in-hand` because it already discarded Hellfire on turn 1. From then on the troops' orbs differ, and the duels split: Ranger dies only in the engine, and the steps 22, 35 and 38 rejections follow from that.
- **Seed 228, step 25.** The same pattern. In the engine, the real Hellfire leaves Billy on 2 orbs. On step 46, Imp (3 attack) kills Billy with 1 excess orb in the engine and with no excess in the referee, so the Cowboy Base reads 4 in one state and 5 in the other.

None of these later errors is an independent rules finding. Each duel contributes one observation: its first divergence.

## Clusters

### C1. Hellfire with no enemy troops: verified in 3 of 45 duels

| Duel | Seed | Step | Turn | First side | Board when cast |
| ---: | ---: | ---: | ---: | --- | --- |
| 108 | 109 | 1 | 1 | Wizard | both boards empty |
| 179 | 180 | 2 | 1 | Wizard | own Bone Wall only, Cowboy board empty |
| 227 | 228 | 2 | 1 | Wizard | own Jack-o'-Lantern only, Cowboy board empty |

In all three, the action is `{type: "spell", cardId: "wizard-hellfire-1"}` with no target.

- **Engine:** rejects it as `illegal`. `legalActions` lists an untargeted spell only when `enemy.board.some(Boolean)` (rules.js, spell branch).
- **Adapter:** not involved. `canonicalAction` passes the action through unchanged, and the `illegal` result comes from `applyAction`.
- **Referee:** accepts it. SCHEMA.md ruling R10 says: "Hellfire with no enemy troops is accepted and does nothing." The card goes to the discard and `other` is used.
- **Rulebook:** silent, according to the earlier note (§4.3 and the §10 "chooses none" line). The rulebook header says the code wins.

This is a rule the engine enforces but the rulebook never states. It is not a referee bug. Whether to keep the restriction is a gameplay decision for Fable (issue 143).

### C2. Later copies of a card: unverified hypothesis

`legalActions` skips a card if a card with the same name has already been listed (`seen.has(card.name)`). So only the first copy in hand order can be played, and `applyAction` rejects any later copy. `engine.mjs` documents this. The referee has no such rule. If a probe plays a later copy, the first divergence would be rejected-by-engine on a summon, spell, gear, set or location whose `cardId` is not the first copy of that name in hand. None of the three duels I read shows it: seed 228 step 20 plays `cowboy-billy-2` when it comes before `billy-1` in hand, and the engine accepts it.

### C3. Tribute order: unverified hypothesis

`canonicalAction` sorts tributes ascending, so tributed troops reach the discard in slot order. The referee discards them in the listed order (R6). A summon with descending tributes, such as `[1,0]`, would give a first divergence of kind `state` with paths only under `$.players.<side>.discard`. None of the three duels shows it.

### The other 42 duels

Not classified. All three duels I read are C1 and are the first three by duel index, but that does not show the other 42 are C1. I make no claim about them.

## Verified and unresolved

| Item | Status |
| --- | --- |
| C1 in seeds 109, 180 and 228; engine, adapter and referee behaviour as stated | Verified from the preserved data and the code |
| Later mismatches in those three duels come from their first divergence | Verified by reading every mismatch in all three lines |
| Rulebook silent on Hellfire with no enemy troops | From the earlier note; not reread here |
| First-divergence cluster for the other 42 duels | Unresolved |
| C2 and C3 actually present in the data | Unresolved |
| Why 23 inputs did not complete | Unresolved. `prove.mjs` defines "completed" and I did not read it |
| `.mismatches.jsonl` sha256 matches the receipt's `fe886900…` | Not checked |

## Smallest unblockers

1. **Classify all 45 without a rerun.** Read only `mismatches[0]` from each line of the preserved file. Run from the repository root:

   ```sh
   node -e '
   const fs = require("fs");
   const f = "proof/referee/receipts/first-run-6e2f2f904791e114e177577277ca4efee52a59b2d9b1e23d751daba2fa16fcd6.mismatches.jsonl";
   for (const line of fs.readFileSync(f, "utf8").split("\n")) {
     if (!line.trim()) continue;
     const d = JSON.parse(line), m = d.mismatches[0], s = m.engine.state;
     const foe = s.active === "cowboy" ? "wizard" : "cowboy";
     console.log(JSON.stringify({duel: d.duel, seed: d.seed, step: m.step, turn: m.turn, kind: m.kind,
       action: m.action, refReason: m.referee.reason, enemyTroops: s.players[foe].troops.filter(Boolean).length,
       hand: s.players[s.active].hand, paths: m.paths, later: d.mismatches.length - 1}));
   }'
   ```

   To classify each line: a Hellfire spell with `enemyTroops: 0` is C1. A rejected-by-engine play whose `cardId` is not the first copy of its name in `hand` is C2. A `state` divergence on a summon with descending `tributes` and paths only under `discard` is C3. Anything else is a new cluster and needs the rules.js, SCHEMA.md and RULEBOOK.md comparison done here for C1.
2. **Get a ruling on C1.** Ask Fable whether Hellfire may be cast with no enemy troops. If the engine's restriction stays, the rulebook needs a line saying so, and the frozen referee's R10 needs a re-freeze by its owner. If the restriction goes, the engine needs a change cited against an approved requirement. Either way, add seed 109 with the one action `{"type":"spell","cardId":"wizard-hellfire-1"}` as a fixed case, then rerun the saved 2,500 inputs once to count the duels that still disagree.

## Checks for the coordinator

No shell was available in this session, so I ran no commands. To run:

- The extraction command above.
- `shasum -a 256` on the `.mismatches.jsonl`, compared with the receipt's `mismatches.sha256`.
- A relative-link check on this note. It links only to `kiro-referee-first-divergence.md` in the same folder.
