# Showdown gameplay trailer

The 55-second silent cut contains 46 seconds of footage from the staged game and nine seconds of illustrated titles. The master is a 1280 × 720, 60 fps H.264 MP4 with 3,300 frames. The six title cards use the game’s paintings and its [Barlow Condensed Black typeface](../../assets/fonts/barlow-condensed/OFL.txt).

| Time in master | Scene ID | On screen | Preceding title (1.5 s) |
| --- | --- | --- | --- |
| 0:00–0:03.5 | `opening` | Billy draws as the Play button comes into focus. | — |
| 0:05–0:14 | `outrider` | Fight the Skeleton, then ride past it to hit the Wizard Base. | Ride or Fight |
| 0:15.5–0:21.5 | `book` | Open Billy’s page, play his card and hit the Wizard for two orbs. | Play Your Hand |
| 0:21.5–0:28 | `forge` | Cast Hellfire twice. The Sheriff loses an orb and the allied Skeleton keeps all three. | — |
| 0:29.5–0:36.5 | `poker` | Draw on seed 17. A pair of eights beats a pair of sevens. | Boot Hill Poker |
| 0:38–0:43.5 | `journal` | Step through Kiro’s recorded shift to see the Wizard propose lowering Billy’s attack. | Kiro’s Night Shift |
| 0:45–0:49 | `refusal` | Replay the Sheriff blocking an action outside the assigned task. | Sheriff Says No |
| 0:50.5–0:55 | `audit` | Open the balance test results for Billy’s proposed attack change from 2 to 1. | 100,000 Duels Audited |

The Sheriff appears at step 2 of the recorded shift. At step 3, the Wizard proposes lowering Billy’s attack. Across 100,000 simulated duels, the Cowboys’ win rate went from 59.792% to 51.920%. The proposal passed the written balance rule and awaits design approval. Billy still has 2 attack in the filmed build. [Shift recording](../../src/ui/night-shift-recording.json) · [Billy’s seat audit](../evidence/billy-seat-audit/README.md)

## Recreate the cut

From the repository root, stage the clean game revision you want to film and serve it over HTTP. The staging command records that revision in `dist/web/build.json`.

```sh
npm ci
node scripts/stage-pages.mjs --commit "$(git rev-parse HEAD)"
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist/web
```

In a second terminal at the repository root, make a fresh set of clips and assemble the master. The authoring machine needs Chromium, Playwright or playwright-core, FFmpeg with libx264, ffprobe and Python 3 with Pillow including WebP and WOFF2 support. If Playwright lives outside the repository, set `PLAYWRIGHT_MODULE` to its absolute package path. Set `CHROME_PATH` to use an existing Chromium or Chrome executable.

```sh
node scripts/trailer/capture.mjs --site http://127.0.0.1:8000/ --out .artifacts/showdown-trailer/clips
node scripts/trailer/compose.mjs --clips .artifacts/showdown-trailer/clips --out .artifacts/showdown-trailer/showdown-55.mp4
```

To retake one shot, add `--scene` and its scene ID to the capture command and run the compose command again. The editor checks each clip’s dimensions, decoded frame count and 60 fps timestamps before cutting to the [frame-by-frame timeline](../../scripts/trailer/timeline.mjs).
