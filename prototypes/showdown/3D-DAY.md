# 3D day: from a picture to a model on the board

A short runbook for making the first models. Generating a picture or a model is Alex's step to start: nothing here runs on its own. The rules may still change after the playtest, so start with the cards a new player meets first and stop when the day is up; any troop without a model still plays as a placeholder token.

## Before you start

- Pull request 141 must be merged. It adds `src/render/presentation-manifest.js`, the one file where a model is registered.
- Have the style block and the two reference cards ready: [ART-DIRECTION.md](ART-DIRECTION.md), section 1 and "How to use it".

## The order

Thirteen troops have no model. Make them in this order, which is the order a player meets them: Covered Wagon, Raven Familiar, Jack-o'-Lantern, Outrider, Bone Wall, Ranger, Imp, Dynamiter, Headless Horseman, Gatling Crew, Lantern Wraith, Captured Wraith, Captured Dragon. The first five cover the first three Trail duels. That is a good first day.

## For each model

1. **Picture.** In the image chat, paste the troop's block from ART-DIRECTION.md section 5. You want the whole figure, a plain grey background and flat light. Regenerate until the silhouette reads as a black shape.
2. **Model.** Give that picture to Tripo. Ask for one mesh with textures.
3. **Size.** The shipped models are 44,000 to 62,000 triangles and 2.5 to 4.8 MB each. Reduce a new one to **60,000 triangles or fewer and under 5 MB** before it goes in the repository. Tripo's raw output is far larger.
4. **File.** Save it as `assets/models/<name>.glb`, lower case with hyphens, for example `covered-wagon.glb`.
5. **Register it.** Add one entry to `CARD_MODELS` in `src/render/presentation-manifest.js`:

   ```js
   "cowboy-covered-wagon": {kind: "covered-wagon", asset: "covered-wagon", height: 1.4, footprint: 2.0, yaw: Math.PI},
   ```

   - `height`: metres. Billy is 1.93, the Skeleton 1.2, the Dragon 1.25, Mounted Billy 1.7.
   - `footprint`: the widest it may stand on its tile; about 1.2 for a person, about 2 for a mount or a wagon.
   - `yaw`: the turn that makes it face the other side. Cowboys face the Wizards; if it faces the wrong way, add or remove `Math.PI`.
6. **Check.**

   ```sh
   node scripts/audit-assets.mjs assets/models          # the file is valid; read its triangle count
   node --test tests/assets/presentation-manifest.test.mjs
   npm run build:art                                    # then open the 3D duel and look at it
   ```

7. **Look.** Stand it next to the Sheriff or the Skeleton on the board. Same level of detail, same colours, same scale? If not, fix the picture, not the model.

## What not to do yet

- **No rigging or animation.** A static model that lunges is enough until the rules are locked. Rigging is the expensive part and the first thing to be thrown away if a card changes.
- **No new places.** The board, saloon and gateway models already exist.
- **No models for spells, traps, gear or locations.** Those are effects and props, and their rules are the likeliest to change after the playtest.

## Record what you used

The hackathon rules ask for outside work to be disclosed. For each model, note the date, the tool, and that the picture came from a generator, in `docs/submission/` with the other disclosures.
