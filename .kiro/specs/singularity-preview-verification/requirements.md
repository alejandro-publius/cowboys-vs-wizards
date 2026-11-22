# Singularity replay verification

The approved Showdown replay is revision `172890d0cd812b6665804e0b92313f7c698c33fe`. This spec is for its verification tooling. The replay was already implemented and visually approved.

- **SV1.** When an area cast reaches contact, each occupied enemy slot loses exactly one orb in the same snapshot. Friendly troops and both Bases retain their health. An empty slot receives no hit.
- **SV2.** When the cast takes a troop's last orb, the troop remains at zero in the contact frame so the renderer can show its defeat. Its card then reaches the correct graveyard exactly once. A surviving target stays on the board.
- **SV3.** When a player selects either Singularity replay in the actual illustrated gallery, the results match SV1 and SV2. The Sheriff replay finishes at two orbs each. The other replay leaves the Dragon at four orbs and the Skeleton in the opposing graveyard. Reduced motion resolves to the same board outcomes.
- **SV4.** An ordinary Singularity action still resolves one target under the current Showdown rules. This verification work preserves the approved application, rendering and assets.
- **SV5.** A release check names the checkout and the built HTML hash. Separate workers record the rules and browser results. A reviewer reads those results in a fresh session and reports failures or missing evidence.
