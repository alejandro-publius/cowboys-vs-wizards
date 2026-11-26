import {EVEN_FIGHT_DECKS} from "../game/showdown/rules.js";

export const EVEN_FIGHT_MODES = Object.freeze({
  "1": {label: "Play solo", players: 1, best: 1},
  series: {label: "Best of three", players: 1, best: 3},
  two: {label: "Two players", players: 2, best: 1},
});

export function evenFightFromQuery(query) {
  const mode = query.get("even-fight");
  const otherRoutes = ["turn", "outrider", "practice", "wizard", "lesson", "saloon", "replay", "room"];
  return Object.hasOwn(EVEN_FIGHT_MODES, mode) && !otherRoutes.some((key) => query.has(key)) ? mode : null;
}

export const evenFightDuel = () => ({
  id: "even-fight", kind: "even-fight", name: "Even Fight preview", level: 2,
  lesson: "The second player starts with 7 Base orbs and an extra card. Cover shields troops from spells, including Hellfire. The Wizard deck has three Skeletons and two Imps.",
  options: {decks: EVEN_FIGHT_DECKS, evenFight: true},
});
