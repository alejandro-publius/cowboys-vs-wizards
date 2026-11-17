// Generators. Two kinds of legal starting state:
//   reachable   createMatch(seed, { cowboyDeck }), optionally advanced by legal actions;
//   constructed buildFixture(): cards redistributed across zones and boards with
//               explicit invariants (checkState passes by construction, and is
//               asserted). Constructed states need not be reachable from createMatch.
import { CARDS, MAX_COWBOY_COPIES, SIDES, opponent } from "../../../src/game/cards.js";
import { COWBOY_CATALOG, DECK_SIZE, deckIds } from "../../../src/game/deck-builder.js";
import { createMatch, SLOT_COUNT } from "../../../src/game/state.js";
import { applyAction } from "../../../src/game/actions.js";
import { legalActions } from "../../../src/game/legal.js";
import { checkState, expectedOf } from "./invariants.js";

const SHERIFF = "cowboy-sheriff";
const types = COWBOY_CATALOG.map(({ type }) => type);

// Every valid composition: DECK_SIZE cards, 0-6 copies of each type, at least one Sheriff.
export function allCompositions() {
  const out = [];
  const fill = (index, left, counts) => {
    if (index === types.length) {
      if (left === 0 && counts[SHERIFF] >= 1) out.push({ ...counts });
      return;
    }
    for (let n = 0; n <= Math.min(MAX_COWBOY_COPIES, left); n++) fill(index + 1, left - n, { ...counts, [types[index]]: n });
  };
  fill(0, DECK_SIZE, {});
  return out;
}

export function boundaryTags(counts) {
  const tags = [];
  if (counts[SHERIFF] === 1) tags.push("one-sheriff-minimum");
  if (types.some((type) => counts[type] === MAX_COWBOY_COPIES)) tags.push("six-copy-cap");
  return tags;
}

export const COMPOSITIONS = allCompositions();
export const BOUNDARY_COMPOSITIONS = COMPOSITIONS.filter((counts) => boundaryTags(counts).length > 0);

const isTroop = (id) => CARDS[id].kind === "troop";

export function randomCounts(rng, boundaryChance = 0.6) {
  return rng.chance(boundaryChance) ? rng.pick(BOUNDARY_COMPOSITIONS) : rng.pick(COMPOSITIONS);
}

// A reachable state: createMatch with a custom Cowboy deck, then `steps` random legal actions.
export function reachableState(rng, { counts = randomCounts(rng), steps = rng.int(14) } = {}) {
  let state = createMatch(rng.int(100000), { cowboyDeck: deckIds(counts) });
  for (let i = 0; i < steps && !state.result; i++) {
    const actions = legalActions(state, state.activeSide);
    const action = { ...rng.pick(actions), actionId: `gen-${i}` };
    state = applyAction(state, action).state;
  }
  return { state, counts, kind: "reachable" };
}

// A constructed state.
//   boardSize(side) -> troops on that board (default random 0-3)
//   mustHold { side, test(cardId) } -> that side's hand holds a card passing `test`
//   active, round, fresh (allowances unused)
// Returns null when the deck cannot satisfy the request; use buildFixtureWith to retry.
export function buildFixture(rng, opts = {}) {
  const counts = opts.counts ?? randomCounts(rng);
  const state = createMatch(rng.int(100000), { cowboyDeck: deckIds(counts) });
  for (const side of SIDES) {
    const zone = state.sides[side];
    const all = rng.shuffle([...zone.deck, ...zone.hand, ...zone.discard]);
    const must = opts.mustHold?.side === side ? opts.mustHold.test : null;
    const held = must ? all.find(must) : undefined;
    if (must && held === undefined) return null;
    const pool = all.filter((id) => id !== held);
    const troops = pool.filter(isTroop);
    const wanted = opts.boardSize ? opts.boardSize(side) : rng.int(SLOT_COUNT + 1);
    if (wanted > troops.length) return null;
    const onBoard = troops.slice(0, wanted);
    const rest = pool.filter((id) => !onBoard.includes(id));
    const handSize = held === undefined ? rng.int(Math.min(rest.length, 6) + 1) : rng.int(Math.min(rest.length, 5) + 1);
    const discardSize = rng.int(Math.min(rest.length - handSize, 3) + 1);
    zone.hand = [...(held === undefined ? [] : [held]), ...rest.slice(0, handSize)];
    zone.discard = rest.slice(handSize, handSize + discardSize);
    zone.deck = rest.slice(handSize + discardSize);
    zone.board = Array(SLOT_COUNT).fill(null);
    const slots = rng.shuffle([...Array(SLOT_COUNT).keys()]).slice(0, wanted);
    onBoard.forEach((cardId, i) => {
      const max = CARDS[cardId].health;
      zone.board[slots[i]] = { cardId, health: rng.chance(0.4) ? 1 : 1 + rng.int(max) };
    });
    zone.baseOrbs = rng.chance(0.4) ? 1 + rng.int(2) : 1 + rng.int(5);
  }
  state.round = opts.round ?? 1 + rng.int(9);
  state.startingSide = rng.pick(SIDES);
  state.activeSide = opts.active ?? (rng.chance(0.5) ? state.startingSide : opponent(state.startingSide));
  if (opts.active) state.startingSide = rng.chance(0.5) ? opts.active : opponent(opts.active);
  for (const side of SIDES) {
    state.allowances[side] = opts.fresh
      ? { summonUsed: false, castUsed: false }
      : { summonUsed: rng.chance(0.3), castUsed: rng.chance(0.3) };
  }
  state.revision = rng.int(40);
  state.actionIds = ["used-1"];
  checkState(state, expectedOf(state), "constructed fixture");
  return { state, counts, kind: "constructed" };
}

export function buildFixtureWith(rng, opts) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const made = buildFixture(rng, opts);
    if (made) return made;
  }
  throw new Error("could not build a fixture for " + JSON.stringify(Object.keys(opts)));
}

export const emptySlots = (board) => board.map((_, slot) => slot).filter((slot) => board[slot] === null);
export const occupiedSlots = (board) => board.map((_, slot) => slot).filter((slot) => board[slot] !== null);
