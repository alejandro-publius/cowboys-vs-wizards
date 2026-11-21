---
inclusion: fileMatch
fileMatchPattern: ["src/render/**", "src/physics/**", "scripts/verify-scene.mjs", "scripts/build.mjs", "assets/**/*.glb"]
---

# Rendering area

- Use Three.js and Rapier only. Add no dependency.
- Preserve original Tripo GLBs. The fitted game Dragon and Mounted Billy GLBs contain earlier Kiro-authored attack clips; do not attribute those curves to Tripo. Do not add designs, poses or motion; new art needs the user's plan and a recorded source.
- Render the engine's before and after values; the renderer never decides outcomes.
- Profile a real bottleneck before optimizing.
- The standalone 3D lane build and its `src/render/` files are retired; `/3d/` and `?mode=` URLs redirect to Showdown at `/`. The last 3D source (including the `?mode=demo` attack exchange) is at commit `ea183ee29dbdcde00105cc4db3ba8bc39eb8f4df`. Do not edit or rebuild it unless the user reopens it.
- Rendered claims need a rendered check; geometry checks support only measured conditions.
