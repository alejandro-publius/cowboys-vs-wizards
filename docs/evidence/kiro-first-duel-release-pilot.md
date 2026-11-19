# First-duel release pilot

Fable defined the first-player protocol and identified the playtest kit as the immediate release handoff. Kiro CLI adapted the portable launcher and build to that pilot. Codex added an optional field for last-clash answers and observed stalls, then verified the game links and the notes export in Chrome.

Use the build from `05fd01f` on `kiro/first-duel-candidate`, then run the following from the branch containing this launcher.

```sh
node prototypes/playtest-lab/build.mjs /absolute/path/to/first-duel-candidate/dist/cowboys-vs-wizards-board-duel.html
```

Open `dist/playtest-lab/index.html` and follow the moderator instructions. Both links deal seed 690, with Sheriff, Sheriff, Deadeye and Billy as the starting hand. The guided route shows the goal. The standard link opens the same hand without the goal hint. Chrome verified that a timed observation and an entered note survived a download and re-import into the report.

Three first-time players can identify where new players stall. The A/B decision requires three different first-time players per arm under Fable's protocol. No sessions with first-time players have been recorded here.
