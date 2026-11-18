import {CARDS, SIDES, opponent} from "../game/cards.js";
import {pendingDrift, resolveClash, resultAfterClash} from "../game/clash.js";
import {shiftTroop} from "../game/lanes.js";

function baseLine(label, before, after) {
  return `${label} ${before} → ${after}${after === 0 ? " (falls)" : ""}`;
}

// The match result from the viewer's side, as a lower-case clause.
function verdict({winner, loser, reason}, viewer, boss = "Dragon") {
  const outcome = winner === viewer ? "you win the match"
    : loser === viewer ? "you lose the match"
    : "the match ends in a draw";
  if (reason === "bounty-captured") return `you capture the ${boss}`;
  if (reason === "bounty-escaped") return "the bounty slips away";
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
  // A Lantern Wraith hunt's marked move runs inside the same resolver.
  const hunt = {round: view.round, bountyTarget: view.bountyTarget, bountyDrift: view.bountyDrift};
  const drift = pendingDrift({...hunt, sides});
  resolveClash({...hunt, sides}, (event) => {
    if (event.type !== "defeat") return;
    const owner = event.side === view.viewer ? "Your" : "Enemy";
    losses.push(`${owner} ${CARDS[event.cardId].name} (lane ${event.slot + 1})`);
  });
  // Judge the resolved snapshot as the live match does, round limit included.
  const result = resultAfterClash({round: view.round, sides, bountyTarget: view.bountyTarget});

  const own = view.viewer;
  const enemy = opponent(own);
  const enemyStillActs = view.startingSide === own;
  const boss = view.bountyTarget ? CARDS[view.bountyTarget].name : undefined;
  let timing = drift ? `The ${boss} drifts from lane ${drift.slot + 1} to lane ${drift.destination + 1} first. ` : "";
  timing += enemyStillActs
    ? "Wizards still act. Preview assumes the board stays as shown."
    : "End turn resolves this clash.";
  if (result) {
    const outcome = verdict(result, own, boss);
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
    pass: options.playableCardIds.length === 0 && !options.canRideOut ? "No cards can be played. Select End turn." : "",
  };
}

// Reuse the normal clash projection with the same troop and its remaining life.
// Troops that would fall are named too: a swap often changes who falls and no Base.
export function rideForecasts(view, options) {
  const from = options?.rideFrom;
  if (!view || from == null) return {};
  const destinations = options.step === "ride-destination" ? options.ownSlots
    : options.canConfirm ? [options.rideDestination] : [];
  const own = view.viewer;
  return Object.fromEntries(destinations.map((to) => {
    const moved = { ...view.sides[own], board: [...view.sides[own].board] };
    shiftTroop(moved.board, from, to);
    const forecast = clashForecast({ ...view, sides: { ...view.sides, [own]: moved } }, { ...options, step: "idle" });
    return [to, forecast.losses ? `${forecast.bases}. ${forecast.losses}` : forecast.bases];
  }));
}
