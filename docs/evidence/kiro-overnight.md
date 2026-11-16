# November 16 build evidence

The overnight work ran in isolated local worktrees and was assembled on `codex/playable-duel`. Paths below are relative to that checkout. The measurements use the Mac’s Chrome 157.0.8103.52 at 1440 × 900.

## Kiro implementation and execution

| Work | Evidence |
| --- | --- |
| Startup and loader | Kiro deferred exchange construction until it is requested and reused one GLB loading path. Codex tightened compatibility and context-loss handling, then measured timings. Integrated at `9f38087`. |
| Replay and hook | Kiro wrote `scripts/verify-duel.mjs`, refreshed the saved Workflow and redirected new hook results to `.artifacts/kiro/ui-hook.txt`. The hook ran 19 checks successfully. Integrated at `7d7d64a`. |
| Agent guidance | Kiro refreshed the README and added match-specific steering. Integrated at `f4ec268`. See the current README for the tested commands. |
| Mounted Billy | The user supplied the Tripo export. Codex optimized and inspected it. Kiro integrated the model with its existing summon, move, clash and defeat cues. Codex corrected a test assertion to check the mesh separately from its orbs. All eight focused board tests passed. Integrated at `0e33ccc`. |
| Artifact review | Kiro wrote the Power procedure and the read-only receipt tool. Codex connected it through workspace MCP. Kiro CLI loaded the Power and called the tool on a matching build and an older build. |
| Web packaging | Kiro added the optional static build. Codex verified its subdirectory URLs and the card-back and illustration checks in both delivery modes. Both Chrome runs observed all eight checks with zero console errors. |

## Browser verification

The Kiro CLI V3 Workflow `orb-duel-replay` finished both steps on `0e33ccc`. The `verify-duel` worker ran 104 Node tests, with 104 passing. Its Chrome replay for seed 0 observed all eight steps with zero console errors. The `report` worker wrote the aggregate result. The run used approvals for the requested verification commands and report write. Its environment, viewport and actions are recorded in the generated receipt.

- The eight seed 0 checks cover card art and the deck back, selection and cancellation, tile placement and its orbs, CPU play and clash, a result, mid-clash restart, and switching to the attack demo and back.
- The Sheriff’s flight was 0.32 CSS pixels from the projected lane center at the 350 ms cue in that run.
- Standalone HTML SHA-256 for that run was `662dea0870442ee5079b37c31b1d8ccacf158ee06533da0caf189c218f363453`.
- The build at `0e33ccc` also ran seed 60 through the real UI. Mounted Billy summoned with five orbs, Singularity moved him into the center lane, and he hit the Dragon before leaving the board. The Dragon went from five orbs to two. The direct exchange completed with Billy at 68 and the Wizard at 76. Both checks had zero console errors. See `.artifacts/kiro/showcase/arena/` for the screenshots and [the route](../morning-handoff.md).

## Power and MCP

Kiro CLI loaded the installed **Orb Duel Review** Power and called `@orb-duel-review/inspect_duel_replay`. Its first successful call returned `pass` on the matching standalone build, seed 0, eight observed steps and zero console errors. In a separate worktree, the same receipt accompanied the pre-optimization standalone HTML. The tool returned `stale` with `coversCurrentBuild: false` while the receipt still listed eight clean steps.

The bundled MCP server did not start in the CLI’s Power install context. The tested configuration keeps activation in the Power and gives the server its workspace-relative path in `.kiro/settings/mcp.json`. It reads the fixed receipt and HTML, computes SHA-256 and returns the result. Neither Kiro review session needed to build or run Chrome to detect the mismatch.

## Performance

Each row uses three cache-disabled navigations per variant, interleaved on the same Mac. The measurement ends on the first rendered frame after seed 0 accepts input.

| Test | Before | After |
| --- | --- | --- |
| Match boot before adding Mounted Billy | 1,109 ms median (1,050, 1,109, 1,213 ms) | 686 ms median (649, 686, 770 ms) |
| Delivery with Mounted Billy, local HTTP emulated at 30 Mbps and 40 ms RTT | 14.10 s median, standalone (14.04, 14.10, 14.41 s) | 9.68 s median, external assets (9.38, 9.68, 9.72 s) |

The first comparison retains the same art and measures the lazy scene and decoding changes together. The HTTP comparison serves the two builds from the same static server. The standalone HTML is about 49.9 MB. The web HTML is 2.8 MB and loads its models and images from content-hashed files. These are local browser measurements with the stated conditions.

The mounted export went from 68,739,708 to 3,286,616 bytes and from 1,981,198 to 61,966 triangles. Its three maps are 1024 × 1024. The board checks place its hooves on the tile, align it toward the Wizards and confirm its five life orbs sit above the mesh. The export is static. The next animation pass needs a skinned horse and rider for articulated motion.

## Release candidate replay

The scoped replay Workflow passed both steps on `ed234b0`. The standalone
build and the static web page each completed eight Chrome checks, with zero
console errors. The standalone run also passed 104 Node tests. In an explicit
WebGL-disabled check, both delivery paths loaded the full 6.16-second fallback
recording.

Kiro then activated the review Power and called the MCP once for each
delivery path. Both receipts matched the corresponding built page.

| Target | Seed | Steps | Console errors | SHA-256 |
| --- | --- | --- | --- | --- |
| Standalone | 0 | 8 | 0 | `2415ff06a88626946604bd73e856171e1d9314e7d464bc065b228bb805e80a8f` |
| Static web | 0 | 8 | 0 | `e77d68508f2dc8f570f9d4053774662b31ae1a9def04a45120183593016ead6a` |

The saved Workflow runs one exact verification command and writes one report.
The Mac’s Kiro workspace has an exact `fs_read` approval for the verification
worker’s current directory, added in the second run. The agent profile scopes
the verification command and report path.

## Opening experiment

Kiro wrote an isolated paired simulation with the current draft rules and CPU.
Codex ran it across 1,000 deals with each faction taking each first seat.
The candidate gave the second player one extra opening card. Card conservation,
unique ownership and action legality checks all passed across 4,000 complete
matches.

| Each variant used 2,000 matches | Current deal | One extra second-seat card |
| --- | --- | --- |
| Starting seat wins | 1,207 | 1,083 |
| Second seat wins | 616 | 716 |
| Draws | 177 | 201 |
| Mean rounds | 7.277 | 7.574 |

The gap between first- and second-seat win rates fell from 29.6 to 18.4
percentage points. This is a tuning candidate under the current bot. The
production rules still use four opening cards each. The local experiment and
full output are in `.artifacts/kiro/analysis/`. Compare that candidate with
Fable’s guaranteed-free-opener experiment during playtests.
