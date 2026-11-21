# Showdown cue strip: ten cues, two motion settings, 0/100/700 ms

Date: 2026-11-20, run at 16:26 PST (America/Los_Angeles). Worker: Kiro CLI (claude-opus-5.5), branch
`kiro/showdown-ten-cues` from `c3dcab64`. Fable asked for this sheet. Only scripts ran. No human has
reviewed it yet; Alex's initials on the sheet are pending.

## What was added

`scripts/browser-showdown-cue-strip.mjs` is the only code change, and it is test-only. Nothing in
`src/` changed: no styling, combat, rule, wording or card value. It reuses the Chrome launch,
DevTools driving, click helper and harness page pattern of `scripts/browser-showdown-cues-check.mjs`:
the graybox template and styles, the real `mountShowdown` screen, and decks with every card type. The
existing check is unchanged and still covers cue painting in real play.

## Which evidence is which

- **(A) Fixtures. These are synthetic and deterministic.** The harness board is reached by clicks on
  seed 1: two Cowboy turns with the existing click policy. That leaves Cowboy slots 0 and 1 and
  Wizard slots 0 and 1 filled, Boneyard as the location, and the Cowboys to act. Then the run sends
  one hand-written `EVENTS` entry per cue kind through the real `cuesFor` and the screen's own cue
  player. A test-only esbuild wrapper hands the run the screen's session and cue player.
  - The event names troops that are really on that board.
  - The player runs on a manual clock passed in through `cueOptions.timers`.
  - The CSS flash is paused and seeked to t with the Web Animations API.
  - Each sample is therefore the state exactly t ms after the marks went on.
  - Under normal motion the real 700 ms step timer fires on that clock, so the 700 ms frame shows
    the expiry as implemented.
  - Reduced motion comes from the emulated media feature and the player's own `matchMedia` check.

  The fixture events are not legal plays. Covered Wagon "sweeps" and "is raised", and the board does
  not change. Only the cue's targets, outline and timing are under test. The lit log line on fixture
  frames is added by the run and tagged `data-fixture`.
- **(B) Negative control.** The same harness is rebuilt with one extra rule,
  `#showdown .sd-cue { outline: none !important; }`. The same seed and the same clicks reproduce the
  same board, and the run asserts that.
- **(C) Normal entry smoke. No fixture and no manual clock.** The built page goes Play → Camp →
  Boot Hill (`?seed=1`) by clicks, with the real 700 ms timers. Cowboy turn 2 takes cover with the
  Sheriff on slot `cowboy-0`, and the cue is captured as it paints and again after it expires.

## Pixel rule

The run checks screenshot pixels, not class names. It decodes the PNGs with Node's zlib and has no
new dependency.

- **Where it samples:** the outline's middle pixel line, 3.5 px outside each edge of the target box.
- **What counts as a hit:** a pixel that matches the cue colour (white → `#f2d27a`) composited over
  the control frame's pixel at the element's computed opacity. Disabled buttons are drawn at 0.6
  (`graybox.css`).
- **Outlined target:** all four edges are at least 90% hits, or three are and the fourth differs
  from the control on at least 90% of its pixels but is dimmed.
- **Not outlined:** every edge is at most 25% hits.
- **Every other board place:** at most 25% hits outside a 7 px zone around the targets. Places inside
  a marked row are not judged.

## Results (actual run, 2026-11-20 16:26 PST)

Chrome 158.0.8127.37 headless, Node v26.0.0, 1440 px wide at device scale 1, graybox build
`c3dcab64da37`.

| cue | fixture event (side, troop) | targets marked and outlined |
|---|---|---|
| cover | Cowboy Covered Wagon | slot cowboy-0 |
| trap (cancelled) | Wizard Hex on Covered Wagon | wizard Base + slot cowboy-1 |
| gear | Six-Shooter on Covered Wagon | slot cowboy-1 |
| location | Sheriff's Office | location line (bottom edge dimmed, see findings) |
| raise | Covered Wagon onto slot 0 | slot cowboy-0 |
| sweep (count 1) | Covered Wagon | slot cowboy-0 + **whole wizard row** |
| laststand (wounded) | Wizard on Covered Wagon | slot wizard-0 + slot cowboy-1 |
| set | Cowboys | cowboy Base |
| burn | Cowboys, Sheriff | cowboy Base |
| fatigue | Wizards | wizard Base |

- **(A)** All 60 frames pass both the functional state check and the pixel check.
  - Before each cue, the control frame has no outline.
  - Normal motion is outlined and flashing at 0 and 100 ms, and cleared at 700 ms: no label, mark
    or lit line, and no outline pixels.
  - Reduced motion is outlined with `sd-cue-still` and `animation: none` at 0, 100 and 700 ms.
  - No Wizard card id is in the page.
- **(B)** All 50 frames that should be outlined still have the right class, `data-cue`, banner label
  and lit log line. All 50 fail the pixel check. The 10 normal-motion 700 ms frames pass as expired,
  as they should.
- **(C)** The smoke frame was captured 15 ms after the label painted (wall clock, not seeked). Its
  slot outline passes, and the log line reads "The Cowboys' Sheriff took cover." The cue cleared
  709 ms after it painted, and every pixel on the ring changed between the shown and expired frames.

## Findings

- **Sweep:** the cue marks the attacker and the whole enemy row. The event counts the troops hit
  but does not say which, so no single enemy slot is marked. This is not a slot-by-slot cue for each
  troop hit.
- **Location:** the bottom edge of the outline is drawn under the board's first row. That row's
  disabled buttons are at 0.6 opacity and paint over the edge. The pixels on that edge change, but
  only about 3% are in the cue colour. The top, left and right edges are full. No style was changed;
  whether this is good enough is for Fable and Alex to decide.
- **Disabled targets:** the Base cues and the enemy slot cues are disabled buttons at 0.6 opacity,
  so their outlines show at that opacity.

## Reproduce

From a clean checkout of this branch, with Chrome at `/Applications/Google Chrome.app`:

```sh
npm ci
node scripts/build-graybox.mjs
node scripts/browser-showdown-cue-strip.mjs dist/cowboys-vs-wizards-board-duel.html ../cue-media
```

The run exits 0 when A, B and C all hold. It writes the following outside Git, in `../cue-media/`:

- `raw/` with 284 PNGs: full frames and crops at actual board scale.
- `report.json` with every edge share.
- `cue-proof-sheet.pdf`: 11 pages, an overview and then one page per cue with initial lines.
- `cue-proof-overview.png`.
- The two harness pages.

## Remaining

- Alex's review and initials on each cue page are pending.
- Human clarity and fun have not been tested.
- The location bottom edge needs a decision from Fable and Alex.
