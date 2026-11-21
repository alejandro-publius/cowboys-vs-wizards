# Showdown in 3D

Build the offline preview with `npm ci` and `npm run build -- --diorama`. Open
`dist/cowboys-vs-wizards-showdown-3d.html`, select **Play**, and enter a Camp duel.
The seeded `?seed=0` and recorded `?turn=dragon-c5` URLs work here as they do in
the graybox.

The title and Camp use two camera views rendered from the same terrain,
landmarks and models as the duel. The embedded WebP stills in
`assets/scenes/` keep both screens playable offline and on browsers without
WebGL. Camp's native Trail buttons are positioned over the map. Its Play
button opens the same available duel, and Camp's rewards reuse the board's
illustrated card faces.

Boot Hill's storybook art comes from the approved ImageGen reference.
The embedded sunset-and-moonrise panorama frames the 3D table. Cropped
poses for the Sheriff, Billy and Skeleton are anchored to their board
tiles, and their strikes use the same contact events as the 3D models.
The opening hand, Gatling Crew and Dragon use matching card paintings.
The rest of the roster uses the existing miniatures in the attack reel.

The Cowboy and Wizard districts frame three troop spaces, two face-down trap
spaces, a Base, a deck and a graveyard per side, and one shared Location. The
native Showdown buttons handle all moves. The 3D scene reads the current
seat-safe board and points its effects at the slots named by Showdown events.
On narrow screens the same controls flow below the 3D scene. If WebGL is
unavailable, the normal board controls continue to work.

The terrain and geometry carry forward the Boot Hill split-board work in
`9ac122f`. Our Castle's renderer and palette are carried over byte for byte.
From the title or a match, open **Card gallery** to rotate each of Showdown's
29 card subjects. The gallery also opens directly at `?gallery=1` and shows
the matching subject, scene, and visual cue from
[Fable's art direction](../../../prototypes/showdown/ART-DIRECTION.md).

The miniatures power the gallery, hand portraits, occupied troop slots,
revealed traps, spells, gear, and the active Location. The hand atlas is a
six-column WebP of gallery renders in `TYPES` catalog order. Traps stay face
down on the game board until Showdown reveals them.

In **Card gallery**, select a troop to watch its attack, or select
**Watch all troops** to play the roster in order. Ride and Last Stand have
separate examples. Bone Wall demonstrates Guard. These use isolated
Showdown fixtures and the same playback as a match. The reduced-motion
setting shows the resolved board and event text.

Troops that cost one tribute have small faction-colored embers. Troops
that cost two tributes have a fuller, taller ring of pixel flames.

The board uses the Saloon and Rune Gateway for the Bases. Their porch
lanterns and runes follow the actual orb count. The rail siding, Boot Hill
plots, corral, telegraph, crypts and flagstones follow Fable's expanded
presentation brief. The board keeps clear paths around the troop pads.

Combat playback uses the public before and after snapshots of each real
action. Contact beats stage the orb change and let the defeated piece
finish its reaction. A newer input clears the old effects. The small-screen
and reduced-motion views use the resolved position. The event planner
handles shots, melee, Ride, breath and Sweep, cover and overflow, Last Stand,
traps, and spells without adding damage.

Kiro CLI with Claude Opus 5.5 built the original Western storefronts and
drafted the public event-to-position adapter, which was revised against the
engine. It also built the initial wizard and wraith miniatures and the
spell, trap, gear and Location models, which were checked and refined
against Fable's briefs.

The preview is opt-in at build time. The standard and hosted builds keep
the graybox presentation.
