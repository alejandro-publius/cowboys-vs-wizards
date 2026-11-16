# Orb Duel Workflow run

Kiro CLI 3.3.0 completed both steps of `orb-duel-replay` against the playable match at `64e3614` on November 15, 2026. Codex authored the saved Workflow and the replay script’s separate output option. Kiro ran the checks in two step sessions.

- `presenter-tests` ran `node --test tests/match/presenter.test.js`. Six passed.
- `chrome-replay` built the game and replayed seed 0 in Chrome. It observed eight of eight scripted steps with zero console errors.
- The HTML SHA-256 matched the original Orb Duel closeout build (`41971491f1df4727b498d527da91265e61dd96c207dd166f3c6d5c96e94b79e5`).

The first replay captured both screenshots before Chrome’s profile removal returned `ENOTEMPTY`. Codex added bounded retries to the cleanup. Kiro retried the replay and wrote the receipt and both screenshots to its temporary output directory.
