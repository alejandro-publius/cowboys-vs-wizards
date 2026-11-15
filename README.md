# Cowboys vs. Wizards board prototype

Open the bundled HTML in a WebGL 2 browser for a single Billy versus wizard exchange. If graphics acceleration is unavailable, the page shows the recorded exchange.

To build from this folder, run `npm install` then `npm run build`. The HTML in `dist/` embeds the models and replay. Run `npm run check` to verify tile placement, staff grip, aerial knockback and attack timing using Node. The check loads model geometry and physics with placeholder image decoding. Review the rendered scene in a browser to check textures and shaders.

`scene.js` assembles the board, applies the attack timeline and defines the camera. `rig.js` skins Billy and the wizard and positions the revolver and staff. `gravity.cjs` implements the earlier Singularity physics. The eight reduced GLBs in `assets/` were made from the project's Tripo exports. The staff and breakable chunks are generated in the scene.

Runtime dependencies are Three.js (MIT) and Rapier (Apache-2.0). The packed HTML includes their notices.
