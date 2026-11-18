import {CARDS, SIDES, opponent} from "../game/cards.js";
import {resolveClash, resultAfterClash} from "../game/clash.js";

function baseLine(label, before, after) {
  return `${label} ${before} → ${after}${after === 0 ? " (falls)" : ""}`;
}

// The match result from the viewer's side, as a lower-case clause.
function verdict({winner, loser, reason}, viewer) {
  const outcome = winner === viewer ? "you win the match"
    : loser === viewer ? "you lose the match"
    : "the match ends in a draw";
  return reason === "round-limit" ? `${outcome} at the round limit` : outcome;
}

export function clashForecast(view, options) {
  if (!view || view.result || view.traps?.enabled || view.activeSide !== view.viewer
    || options?.step !== "idle") return null;

  // The live resolver mutates its board and discards. Give it a detached
  // snapshot of only the public state needed to resolve this clash.
  const sides = Object.fromEntries(SIDES.map((side) => {
    const {baseOrbs, board, discard} = view.sides[side];
    return [side, {baseOrbs, board: board.map((troop) => troop && {...troop}), discard: [...discard]}];
  }));
  const losses = [];
  resolveClash({sides}, (event) => {
    if (event.type !== "defeat") return;
    const owner = event.side === view.viewer ? "Your" : "Enemy";
    losses.push(`${owner} ${CARDS[event.cardId].name} (lane ${event.slot + 1})`);
  });
  // Judge the resolved snapshot as the live match does, round limit included.
  const result = resultAfterClash({round: view.round, sides});

  const own = view.viewer;
  const enemy = opponent(own);
  const enemyStillActs = view.startingSide === own;
  let timing = enemyStillActs
    ? "Wizards still act. Preview assumes the board stays as shown."
    : "End turn resolves this clash.";
  if (result) {
    const outcome = verdict(result, own);
    timing += enemyStillActs
      ? ` If it does, ${outcome}.`
      : ` ${outcome[0].toUpperCase()}${outcome.slice(1)}.`;
  }
  return {
    bases: [
      baseLine("Your Base", view.sides[own].baseOrbs, sides[own].baseOrbs),
      baseLine("Enemy Base", view.sides[enemy].baseOrbs, sides[enemy].baseOrbs),
    ].join(" · "),
    losses: losses.length ? `Troops that fall: ${losses.join(", ")}.` : "",
    timing,
    pass: options.playableCardIds.length === 0 ? "No cards can be played. Select End turn." : "",
  };
}
