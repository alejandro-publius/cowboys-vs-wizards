# Sheriff board model

The source is Alejandro's Tripo export `cowboy action figure 3d model.glb`,
the Sheriff with a red bandana and gold badge. Codex simplified the triangle
mesh with meshoptimizer and resized its base color, roughness/metallic, and
normal maps to 1024 × 1024. All three maps are embedded in the GLB.

| | Tripo export | Game asset |
|---|---:|---:|
| Bytes | 65,832,168 | 2,846,292 |
| Triangles | 1,874,860 | 43,996 |
| Vertices | 968,616 | 28,252 |

Asset: [sheriff.glb](../../assets/models/sheriff.glb).
The [render comparison](sheriff-comparison.webp) shows the original on the
left and the optimized copy on the right under the same camera and light.
The silhouettes overlap by 99.6% in that view. The texture resize softens
fine fabric grain.

`node scripts/audit-assets.mjs assets/models` reported nine valid files.
The project's Three.js version imported the mesh and material with
`GLTFLoader` in Node and decoded all three textures. The model is nearly
one unit tall with its feet at Y = 0.00027. It has no skin or clips. Board
placement and a browser visual check are pending integration.

Source SHA-256: `50eb521855ac40a9be6bee99076eb4c5068e83f483b2ce7f86fc8af4aa2da6e4`.
