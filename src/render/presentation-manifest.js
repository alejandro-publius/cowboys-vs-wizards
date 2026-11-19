// How each troop card appears in the illustrated 3D build.
//
// To give a card a model: put <name>.glb in assets/models/ and add one entry to
// CARD_MODELS. The build bundles it and the board places it. Rules and UI code
// do not change. A troop with no entry here stands on the board as a
// placeholder token, so every card is playable in 3D before its model exists.
//
// Keys are card types from the catalog (.kiro/specs/duel-card-pipeline/cards/).
//   asset        file name in assets/models/, without .glb
//   kind         the piece's name in cue code
//   height       metres the model is scaled to
//   footprint    widest the model may stand on its tile; larger models shrink to fit
//   yaw          turn that makes the model face the other side (radians)
//   rig          optional attack clip inside the file, and the frame its hit lands (30 fps)
export const CARD_MODELS = Object.freeze({
  // The Dragon's head is +X natively (yaw -PI/2 faces +Z).
  "wizard-dragon": {kind: "dragon", asset: "dragon", height: 1.25, footprint: 2.1, yaw: -Math.PI / 2,
    rig: {clip: "dragon_attack", impactFrame: 18}},
  // Mounted Billy's horse is +Z natively (yaw PI faces the Wizards at -Z).
  "cowboy-mounted-billy": {kind: "mounted-billy", asset: "mounted-billy", height: 1.7, footprint: 2.05, yaw: Math.PI,
    rig: {clip: "mounted_attack", impactFrame: 20}},
  // The Skeleton faces +Z natively, toward the Cowboys from the Wizard side.
  "wizard-skeleton": {kind: "skeleton", asset: "skeleton", height: 1.2, footprint: 1.2, yaw: 0},
});

// Troops posed and animated by their own code (sheriff.js, wizard.js, rig.js), not by an entry above.
export const CODE_RIGGED = Object.freeze({"cowboy-billy": "billy", "wizard-wizard": "wizard", "cowboy-sheriff": "sheriff"});

export const cardType = (cardId) => cardId.replace(/-\d+$/, "");
// "model", "rig" or "placeholder".
export const formOf = (type) => (CARD_MODELS[type] ? "model" : CODE_RIGGED[type] ? "rig" : "placeholder");
