// The contract between the Showdown rules and any screen drawn on top of them, 2D or 3D.
// Two halves: what one side is allowed to see (viewFor), and every event the rules can
// report with the fields it carries and what a screen has to show for it (EVENTS).
// A screen that shows only viewFor and reacts only to EVENTS cannot leak a hidden card and
// cannot miss a rule. contract.test.js holds both halves to the engine.
// The state as `side` may see it. Its own hand and traps are listed; the other side's are
// counts. Neither deck's order is visible to anyone. Boards, Bases, graveyards and the
// location are public, and so is a boss due to land.
// The seed is left out: with it, anyone could deal the game again and read both hands and both decks.
export {viewFor} from "./rules.js";

// fields: every key the event carries besides `type`. shows: what a player must be able to see happen.
// hidden: a field the other side must not be shown (the event still reaches both screens).
export const EVENTS = Object.freeze({
  turn: {fields: ["side", "turn"], shows: "The turn passes to `side`. Its troops stand up: they may act again and leave cover."},
  draw: {fields: ["side"], shows: "One card moves from that side's deck to its hand, face down to the other side."},
  burn: {fields: ["side", "cardId"], shows: "That side's hand was full: the drawn card is shown and goes to its graveyard."},
  fatigue: {fields: ["side"], shows: "That side's deck is empty: its Base loses one orb."},
  tribute: {fields: ["side", "cardId"], shows: "One of that side's troops leaves the board for the graveyard as payment."},
  summon: {fields: ["side", "cardId"], shows: "A troop arrives on that side's first empty slot: played from the hand, or a boss landing on its turn."},
  raise: {fields: ["side", "cardId"], shows: "A troop returns from that side's graveyard to its first empty slot with 1 orb."},
  spell: {fields: ["side", "cardId", "target", "left", "stunned"], shows: "A spell hits one troop: it drops to `left` orbs (defeated at 0), or is stunned. One event per troop hit."},
  gear: {fields: ["side", "cardId", "target"], shows: "A piece of gear is fixed to one of that side's troops and stays on it."},
  location: {fields: ["side", "cardId"], shows: "A location takes the table's one location slot; any location there leaves for its owner's graveyard."},
  set: {fields: ["side"], shows: "That side puts one card face down in a trap slot. The card is not named."},
  cover: {fields: ["side", "cardId"], shows: "A troop takes cover until its owner's next turn."},
  trap: {fields: ["side", "cardId", "target", "left", "stopped"], shows: "A face-down card of `side` is revealed and springs on the attacking troop. `stopped` means the attack never lands."},
  attack: {fields: ["side", "cardId", "target", "covered", "hitBack", "baseDamage", "targetLeft", "attackerLeft"], shows: "A troop strikes a troop or the Base. The target drops to `targetLeft`, a surviving target outside cover hits back with its attack, `hitBack`, and `baseDamage` orbs leave the defending Base."},
  laststand: {fields: ["side", "cardId", "target", "left"], shows: "A troop defeated in a fight takes one orb off the troop that fought it."},
  sweep: {fields: ["side", "cardId", "count"], shows: "After its attack, the troop's sweep takes one orb from each of the other enemy troops."},
});
