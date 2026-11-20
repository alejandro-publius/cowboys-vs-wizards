// Outrider decision turns for review (K-011): one Cowboy decision on The Bone Fence where an Outrider may
// ride past the Wizard troops to their Base or fight a troop. Cases come from the search worker's frozen files
// (experiments/showdown-outrider/decision/) and reach the page only after scripts/outrider-gate.mjs has replayed
// both choices in this tree and matched the measured results. Not advice, not a bounty and no rule change:
// the shipped session replays the recorded Cowboy actions from a fresh deal with the unchanged Trail bot.
// Nothing is settled or logged, so a saved career is never touched. Pure: no DOM, storage or network.
import {duelFor, newSave, settle} from "../game/showdown/progress.js";
import {createShowdownSession} from "./showdown-session.js";

const NAME = "Experiment: an Outrider turn";
export const ARMS = ["ride", "fight"];

// newSave() after `wins` Trail wins, offer cleared, in memory only (2 wins = The Bone Fence).
export function trailSave(wins) {
  let save = newSave();
  for (let i = 0; i < wins; i++) save = settle(save, "trail", true).save;
  return {...save, offer: null};
}

// The duel and deal for one case entry ({id, setup: {wins}, seed, prefix, at}); null for a malformed entry.
export function outriderDuel(entry) {
  if (!entry || typeof entry.id !== "string" || !Number.isInteger(entry.seed) || !Array.isArray(entry.prefix) || !Number.isInteger(entry.at)) return null;
  const trail = duelFor(trailSave(entry.setup?.wins ?? 2), "trail");
  if (!trail) return null;
  const lesson = `Experiment for review, not advice or a bounty: nothing here is saved. ${trail.name}, your turn ${entry.at}. `
    + "Your Outrider may attack the Wizard Base past their troops, or attack a troop. Choose, then play the duel out. "
    + "Restart this duel tries the turn again.";
  return {seed: entry.seed, duel: {...trail, id: `outrider:${entry.id}`, kind: "turn", name: NAME, lesson, prefix: entry.prefix, at: entry.at}};
}

// Only an id in the verified list opens; a URL value never becomes actions.
export function outriderTurn(id, verified = []) {
  const entry = typeof id === "string" ? verified.find((each) => each.id === id) : null;
  return entry ? outriderDuel(entry) : null;
}

const outcome = (view) => ({winner: view.result.winner ?? "draw", turn: view.turn, bases: {cowboy: view.sides.cowboy.base, wizard: view.sides.wizard.base}});
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Plays one arm from the landing: the arm action, then continuation(view, legal) until the duel ends.
// Returns the outcome and the full event transcript (for the gate's semantic digest; never shown).
export function playArm(entry, arm, continuation, stepCap = 4000) {
  const {seed, duel} = outriderDuel(entry);
  const session = createShowdownSession({seed, duel});
  const first = entry.arms?.[arm];
  if (!session.legal().some((a) => same(a, first))) throw new Error(`${entry.id} ${arm}: arm action not legal at the landing`);
  const transcript = [session.opening, session.act(first)];
  for (let step = 0; !session.view().result; step++) {
    if (step >= stepCap) throw new Error(`${entry.id} ${arm}: no result in ${stepCap} steps`);
    const legal = session.legal();
    const action = continuation(session.view(), legal);
    if (!legal.some((a) => same(a, action))) throw new Error(`${entry.id} ${arm}: continuation chose an illegal action`);
    transcript.push([action, ...session.act(action)]);
  }
  return {outcome: outcome(session.view()), transcript};
}
