READY

# Mounted Billy decision pages

Claude Code (Fable 5.2), November 18, 2026, Pacific. Branch `claude/graybox-mounted-billy`, commit `2b95f7d`, local only (not pushed).

## Playable paths

Open either file in a browser. No server and no address ending are needed.

- Attack 3: `mounted-billy/dist/mounted-billy/attack-3.html`
- Attack 4: `mounted-billy/dist/mounted-billy/attack-4.html`

`dist/` is ignored by git. Rebuild with `node scripts/mounted-billy-lab.mjs --build`.

Both pages deal seed 823 with the starter deck, let the Normal bots play rounds 1 and 2, and hand over at round 3:

- Your lanes: Sheriff on 1 orb, Sheriff on 2 orbs, empty.
- Wizard lanes: Skeleton on 1 orb, Skeleton on 2 orbs, empty. Both Bases on 5.
- Hand: Sheriff, Billy, Mounted Billy, Deadeye.

The player can summon the third Sheriff and keep the wounded pair, or tribute both for Mounted Billy, then play the duel out against the Normal Wizard. **Replay this deal** on the result screen, or Restart in the ☰ menu at any time, returns to the same board. The page shows no predicted outcome. The tab title and one line under the heading name the attack value.

## Changed files

- `scripts/mounted-billy-lab.mjs`: `--build` now writes the two decision pages from patched copies of `src/` under `.artifacts/mounted-billy/attack-{3,4}/`.
- `scripts/mounted-billy-decision.js` (new): the shared opening, used by `--board` and by both pages.
- `docs/evidence/fable-mounted-billy.md`: the board section now points at these pages.

Nothing under `src/` was edited. The earlier lab pages `current.html` and the round-1 `attack-4.html` are replaced by these two.

## Verification

- **Same board, one difference.** The build asserts that both rule sets reach an identical round-3 state for seed 823. It also asserts the two HTML files are the same length and differ in exactly three characters, each `3` against `4` (title, lab line, the card's attack). Both asserts were broken on purpose once and stopped the build.
- **Headless Chrome, both final files, opened with no address ending, no page errors:**
  - Both opened on the board above at "Round 3 · Cowboy phase (you) · Seed 823". Mounted Billy's card read 3 attack on one page and 4 on the other.
  - Tribute route (Mounted Billy to lane 2, Deadeye on lane 1, then Sheriffs in lanes 1 and 3): attack 4 ended in "Victory. A Base fell in round 5." On attack 3 the blocking Wizard survived on 1 orb and Mounted Billy was defeated in the round 4 clash.
  - Restart from the ☰ menu (attack 3, mid-match) and Replay this deal (attack 4, after the win) each restored the identical board and hand.
  - Keep route (Sheriff to lane 3, Deadeye on lane 1, then End turn every round): played to a result on both pages, and Replay this deal restored the board again.
- `node scripts/mounted-billy-lab.mjs --board 823` prints the same four endings as before.
- The bot report on seeds 30000–30511 is byte-identical to the run before this change.
- `node scripts/check-links.mjs`: 0 broken. `npm test`: exit 0.

SHA-256 of the verified builds:

- `attack-3.html` `9317a48d288401bef6f72d3265219f0cfcd52906701662a12f6118942cf0beb2`
- `attack-4.html` `1b18dfad4b5413f475f8d8375244e26de0b846bf85585e3cfb932a140bc14d88`

## Remaining issues

- No person has played either page. The browser check used scripted clicks in Chrome only; Safari was not tried.
- **New duel** on the result screen deals a random seed and skips ahead to that seed's first Mounted Billy decision, or starts at round 1 if there is none. It works but was not checked in the browser. Use Replay this deal to stay on seed 823.
- The "Latest clash" panel is empty on arrival, because rounds 1 and 2 were played before the page took over. The lab line says the opening was played for the player.
- The browser check script is a throwaway in `.artifacts/mb-lab/decision-check.mjs` and is not committed.
- The branch now also carries the coordinator's rematch commits `6f05c97` and `b669a6f`, which these pages rely on for Replay this deal.
