# Judge Gameplay Autoplay GIFs

## Introduction

Kiroween 2026 rules note that judges may evaluate entries from text, images, and video without clicking into the live URL. Adding compact, deterministic autoplay GIFs captured directly from the staged `93db9f3` build lets judges verify the Night Shift Saloon's disputed Billy shot and turn-9 counterplay, the 3D Outrider Ride-or-Fight decision, and Camp / Deck Builder / Boot Hill Poker breadth at a glance inside `docs/JUDGE-GUIDE.md`.

## Requirements

- JGG-1: THE `docs/evidence/` directory SHALL track three palette-optimized autoplay GIFs (`showdown-saloon-billy.gif`, `showdown-outrider-3d.gif`, and `showdown-camp-deck-poker.gif`) captured directly from the staged `dist/web` build in headless Chrome with zero synthetic mockups.
- JGG-2: THE `docs/JUDGE-GUIDE.md` walkthrough SHALL embed all three autoplay GIFs with descriptive alt text alongside their live playable links.
- JGG-3: EVERY relative link and image reference in `docs/JUDGE-GUIDE.md` and `docs/evidence/antigravity-gameplay-gifs.md` SHALL pass `tests/assets/links.test.mjs`.
