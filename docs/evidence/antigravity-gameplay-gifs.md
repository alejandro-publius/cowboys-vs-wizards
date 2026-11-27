# Evidence: Staged Gameplay Autoplay GIFs (`JGG-1`–`JGG-3`)

- **Date:** 2026-11-26 (America/Los_Angeles)
- **Original source revision (Outrider and Camp loops):** `93db9f3e2f3970ec8b391650199027eac1d252db` (`dist/web/index.html` SHA-256 `426092c5b9ea30c70afc78935db424b36f4487fcf2b44673323185eae6cc1f41`)
- **Authoring agent:** Antigravity (branch `antigravity/showdown-readme-gifs`; open for review, not merged to `main`)
- **Spec requirements:** [`.kiro/specs/judge-gameplay-gifs/requirements.md`](../../.kiro/specs/judge-gameplay-gifs/requirements.md) (`JGG-1`–`JGG-3`)

## Captured Loops

The Outrider and Camp frames were captured over the Chrome DevTools Protocol (`Page.captureScreenshot` at `1120×630`, `deviceScaleFactor: 1.5`) from `dist/web` served under `/cowboys-vs-wizards/`, then encoded to `800px`-wide looping GIFs with `ffmpeg` (`lanczos` scaling + `palettegen` / `paletteuse`):

The Saloon loop was recaptured by Codex from `ec9b67bbd657dda604c576d43fc12fd771d00fd1` (staged HTML SHA-256 `0f327faf3b644fb1e0c9902e3c60482c1f8de87dfbe602b8b6df25151d714977`). Five frames show the printed shot, Kiro’s shot, the turn-nine opponent and both player decisions. The browser ran at 1200×960. Each frame uses the same dialog crop.

1. [`showdown-saloon-billy.gif`](showdown-saloon-billy.gif) — Opens `/?saloon=review`, fires Billy's printed `2`-attack shot (`Bone Wall` falls, Cowboys win turn `13`), fires Kiro's proposed `1`-attack shot (`Bone Wall` survives on `1` orb, Wizards win turn `20`), tests `Attack Headless Horseman` on turn `9` (Wizards win turn `18`), then chooses `Take cover` (Cowboys win turn `21`).
2. [`showdown-outrider-3d.gif`](showdown-outrider-3d.gif) — Opens `/?outrider=case-e`, fights the `Skeleton` (`Outrider` drops to `1` orb), restarts the same turn, and rides past the `Skeleton` to strike the `Wizard Base` for `1`.
3. [`showdown-camp-deck-poker.gif`](showdown-camp-deck-poker.gif) — Opens `/` title, enters 3D `Camp`, opens the `16`-card Cowboy `Deck Builder`, previews `Wanted` boss bounties, and opens `/poker/` (`Boot Hill Poker`).
