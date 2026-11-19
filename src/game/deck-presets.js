// A named Cowboy deck the deck builder can load as an editable draft.
// The counts use the saved-deck format: every catalog type in catalog order,
// with an explicit zero. Loading copies them into the builder's unsaved draft;
// only Save deck stores them.
export const DEADEYE_CONTROL = Object.freeze({
  name: "Deadeye Control",
  counts: Object.freeze({
    "cowboy-sheriff": 6,
    "cowboy-billy": 3,
    "cowboy-mounted-billy": 0,
    "cowboy-deadeye": 3,
  }),
});

// Frontier (content pack 1): one card per counted duel win, starting at the
// second win. `wins` is profile.stats.wins, which skips hunts, drafts and lessons.
export const FRONTIER_UNLOCKS = Object.freeze([
  Object.freeze({type: "cowboy-lasso", wins: 2}),
  Object.freeze({type: "cowboy-covered-wagon", wins: 3}),
  Object.freeze({type: "cowboy-outrider", wins: 4}),
  Object.freeze({type: "cowboy-dynamiter", wins: 5}),
  Object.freeze({type: "cowboy-ranger", wins: 6}),
  Object.freeze({type: "cowboy-gatling-crew", wins: 7}),
]);

// Frontier type IDs a profile has earned, in unlock order. Pass a profile
// snapshot (profile.get()). This is the entitlement.frontierCards array.
export function frontierUnlocked(saved) {
  const wins = Number(saved?.stats?.wins);
  const count = Number.isFinite(wins) ? wins : 0;
  return FRONTIER_UNLOCKS.filter((card) => count >= card.wins).map((card) => card.type);
}

// Drop counts for Frontier cards the profile has not earned, so a draft built
// from the all-types catalog counts only names cards the player owns.
export function ownedCounts(counts, frontierCards) {
  const locked = new Set(FRONTIER_UNLOCKS.map((card) => card.type).filter((type) => !frontierCards.includes(type)));
  return Object.fromEntries(Object.entries(counts).filter(([type]) => !locked.has(type)));
}

// Wagon Train needs every card in it (Gatling Crew, 7 wins). Night Riders
// needs Ranger (6 wins).
export const WAGON_TRAIN = Object.freeze({
  name: "Wagon Train",
  wins: 7,
  counts: Object.freeze({
    "cowboy-sheriff": 3,
    "cowboy-billy": 2,
    "cowboy-mounted-billy": 0,
    "cowboy-deadeye": 2,
    "cowboy-covered-wagon": 2,
    "cowboy-outrider": 0,
    "cowboy-dynamiter": 0,
    "cowboy-ranger": 0,
    "cowboy-gatling-crew": 1,
    "cowboy-lasso": 2,
  }),
});

export const NIGHT_RIDERS = Object.freeze({
  name: "Night Riders",
  wins: 6,
  counts: Object.freeze({
    "cowboy-sheriff": 3,
    "cowboy-billy": 0,
    "cowboy-mounted-billy": 0,
    "cowboy-deadeye": 2,
    "cowboy-covered-wagon": 0,
    "cowboy-outrider": 2,
    "cowboy-dynamiter": 2,
    "cowboy-ranger": 2,
    "cowboy-gatling-crew": 0,
    "cowboy-lasso": 1,
  }),
});

// One-tribute posse: Sheriffs hold or pressure lanes, then one is traded for a
// Billy to strengthen that lane. Replaces Mounted Billy with a fourth Billy and
// keeps the starter's two Deadeyes.
export const BILLY_POSSE = Object.freeze({
  name: "Billy Posse",
  counts: Object.freeze({
    "cowboy-sheriff": 6,
    "cowboy-billy": 4,
    "cowboy-mounted-billy": 0,
    "cowboy-deadeye": 2,
  }),
});
