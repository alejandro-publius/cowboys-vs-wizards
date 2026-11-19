READY

# Mounted Billy playtest boards: seeds 254 and 167

Claude Code (Fable 5.2), November 18, 2026, Pacific. Branch `claude/graybox-mounted-billy`, commit `a21728e`, local only (not pushed).

## Links

Start here. It links every board on both pages and names no outcome:

`mounted-billy/dist/mounted-billy/index.html`

Direct links, relative to `dist/mounted-billy/`:

| Board | Attack 3 | Attack 4 |
| --- | --- | --- |
| Seed 254: keeping beats committing at attack 4 | `attack-3.html?mode=match&deck=starter&seed=254` | `attack-4.html?mode=match&deck=starter&seed=254` |
| Seed 167: attack 4 flips the best choice | `attack-3.html?mode=match&deck=starter&seed=167` | `attack-4.html?mode=match&deck=starter&seed=167` |
| Seed 823 (earlier board, still the default) | `attack-3.html?mode=match&deck=starter&seed=823` | `attack-4.html?mode=match&deck=starter&seed=823` |

Each page opens on that seed's round-three tribute decision. **Replay this deal** on the result screen and Restart in the ☰ menu return to it. Each page also has an "Other boards" link back to the link page.

`dist/` is ignored by git. Rebuild with `node scripts/mounted-billy-lab.mjs --build`.

## The boards

Both have the same lanes as seed 823: Sheriffs on 1 and 2 orbs in lanes 1 and 2, Skeletons on 1 and 2 orbs across from them, both Bases on 5.

- **Seed 254.** Lane 3 empty on both sides. Hand: Mounted Billy, Billy, Sheriff, Billy. No Deadeye.
- **Seed 167.** A fresh Skeleton in the Wizard's lane 3. Hand: Billy, Sheriff, Mounted Billy, Billy.

Outcome notes are in `docs/evidence/fable-mounted-billy.md` under "Outcome notes", after a line asking the player to play first. In short, from the Normal bots' own lines:

- Seed 254: keeping wins in round 9 and every commit lane loses in round 5, at both attack values.
- Seed 167: keeping draws at both. Committing loses in round 4 at attack 3 and wins in round 6 or 7 at attack 4.

## How many boards qualify

`node scripts/mounted-billy-lab.mjs --scan --from 0 --count 2000`, seeds 0–1999, starter deck, Normal bots, each seed's first Mounted Billy decision:

| Group | Boards |
| --- | --- |
| Reached a decision | 1,466 |
| Keeping beats committing in every lane at attack 4 | 136 |
| Of those: only Sheriffs on the board, keeping wins and every commit lane loses, at both attack values | 23 |
| Best choice flips from keep at attack 3 to commit at attack 4 (includes seed 823) | 20 |
| Best choice flips from commit at attack 3 to keep at attack 4 (seed 17 only) | 1 |

Seed 254 is the lowest of the 23 with seed 823's lanes and a Sheriff in hand. Seed 167 is the lowest of the 20 with only Sheriffs on the Cowboy side.

## Changed files

- `scripts/mounted-billy-lab.mjs`: new `--scan`; `--build` checks all three boards and writes `index.html`; each page gets an "Other boards" link.
- `docs/evidence/fable-mounted-billy.md`: new section "Two follow-up boards: seeds 254 and 167" with the counts, the selection rules and the outcome notes.

Nothing under `src/` was edited.

## Checks

- **Identical start, by the engine.** `--build` asserts that for seeds 823, 254 and 167 the attack-3 and attack-4 rule sets reach deep-equal states (board, hand, decks, Bases). It refuses a seed with no decision; I confirmed that by building once with seed 13, which stopped with "seed 13: no Mounted Billy decision".
- **Only difference.** The two HTML files still differ in exactly three characters, each `3` against `4`.
- **Headless Chrome, final builds, via the link page (6 links):**
  - For each seed, both pages opened on the same status line, Bases, lanes and hand. Only Mounted Billy's printed attack differed.
  - I clicked the bots' commit line and keep line on every page, twelve lines in all. Each ended with the result and round the script prints.
  - Replay this deal after each line and Restart from the ☰ menu mid-match restored the same board and hand, on all six pages.
  - No page errors.
- `node scripts/check-links.mjs`: 0 broken. `npm test`: exit 0.

SHA-256 of the checked builds:

- `attack-3.html` `cfe65afdecf62b9c943198bb3a7fa73223eececbc87605e22c65cc5d0fb133b8`
- `attack-4.html` `bce50241c2b90077385c1de0ce2b30ba047b8ae2e0771f3a0b9f4f81e5a36fea`
- `index.html` `5df880181b92d85abb9f52ee12af71251161d8155aac26007910708d9bca66ae`

The hashes of the two pages changed from the last handoff because each page gained the "Other boards" link.

## Remaining issues

- No person has played these boards. The browser check used scripted clicks in Chrome only; Safari was not tried.
- The scan's "keep" means Mounted Billy is never summoned for the rest of the match, and every line is finished by the Normal bots. A player who keeps now and commits later, or plays the Hard Wizard, is outside these counts.
- On seed 167 the reason given for the flip (at attack 4 the Dragon race would empty both Bases, so the bot blocks) is my reading of the two traces. I did not test it separately.
- Seed 17, the single flip from commit to keep, is described in the note but is not on the link page. `?mode=match&deck=starter&seed=17` opens it; I did not click through it.
- The browser check script is a throwaway at `.artifacts/mb-lab/playtest-check.mjs` and is not committed.
