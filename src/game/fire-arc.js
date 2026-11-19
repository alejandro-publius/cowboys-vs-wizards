// Depth arc draft (Fable 5.2 depth-arc-kiro-brief.md, Job 2): Ember Gulch, then
// two Bonewright positions on one board, differing only in who moves first.
// Pure rules data: no DOM, rendering, filesystem or network. Nothing here is a
// counted result, reward or profile change.
//
// Dragon Fire itself is Job 1 (clash.js). Until it lands these states set
// `state.dragonFire = { enabled: true }` directly, as the brief says.
//
// The Bonewright's Rebuild: on a round the Cowboy moves first, while the
// Bonewright holds a Wizard and has not acted, its troop with the fewest orbs
// left (below that card's printed orbs; ties to the lower lane) carries the
// mark. On its turn it tributes that troop and summons a Wizard into the lane.
// Otherwise it plays as the Normal bot.
import { CARDS } from "./cards.js";
import { chooseAction } from "./cpu.js";
import { legalActions } from "./legal.js";
import { createMatch } from "./state.js";
import { publicState } from "./view.js";

export const EMBER_GULCH_NOTE = "Ember Gulch. The Graveyard Dragon breathes fire: what its blocker cannot absorb burns through to your Base.";
export const EARN_LINE = "You took the fire. Captured Dragon now burns through: damage beyond its blocker's last orb hits the Wizard Base.";
export const BONEWRIGHT_NOTE = "The Bonewright. When it moves after you, it rebuilds its weakest troop into a fresh Wizard.";
export const CLOSING_LINE = "Fire burns through what is already hurt. Strike after the Bonewright has moved, or let it spend its rebuild first.";

const sheriff = (n) => `cowboy-sheriff-${n}`;
const skeleton = (n) => `wizard-skeleton-${n}`;
const wizardCard = (n) => `wizard-wizard-${n}`;
const DRAGON = "wizard-dragon-1";

// Authored stages. A board entry is [cardId, orbs] or null; lane 0 is lane 1.
// Ember Gulch uses hunt rules (Ride Out on); the Bonewright positions are standard rules.
export const FIRE_ARC = Object.freeze({
  "ember-gulch": Object.freeze({
    seed: 1118, title: "Ember Gulch", rideOut: true, note: EMBER_GULCH_NOTE,
    round: 1, startingSide: "cowboy", bountyTarget: DRAGON,
    cowboy: {
      base: 2, board: [null, [sheriff(1), 1], null],
      hand: ["cowboy-billy-1", "cowboy-deadeye-1", sheriff(2), sheriff(3)],
      deck: [sheriff(4), sheriff(5), sheriff(6), "cowboy-billy-2"],
    },
    wizard: {
      base: 5, board: [null, [DRAGON, 3], null],
      hand: [skeleton(1), skeleton(2), skeleton(3), skeleton(4)],
      deck: [skeleton(5), skeleton(6), wizardCard(1), wizardCard(2)],
    },
  }),
  "position-a": Object.freeze({ seed: 1119, title: "The Bonewright: it has moved", rideOut: false, note: `${BONEWRIGHT_NOTE} Round 7 of 9. It moved first this round and passed.`, startingSide: "wizard", ...bonewrightBoard() }),
  "position-b": Object.freeze({ seed: 1120, title: "The Bonewright: you move first", rideOut: false, note: `${BONEWRIGHT_NOTE} Round 7 of 9. You move first this round.`, startingSide: "cowboy", ...bonewrightBoard() }),
});
export const FIRE_ARC_ORDER = Object.freeze(["ember-gulch", "position-a", "position-b"]);

function bonewrightBoard() {
  return {
    round: 7,
    cowboy: {
      base: 2, board: [[sheriff(1), 2], [sheriff(2), 3], null],
      hand: ["cowboy-captured-dragon-1", "cowboy-deadeye-1", sheriff(3)],
      deck: [sheriff(4), "cowboy-billy-1", sheriff(5)],
    },
    wizard: {
      base: 3, board: [[wizardCard(1), 4], [skeleton(1), 2], [skeleton(2), 3]],
      hand: [wizardCard(2), skeleton(3)],
      deck: [skeleton(4), skeleton(5)],
    },
  };
}

// A fresh, unplayed state for a stage. Dragon Fire is set directly (Job 1 pending).
export function createFireArcStage(stage) {
  const spec = FIRE_ARC[stage];
  if (!spec) throw new Error(`Unknown fire arc stage ${stage}`);
  const state = createMatch(spec.seed, { rideOut: spec.rideOut });
  state.dragonFire = { enabled: true };
  for (const side of ["cowboy", "wizard"]) {
    const own = state.sides[side];
    const data = spec[side];
    own.baseOrbs = data.base;
    own.board = data.board.map((troop) => troop && { cardId: troop[0], health: troop[1] });
    own.hand = [...data.hand];
    own.deck = [...data.deck];
    own.discard = [];
  }
  state.round = spec.round;
  state.startingSide = state.activeSide = spec.startingSide;
  if (spec.bountyTarget) state.bountyTarget = spec.bountyTarget;
  return state;
}

// The marked Wizard lane (zero-based) or null. Accepts the full state or the
// Wizard's own public view (both carry the Wizard hand); a Cowboy view has no
// Wizard hand and gives null.
export function rebuildMark(state) {
  if (!state?.sides || state.result || state.startingSide !== "cowboy") return null;
  const wizard = state.sides.wizard;
  const allowance = state.allowances.wizard;
  if (!wizard.hand?.some((cardId) => CARDS[cardId].name === "Wizard")) return null;
  if (allowance.summonUsed || allowance.castUsed) return null;
  let mark = null;
  let fewest = Infinity;
  wizard.board.forEach((troop, lane) => {
    if (troop && troop.health < CARDS[troop.cardId].health && troop.health < fewest) [mark, fewest] = [lane, troop.health];
  });
  return mark;
}

// The Bonewright's next action: Rebuild on the marked lane, else the Normal
// bot. Takes the full state or the Wizard's public view. null off its phase.
export function rivalAction(state) {
  const view = state.viewer ? state : publicState(state, "wizard");
  if (view.activeSide !== "wizard") return null;
  const mark = rebuildMark(view);
  if (mark !== null) {
    const cardId = view.sides.wizard.hand.find((id) => CARDS[id].name === "Wizard");
    const rebuild = legalActions(view, "wizard").find((action) => action.type === "summon"
      && action.cardId === cardId && action.slot === mark && action.tributes.length === 1 && action.tributes[0] === mark);
    if (rebuild) return rebuild;
  }
  return chooseAction(view);
}

// The lane an action rebuilds on `state` (before the action), else null.
export function rebuildLane(state, action) {
  if (action?.type !== "summon" || action.side !== "wizard") return null;
  const mark = rebuildMark(state);
  return mark !== null && action.slot === mark && action.tributes.length === 1 && action.tributes[0] === mark ? mark : null;
}

// Sentence for a defeat the rebuild caused, or null. Reliable only when the
// Captured Dragon met the rebuilt lane's fresh troop and defeated it exactly
// (nothing left to burn through) in the events of the deciding clash.
export function rebuildLossCause(events, lane) {
  const hits = events.filter((event) => event.type === "damage" && event.lane === lane);
  const dragon = hits.find((event) => event.attacker.side === "cowboy"
    && event.attacker.cardId.startsWith("cowboy-captured-dragon") && event.target.kind === "troop");
  if (!dragon || dragon.after !== 0 || dragon.before !== dragon.amount) return null;
  if (hits.some((event) => event.fire === true)) return null;
  return `The Bonewright rebuilt lane ${lane + 1} before the clash, so nothing burned through.`;
}

// model.fireArc: { stage, note, mark, lossCause? }. `mark` is a zero-based Wizard lane or null.
export function fireArcView({ stage, state = null, lossCause = null }) {
  const note = stage === "earn" ? EARN_LINE : FIRE_ARC[stage].note;
  return { stage, note, mark: state ? rebuildMark(state) : null, ...(lossCause && { lossCause }) };
}
