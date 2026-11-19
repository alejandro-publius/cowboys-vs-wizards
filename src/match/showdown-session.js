// One solo Showdown duel for the graybox screen. The full state stays inside this closure:
// the screen only ever receives viewFor(state, seat), the seat's legal actions and the events.
import {STARTER, TRAIL, applyAction, createShowdown, legalActions, playTurn, viewFor} from "./showdown-engine.js";

// Trail duel 1 for a player with nothing saved, as prototypes/showdown/progress.js duelFor builds it
// for newSave() (starter deck, no rematch grit). Progress is not stored in slice 1.
export function bootHill() {
  const duel = TRAIL[0];
  return {id: "trail:boot-hill", name: duel.name, lesson: duel.lesson, level: duel.level,
    options: {decks: {cowboy: {...STARTER}, wizard: {...duel.deck}}, baseOrbs: {cowboy: 5, wizard: duel.base}, first: duel.first}};
}

export function createShowdownSession({seed, duel, seat = "cowboy"}) {
  let state = createShowdown(seed, duel.options);
  // The other seat is the bot: it plays every one of its turns before control comes back.
  const opponentTurns = () => {
    const events = [];
    while (!state.result && state.active !== seat) {
      const played = playTurn(state, duel.level);
      state = played.state;
      events.push(...played.events);
    }
    return events;
  };
  const opening = opponentTurns();
  const legal = () => (state.result || state.active !== seat ? [] : legalActions(state));
  return {
    seat,
    duel,
    opening,
    // The seat's whole picture of the duel. Hidden zones of the other seat are counts only.
    view: () => viewFor(state, seat),
    legal,
    // Applies one of this seat's legal actions once, then the bot's reply. Returns every event in order.
    act(action) {
      if (state.result || state.active !== seat) throw new Error("not this seat's turn");
      const applied = applyAction(state, action);
      state = applied.state;
      return [...applied.events, ...opponentTurns()];
    },
  };
}
