import {CARD_MODELS} from "./presentation-manifest.js";
// The arena and the code-rigged characters, then every model a card names in the manifest.
export const arenaModelNames=["board","cowboy-tile","wizard-tile","saloon","gateway","billy","wizard","revolver","sheriff",...new Set(Object.values(CARD_MODELS).map(entry=>entry.asset))];
export const perimeterModelNames=["graveyard-corner","ghost-town-corner"];
