---
inclusion: fileMatch
fileMatchPattern: ["src/render/**", "src/physics/**", "scripts/verify-scene.mjs", "scripts/build.mjs", "assets/**/*.glb"]
---

# Rendering area

- Use Three.js and Rapier only. Add no dependency.
- Preserve original Tripo GLBs. The fitted game Dragon and Mounted Billy GLBs contain earlier Kiro-authored attack clips; do not attribute those curves to Tripo. Do not add designs, poses or motion; new art needs the user's plan and a recorded source.
- Render the engine's before and after values; the renderer never decides outcomes.
- Profile a real bottleneck before optimizing. `?mode=demo` must still show the original attack exchange.
- Rendered claims need a rendered check; geometry checks support only measured conditions.
