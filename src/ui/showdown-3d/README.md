# Showdown in 3D

Build the offline preview with `npm ci` and `npm run build -- --diorama`. Open
`dist/cowboys-vs-wizards-showdown-3d.html`, select **Play**, and enter a Camp duel.
The seeded `?seed=0` and recorded `?turn=dragon-c5` URLs work here as they do in
the graybox.

The Cowboy and Wizard districts frame three troop spaces, two face-down trap
spaces, a Base, a deck and a graveyard per side, and one shared Location. The
native Showdown buttons handle all moves. The 3D scene reads the current
seat-safe board and points its effects at the slots named by Showdown events.
On narrow screens the same controls flow below the 3D scene. If WebGL is
unavailable, the normal board controls continue to work.

The terrain and geometry carry forward the Boot Hill split-board work in
`9ac122f`. Kiro CLI with Claude Opus 5.5 produced the original Western
storefronts and drafted the public event-to-position adapter, which was
revised against the engine. Our Castle's renderer and palette are carried
over byte for byte. Sheriff, Dragon, Skeleton and Jack-o'-Lantern have
miniatures. Other troops use faction tokens on their named slots.

The preview is opt-in at build time. The standard and hosted builds keep
the graybox presentation.
