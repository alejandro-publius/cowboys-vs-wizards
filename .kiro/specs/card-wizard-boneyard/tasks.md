# CARD-WIZARD-BONEYARD tasks

Test tasks only. No engine, catalog or UI change is planned. Rules tests go in `prototypes/showdown/rules.test.js`. None of these has been run for this spec; results are pending.

Already covered by existing tests (to re-run, not rewrite):
- 06, 07, 09, 10, 11: "locations: one for the whole table, ..." (Boneyard replaces the Office, Skeleton 2, Bone Wall 1 and its attack action, Lawman and Outlaw unchanged).
- 04 for locations in general (Sheriff's Office refused while in play): same test.

## Tasks

- [ ] 1. Same name refused (04). Location `{cardId: "wizard-boneyard-1", side: "wizard"}`, Wizard hand `["wizard-boneyard-2"]`. Assert no `location` action. Run `node --test prototypes/showdown/rules.test.js`.
- [ ] 2. Shared play (05). Hand `["wizard-boneyard-1", "wizard-singularity-1"]`, a Cowboy troop on the board. After the Boneyard: no `spell` action.
- [ ] 3. Replaced by the Office (08). Boneyard in play; Cowboys play `cowboy-sheriffs-office-1`. Assert the Wizard discard ends with `wizard-boneyard-1` and a Skeleton's attack is 1 again.
- [ ] 4. Both sides (09). Boneyard in play, a Cowboy Captured Wraith on the board. Assert its `attackOf` is 3.
- [ ] 5. Hit-back and overflow (12). Boneyard in play. A Cowboy Sheriff attacks a full Skeleton: the Sheriff ends on 1 (hit back for 2). A Skeleton attacks a 1-orb Sheriff out of cover: Cowboy Base 5 → 4.
- [ ] 6. Ride-past fixed (13). Boneyard in play, Horseman rides past a Sheriff: Cowboy Base 5 → 4.
- [ ] 7. Log and view (14, 15). `presentEvent` on the `location` event returns "The Wizards' Boneyard is now the location." `viewFor(state, "cowboy").location` equals `{cardId: "wizard-boneyard-1", side: "wizard"}`.
- [ ] 8. Catalog and decks (01, 02). Assert `TYPES["wizard-boneyard"]`, `EFFECTS.boneyard.tag === "Undead"`, and the counts. Run `node --test tests/game/card-specs.test.js prototypes/showdown/progress.test.js`.
