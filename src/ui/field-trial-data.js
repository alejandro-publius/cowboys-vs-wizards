// The Night Shift repair field trial as checked in by the coordinator. Each file is JSON null
// until the coordinator writes its result; nothing here fills in a missing run.
import fresh from "../../docs/evidence/night-shift-repair/fresh.json" with {type: "json"};
import witness from "../../docs/evidence/night-shift-repair/witness.json" with {type: "json"};

export const FIELD_TRIAL = {fresh, witness};
