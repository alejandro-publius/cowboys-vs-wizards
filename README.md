# Cowboys vs. Wizards

A haunted Western browser card game in progress. The runnable build is a Billy
versus wizard attack demo on six tiles. Decks, tribute summons, a CPU opponent
and one-to-five troop health orbs are the next gameplay milestones.

## Run

Use Node 22 or newer. Install once with `npm ci`.

- `npm run build` creates `dist/cowboys-vs-wizards-board-duel.html`. Open it in
  a WebGL 2 browser. Models and the fallback recording are embedded.
- `npm run check` checks geometry, event order, grip socket and aerial knockback
  with placeholder image decoding. It does not judge appearance or frame rate.

## Code map

| Path | Responsibility |
| --- | --- |
| `src/main.js` | Browser controls, sound and frame loop |
| `src/render/scene.js` | Board, camera, effects and attack timeline |
| `src/render/rig.js` | Procedural deformation and prop attachment |
| `src/physics/gravity.cjs` | Singularity physics |
| `src/ui/layout.html` | Demo layout and styles |
| `scripts/` | Build and scene verification |
| `assets/models/` | Eight optimized Tripo GLBs |
| `assets/media/` | Poster and replay |
| `.kiro/` | Kiro requirements and steering |
| `docs/fable-tasks.md` | Active assignments and ownership |

Read AGENTS.md before editing. Game rules will live in `src/game/`, independent
of Three.js. Each parallel worker gets its own git worktree and owned paths.

## Assets and attribution

GLBs are static exports; the procedural rig supplies demo motion. Skeletal clips
are still missing. The older inventory in `docs/evidence/` refers to the former
`assets/*.glb` paths; those files now live in `assets/models/` with identical bytes.

Lucca Cerf's pinned MIT-licensed documents are in
`docs/references/lucca-character-factory/`. Their private execution tools are
not included. Read `docs/character-animation-plan.md` for adaptation and load
only the needed reference section for an animation task.

The build embeds Three.js (MIT) and Rapier (Apache-2.0) notices. Attribute Codex,
Fable, Kiro, Tripo and user contributions separately; work outside Kiro must not
be represented as Kiro work.
