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
