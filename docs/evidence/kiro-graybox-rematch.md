# Same deal and new duel on the result screen

November 18, 2026, Pacific. Kiro IDE with Claude Opus 5.5 implemented the two actions in session `sess_13faa991-989d-44f1-a0a4-0df3e4a57d91`. The IDE showed 3.46 estimated credits. Codex reviewed and integrated the change in `6c8e087`.

In private browsing in Safari, start an ordinary seed-60 starter match. While it is paused, use Build Deck to save six Sheriffs and six Deadeyes. Resume and pass to the round-three defeat. **Replay this deal** restored seed 60, Skeleton in lane 1 and the original opening hand of Sheriff, Sheriff, Mounted Billy and Deadeye. After the second defeat, **New duel** generated seed `902164960` and dealt Sheriff, Deadeye, Sheriff and Sheriff. The engine confirmed that hand for the saved deck and placed Billy in the second slot for the starter deck. Both actions put focus on the first Sheriff.

In a separate Safari run with `?seed=14&cpu=hard`, **Start guided duel** and **Replay this deal** each opened seed 60 with the same lane lesson. **New duel** generated seed `3960674113` and returned to the ordinary duel.

`npm run build` succeeded. The controller, guide, player-profile and card-model suites passed 36 of 36 tests.
