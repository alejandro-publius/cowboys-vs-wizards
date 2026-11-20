// DISPOSABLE PLANTED FAULTS, one per Showdown property. Each returns a copy of the engine with
// one function wrapped in test code, to show that its property can see the fault. They are
// not production bugs; nothing in src/ is changed or imported from here.
const faulty = (engine, overrides) => Object.freeze({ ...engine, ...overrides });

// SP1: Cover is written onto the state passed in as well as the copy (a forgotten clone).
export const f1CoverWritesInput = (engine) => faulty(engine, {
  applyAction(state, action) {
    const result = engine.applyAction(state, action);
    if (action.type === "cover") state.sides[state.active].board[action.slot].cover = true;
    return result;
  },
});

// SP2: an action outside legalActions is ignored instead of refused.
export const f2IgnoresUnlistedAction = (engine) => faulty(engine, {
  applyAction(state, action) {
    try { return engine.applyAction(state, action); } catch { return { state: structuredClone(state), events: [] }; }
  },
});

// SP3: damage past a Base's last orb is not clamped, so the Base goes below zero.
export const f3BaseUnderflow = (engine) => faulty(engine, {
  applyAction(state, action) {
    const result = engine.applyAction(state, action);
    for (const event of result.events) {
      if (event.type !== "attack" || !event.baseDamage) continue;
      const defender = engine.opponent(event.side);
      const left = state.sides[defender].base - event.baseDamage;
      if (left < 0) result.state.sides[defender].base = left;
    }
    return result;
  },
});

// SP4 (the fault the brief names): viewFor leaks one card from the other side's hand.
export const f4ViewLeaksOtherHandCard = (engine) => faulty(engine, {
  viewFor(state, side) {
    const view = engine.viewFor(state, side);
    const other = engine.opponent(side);
    const hand = state.sides[other].hand;
    if (hand.length) view.sides[other].lastDrawn = hand.at(-1);
    return view;
  },
});

// SP5: the set event names the card that was set face down.
export const f5SetEventNamesCard = (engine) => faulty(engine, {
  applyAction(state, action) {
    const result = engine.applyAction(state, action);
    for (const event of result.events) if (event.type === "set") event.cardId = action.cardId;
    return result;
  },
});

// SP6: createShowdown keeps a counter between calls and swaps the top two cards of the Cowboy
// deck on every other deal, so dealing the same seed twice gives a different game.
export const f6DealKeepsHiddenState = (engine) => {
  let deals = 0;
  return faulty(engine, {
    createShowdown(seed, options) {
      const state = engine.createShowdown(seed, options);
      const deck = state.sides.cowboy.deck;
      if (deals++ % 2 && deck.length > 1) [deck[0], deck[1]] = [deck[1], deck[0]];
      return state;
    },
  });
};

// SP7: the level-2 plan plays its first troop twice (a second summon in one turn).
export const f7PlanSummonsTwice = (engine) => faulty(engine, {
  planTurn(state) {
    const plan = engine.planTurn(state);
    const at = plan.findIndex((action) => action.type === "summon");
    if (at >= 0) plan.splice(at + 1, 0, structuredClone(plan[at]));
    return plan;
  },
});

// property id -> [fault, the Violation kinds that count as catching it]
export const FAULTS = {
  SP1: [f1CoverWritesInput, ["input-mutated"]],
  SP2: [f2IgnoresUnlistedAction, ["unlisted-applied"]],
  SP3: [f3BaseUnderflow, ["bounds"]],
  SP4: [f4ViewLeaksOtherHandCard, ["hidden-leak"]],
  SP5: [f5SetEventNamesCard, ["event-shape"]],
  SP6: [f6DealKeepsHiddenState, ["replay-diverged"]],
  SP7: [f7PlanSummonsTwice, ["bot-illegal"]],
};
