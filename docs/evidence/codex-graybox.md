# Working graybox

On November 17, 2026 Pacific, Alejandro chose to strip the board back and add animation after the game was easier to work on. Codex built a separate browser entry that uses the existing engine, presenter, controller, deck builder and input overlay. The graybox renders three lanes per side, plain cards and life orbs. Combat cues have zero duration and the clash log gives the actual orb changes. The illustration and attack-demo source still build with `npm run build:art`.

## Acceptance

- The guided seed-0 match opened in desktop Safari. The Sheriff reached the center lane with three orbs, the hand dropped to three cards, and ending turn returned control in round 2.
- The corrected graybox exposed the twelve-card deck workbench and entered seed 60 through the replay control. In a real browser replay, Deadeye hit the Skeleton, the two tribute troops left, and Mounted Billy entered lane 3 at five orbs. Singularity moved him to lane 2. In round 5, he hit the Dragon for three and was defeated. Round 6 displayed the Dragon at two of five and the Cowboy center lane empty.
- The first visual check exposed duplicate base orb rows after successive renders. The fixed replay showed one five-orb row per base and a complete six-lane board.
- The graybox's two outputs are byte-identical and load no external assets. This check covers the local build. The branch has no Pages deployment.

## Animation handoff

Keep the seed-60 input sequence and the accepted event assertions as the comparison. Reintroduce card arrival, hit feedback and removal as presentation cues. Add sourced character clips after those cues read clearly at the game camera. The rules and public view remain the reference for which troop can act, its life orbs, and when its defeat is processed.

[Build commands](../../README.md#play-showdown) · [Seed 60 inputs](../morning-handoff.md#the-duel-to-film) · [Motion plan and provenance](../character-animation-plan.md)
