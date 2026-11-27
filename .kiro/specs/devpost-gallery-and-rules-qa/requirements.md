# Requirements: Devpost Gallery Stills & Official Kiroween Form Q&A

## Normative requirements

- DGR-1: THE `scripts/capture-devpost-gallery.mjs` tool SHALL capture five `1200x800` (`3:2`) PNG screenshots from the staged Pages build (`dist/web/`) covering the illustrated title screen, Night Shift Saloon review table, 3D Bone Fence Outrider challenge, Even Fight Showdown board, and Boot Hill Poker table with zero console or page errors.
- DGR-2: THE gallery verifier (`verifyGalleryManifest`) SHALL validate every PNG in `docs/evidence/devpost-gallery/` for valid PNG magic bytes, `IHDR` dimensions of `1200` by `800` pixels, byte size above `20` KB, and exact SHA-256 parity with `docs/evidence/devpost-gallery/manifest.json`.
- DGR-3: THE submission form guide (`docs/submission/devpost-form-qa-and-gallery.md`) SHALL answer all eight official Kiroween Kiro-usage topics including the sub-questions flagged in `docs/submission/rules-check.md` (how Kiro apps differed, which app ran custom agents, what MCP enabled, honest PBT fault/issue record, and explicit statement on third-party registry Powers).
- DGR-4: WHERE a Kiroween write-up question requires personal builder judgment (vibe-coding comparison, most impactful steering strategy, or Social Blitz post), THE form guide SHALL mark an explicit `[OWNER]` personal-words placeholder and SHALL NOT fabricate first-person human reflections.
- DGR-5: THE form guide SHALL include a dedicated pre-existing work and third-party asset disclosure template naming pinned open-source dependencies, reference materials, and owner date-confirmation blanks required by the official rules.
- DGR-6: THE form guide SHALL audit the current `1:20` demo transcript (`docs/submission/judge-demo-narration.md`) against third-party AI/browser trademark names and link all five verified `1200x800` gallery images with copy-paste captions.
