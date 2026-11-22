---
inclusion: fileMatch
fileMatchPattern: ["src/render/**", "src/physics/**", "scripts/verify-scene.mjs", "scripts/build.mjs", "assets/**/*.glb"]
---

# Rendering area

- Use Three.js and Rapier only. Add no dependency.
- Preserve original Tripo GLBs. The fitted game Dragon and Mounted Billy GLBs contain earlier Kiro-authored attack clips; do not attribute those curves to Tripo. Do not add designs, poses or motion; new art needs the user's plan and a recorded source.
- Render the engine's before and after values; the renderer never decides outcomes.
- Profile a real bottleneck before optimizing.
- The standalone 3D lane build and its `src/render/` files are retired; old `?mode=` URLs land on Showdown. Its last source (including the `?mode=demo` attack exchange) is at commit `ea183ee29dbdcde00105cc4db3ba8bc39eb8f4df`. Do not edit or rebuild it unless the user reopens it.
- The illustrated Showdown (`src/ui/showdown-3d`) is separate from that lane build. With PR 186 it is the public game at `/`, and `/3d/` is a byte-identical compatibility copy of it.
- Rendered claims need a rendered check; geometry checks support only measured conditions.
