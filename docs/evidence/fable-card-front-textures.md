# Card front textures for the six proposed faces

Work by Fable (Claude Fable 5.2, Claude Code), 2026-11-15, on branch
`fable/card-front-textures` from `4c65129`. Not Kiro or Codex work. This
commit holds the six WebPs below and this note. No code, stylesheet or build
file changed; runtime integration is a separate Kiro task.

## Provenance

The faces are Chrome renders of the owner-reviewed page, not new designs:
`outputs/card-illustration-review.html` (sha256 `e1cc9ada…6876bad4`), the six
`.face` elements marked "proposed card front". Frame, paintings, names, stars,
attack, orbs, footer and spell text are the page's own.

Capture: headless Google Chrome 157 over the DevTools protocol (the launch and
connection pattern of `scripts/browser-match-check.mjs`, no new dependency),
1280 px viewport, device scale 2.5. Each face is 288 CSS px wide in the page's
grid, so the element crop is 720 x 1008 pixels. Encoded with
`cwebp -q 87 -m 6 -sharp_yuv` (cwebp 1.6.0). The one-off scripts and review
images are in `/tmp/fable-card-fronts/` (`capture.mjs`, `compose.py`), not in
the repository.

Two things differ from a plain crop of the page:

1. **Attack 3 lifted** (owner's finish note). Georgia's 3 hangs below the
   baseline and ran into the frame's ATTACK caption on Dragon and Mounted
   Billy. In the capture only, that numeral has a shorter line and bottom
   padding, which raises it about 14 pixels to the middle of its unchanged
   purple panel. The 1 on Sheriff and Skeleton is as reviewed.
2. **Square corners.** The page rounds each face (4.1%), which would bake the
   page background into the corners. `billy-card.webp` and `wizard-card.webp`
   are full rectangles, so the four corner slivers (1,484 pixels per face) come
   from a second capture with the rounding off. Everything inside the rounded
   outline is the first capture.

## Files

All are 720 x 1008 (5:7), lossy WebP, no alpha, in `assets/cards/`.

| File | Bytes | KiB | Shows |
|---|---|---|---|
| `sheriff-card.webp` | 188,642 | 184.2 | 2 stars, attack 1, 3 orbs, Free Summon |
| `mounted-billy-card.webp` | 205,468 | 200.7 | 7 stars, attack 3, 5 orbs, 2 Tributes |
| `deadeye-card.webp` | 157,032 | 153.4 | Spell: Remove 1 enemy orb. |
| `skeleton-card.webp` | 189,682 | 185.2 | 1 star, attack 1, 3 orbs, Free Summon |
| `dragon-card.webp` | 176,890 | 172.7 | 8 stars, attack 3, 5 orbs, 2 Tributes |
| `singularity-card.webp` | 186,166 | 181.8 | Spell: Remove 1 enemy orb. May move the survivor. |

Mounted Billy is 0.7 KiB over the 200 KiB aim at the quality used for all six.

## Checks

- **Values against the rules.** The capture script read each face's name, star
  count, attack, orb count, footer and spell text from the page's DOM and
  compared them with `CARDS`, `tributeCost` and `SPELL_DAMAGE` in
  `src/game/cards.js`. All six agreed; the script exits non-zero otherwise.
  The name font resolved to Georgia.
- **Dimensions.** Each WebP was decoded and is 720 x 1008, RGB.
- **By eye.** A contact sheet built from the six encoded WebPs, and Dragon at
  full size, were compared with `cowboy-card-review.png` and
  `wizard-card-review.png`: same frame, paintings, names, stars, orbs, footers
  and spell text. The attack 3 now sits inside its panel, clear of the caption.
- **Corners.** For every face the texture differs from the first capture only
  inside the four corner boxes.
- **Originals.** `billy-card.webp`, `wizard-card.webp` and `card-back.png` are
  unmodified in git; sha256 before and after: `ec85df65…`, `5a29f509…`,
  `7f29fdd6…`.

## Not checked

- The faces in the running match, at hand size or on a Retina display.
- The game's test suite; no code changed.
- Lower WebP quality. Quality 87 was chosen by size and PSNR (about 42 dB),
  not by a side-by-side at several settings.
