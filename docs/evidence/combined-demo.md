# Combined playable demo

The build at `b6d0f5f` combines Fable’s Sheriff and Wizard motion with Kiro’s draw, summon, blue attack cue and graveyard changes.

Codex ran the final Chrome replay at seed 0 on November 15, 2026. All eight steps were observed with zero console errors. It covered card selection and cancellation, a board summon, CPU play and clash, a match result, restarting during clash and switching to the attack demo and back. The card flight landed 0.082 CSS pixels from the projected tile center at 1440 × 900.

The 51 match tests passed on the combined source before the last screen-coordinate guards. The final Chrome run exercised the assembled build after those guards. The Kiro custom agent’s SessionStart hook separately ran 19 focused tests, with its receipt in `kiro-ui-hook.txt`.

## Kiro use

Codex configured `.kiro/agents/duel-presenter.json` and `scripts/check-match-ui.sh`. Kiro CLI used the custom agent to implement and review the screen projection for the summon. The agent loaded the project’s instructions and build-evidence steering. Its SessionStart hook ran automatically before the review. Codex added the browser landing check and performed the final replay.

The first SessionEnd hook started but ended before its tests completed. The current profile uses SessionStart, whose complete 19-test result is recorded.

## Remaining visual work

Card fronts use the existing temporary text design. Mounted Billy, Skeleton and Dragon use temporary tokens. Fable’s Wizard evidence records the fused thumb and sleeve limitations and the export changes needed for a stronger close-up grip. The combined run verifies the flow and the summon destination. It is not a human assessment of the artwork or animation quality.

[Browser receipt](combined-demo/browser-run.json) · [Sheriff on the board](combined-demo/summon-sheriff.png) · [Match result](combined-demo/result.png) · [Kiro hook output](kiro-ui-hook.txt)
