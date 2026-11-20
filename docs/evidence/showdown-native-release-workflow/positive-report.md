# Showdown release review: c529330dc724108d72035f9bc46ba726a0612d8a

## Commands run
1. `git rev-parse HEAD` → exit 0, `c529330dc724108d72035f9bc46ba726a0612d8a`
2. `git symbolic-ref -q HEAD` → exit 1 (detached, as required)
3. `git status --porcelain --untracked-files=all` → exit 0, empty output
4. `node scripts/showdown-release-review.mjs --expected c529330dc724108d72035f9bc46ba726a0612d8a` → exit 0, verdict pass
5. `node scripts/showdown-release-review.mjs --check-receipt .artifacts/kiro/showdown-release-review/c529330dc724108d72035f9bc46ba726a0612d8a/receipt.json --expected c529330dc724108d72035f9bc46ba726a0612d8a` → exit 0

## Source provenance
- Expected SHA: c529330dc724108d72035f9bc46ba726a0612d8a
- HEAD before: c529330dc724108d72035f9bc46ba726a0612d8a
- HEAD after: c529330dc724108d72035f9bc46ba726a0612d8a
- Detached: yes (before and after)
- Clean: yes (before and after)
- Node version: v26.0.0
- Standalone HTML (`dist/cowboys-vs-wizards-board-duel.html`) SHA-256: 6e849fe1fca29b635b3ce8b5d8fc5e3eca624e81ff2dc81c6fe2601d7c3e9a77
- Standalone HTML bytes: 107727

## Checks
| Check | Seed | Result | Exit | Seconds | Page errors | Last output line | Expected (exit 0, 0 problems/errors) |
|---|---|---|---|---|---|---|---|
| Node suites (21 files) | n/a | 167/167 pass, 0 fail | 0 | 11 | n/a | node tests: exit 0, 167/167 passed | match |
| Turn dragon-c5 | 3 | 5 branches, 0 problems | n/a | n/a | n/a | turn dragon-c5 (seed 3): 5 branches, ok | match |
| Build | n/a | html written | 0 | n/a | n/a | build: exit 0, 6e849fe1…e9a77 | match |
| Browser entry | n/a | 22 checks | 0 | 13.9 | 0 | 22 checks passed; report in .artifacts/…/entry/browser-showdown.json | match |
| Browser camp-trail | n/a | 16 checks | 0 | 9.8 | 0 | 16 checks passed; report in .artifacts/…/camp-trail/browser-showdown-trail.json | match |
| Browser modes-hidden-saves | n/a | 13 checks | 0 | 23.9 | 0 | 13 checks passed; report in .artifacts/…/modes-hidden-saves/browser-showdown-modes.json | match |
| Browser turn | n/a | 18 checks | 0 | 3.9 | 0 | 18 checks passed; report .artifacts/…/turn/report.json | match |
| Browser keyboard | n/a | 7 checks | 0 | 54.5 | 0 | 7 checks passed; report in .artifacts/…/keyboard/browser-showdown-keyboard.json | match |
| Browser ledger | n/a | 12 checks | 0 | 2.1 | 0 | 12 checks passed; report in .artifacts/…/ledger/browser-ledger.json | match |

(`…` abbreviates `kiro/showdown-release-review/c529330dc724108d72035f9bc46ba726a0612d8a`.)

Turn dragon-c5 branches (start at action 5): attack slot 0 target 0 → wizard wins turn 10; attack slot 0 target 1 → wizard turn 10; cover slot 0 → wizard turn 8; cover slot 1 → wizard turn 25; end → wizard turn 8.

Receipt `failures`: empty. Receipt `verdict`: pass.

## Receipt check
Exit 0. Output: `ACCEPTED: receipt covers c529330dc724108d72035f9bc46ba726a0612d8a, HTML 6e849fe1fca29b635b3ce8b5d8fc5e3eca624e81ff2dc81c6fe2601d7c3e9a77`

## Pending or blocked
- Receipt field `pageSha256Matches` is null for all six browser checks, so the receipt does not show that the page each browser check loaded matched the built HTML hash.
- Human approval: pending.
- Art/device approval: pending.

## Limits
- These are scripted headless Chrome and Node checks on one Mac.
- They support flow, storage and hidden-information claims only.
- Art and appearance need the art owner's rendered review.
- Clarity and fun need a human playtest.
- Phones, tablets, Safari and other GPUs are not covered.
- Deployed (Pages) identity is not checked.

pass
