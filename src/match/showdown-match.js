// Best of three in the graybox (issue 143 slice 3). Pure: no DOM and no storage. The flow is the
// reference screen's (prototypes/showdown/main.js advance() and nextGame()): first to two game wins,
// a draw counts for nobody, the loser of a game opens the next one, and between games the solo
// player may swap cards between the deck and the side deck for this match only. Nothing is saved
// until the match is decided, and then the campaign settles the duel once.
import {DECK_SIZE} from "../game/showdown/progress.js";
import {opponent} from "../game/showdown/rules.js";

export const GAMES_TO_WIN = 2;
const sum = (counts) => Object.values(counts).reduce((total, copies) => total + copies, 0);
const tidy = (counts) => Object.fromEntries(Object.entries(counts).filter(([, copies]) => copies > 0));

// deck and side: the Cowboy deck and side deck this match starts with (copies, not the saved objects).
export const newMatch = ({deck = {}, side = {}} = {}) => ({wins: {cowboy: 0, wizard: 0}, game: 1, deck: {...deck}, side: {...side}, first: null});

// Records one finished game. winner: "cowboy", "wizard" or null for a draw. first: who opened that game.
export function recordGame(match, {winner, first}) {
  const wins = winner ? {...match.wins, [winner]: match.wins[winner] + 1} : match.wins;
  return {...match, wins, first: winner ? opponent(winner) : first};
}
export const matchOver = (match) => Math.max(match.wins.cowboy, match.wins.wizard) >= GAMES_TO_WIN;
export const matchWinner = (match) => (match.wins.cowboy >= GAMES_TO_WIN ? "cowboy" : match.wins.wizard >= GAMES_TO_WIN ? "wizard" : null);
export const nextGame = (match) => ({...match, game: match.game + 1});

// True when a swap between games is offered: a solo match with a side deck.
export const offersSwap = (match) => sum(match.side) > 0;
// Every card of this match's deck and side deck, by type: what the swap may move between the two.
export function swapPool(match) {
  const pool = {};
  for (const counts of [match.deck, match.side]) for (const [type, copies] of Object.entries(counts)) pool[type] = (pool[type] ?? 0) + copies;
  return pool;
}
// Why a swapped deck cannot be played; the reference screen asks only for a full deck from the same cards.
export function swapProblems(pool, deck, side) {
  const types = new Set([...Object.keys(pool), ...Object.keys(deck), ...Object.keys(side)]);
  if ([...types].some((type) => (deck[type] ?? 0) + (side[type] ?? 0) !== (pool[type] ?? 0) || (deck[type] ?? 0) < 0 || (side[type] ?? 0) < 0)) return ["Only the cards of this match can move."];
  return sum(deck) === DECK_SIZE ? [] : [`A deck is exactly ${DECK_SIZE} cards; this one has ${sum(deck)}.`];
}
export function withSwap(match, deck, side) {
  const problems = swapProblems(swapPool(match), deck, side);
  if (problems.length) throw new Error(problems.join(" "));
  return {...match, deck: tidy(deck), side: tidy(side)};
}
