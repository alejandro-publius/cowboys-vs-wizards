# Evidence: Staged Gameplay Autoplay GIFs (`JGG-1`–`JGG-3`)

- **Date:** 2026-11-26 (America/Los_Angeles)
- **Source revision:** `93db9f3e2f3970ec8b391650199027eac1d252db` (`dist/web/index.html` SHA-256 `426092c5b9ea30c70afc78935db424b36f4487fcf2b44673323185eae6cc1f41`)
- **Authoring agent:** Antigravity (branch `antigravity/showdown-readme-gifs`; open for review, not merged to `main`)
- **Spec requirements:** [`.kiro/specs/judge-gameplay-gifs/requirements.md`](../../.kiro/specs/judge-gameplay-gifs/requirements.md) (`JGG-1`–`JGG-3`)

## Captured Loops

All frames were captured over the Chrome DevTools Protocol (`Page.captureScreenshot` at `1120×630`, `deviceScaleFactor: 1.5`) from `dist/web` served under `/cowboys-vs-wizards/`, then encoded to `800px`-wide looping GIFs with `ffmpeg` (`lanczos` scaling + `palettegen` / `paletteuse`):

1. [`showdown-saloon-billy.gif`](showdown-saloon-billy.gif) — Opens `/?saloon=review`, fires Billy's printed `2`-attack shot (`Bone Wall` falls, Cowboys win turn `13`), fires Kiro's proposed `1`-attack shot (`Bone Wall` survives on `1` orb, Wizards win turn `20`), tests `Attack Headless Horseman` on turn `9` (Wizards win turn `18`), then chooses `Take cover` (Cowboys win turn `21`).
2. [`showdown-outrider-3d.gif`](showdown-outrider-3d.gif) — Opens `/?outrider=case-e`, fights the `Skeleton` (`Outrider` drops to `1` orb), restarts the same turn, and rides past the `Skeleton` to strike the `Wizard Base` for `1`.
3. [`showdown-camp-deck-poker.gif`](showdown-camp-deck-poker.gif) — Opens `/` title, enters 3D `Camp`, opens the `16`-card Cowboy `Deck Builder`, previews `Wanted` boss bounties, and opens `/poker/` (`Boot Hill Poker`).
