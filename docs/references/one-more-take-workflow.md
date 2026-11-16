# One More Take — creator workflow reference
Checked November 16, 2026. Research only; no engine migration or asset generation authorized by this note.

## Verified links
- Creator site: https://onemoretakegame.com
- Game: https://aioriented.itch.io/one-more-take
- Making-of: https://chongdashu.github.io/one-more-take-devlog/
- Public devlog repo: https://github.com/chongdashu/one-more-take-devlog
- Gameplay video: https://www.youtube.com/watch?v=DanGaf17XmI
- Related workflow repo: https://github.com/chongdashu/unreal-5.9-skill
- Official editor bridge: https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor

## Findings
The public One More Take repo contains a devlog HTML page and media, not the C++ game project. No public full-game source repository was found. Root independently read its directory and index.html through GitHub; index blob at inspection was f957760b1a882f80a88b0d888a734327e1d4fac2.

The devlog describes Claude Code writing C++ and operating Unreal5.9 through built-in UnrealMCP; GPT Image on fal for reference sheets/menu/HUD art; Tripo for character meshes and rigs; scripted Blender work for sets, props and character animation; ElevenLabs for sound/music.

Critical distinction from the post: the devlog says the hero started from four reference views, Tripo supplied the rigged model, and Claude left Tripo stock animations unused while scripting nine moves in Blender. Do not infer that its final animation clips were Tripo exports. That character-animation approach conflicts with this user's no-authored-Blender-motion rule.

The related unreal-5.9-skill README was read directly. It was developed with Rooftop Rally, a different game, and is not One More Take source. Its notes/scripts are MIT; included artwork/screenshots have separate CC-BY-NC4.0 terms. It covers setup, import, clip blending, input probes, capture and packaging. No skill or engine was installed.

## Relevance to this project
Use the separation of asset production, in-game import, playtest and capture as a reference. Keep Three.js. Source character motion from user-approved Tripo exports or finished licensed clips; no new poses/Blender animation based on this article. Use actual game recordings and accurate tool attribution for the Kiro evidence trail.
