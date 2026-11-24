// Recorded Showdown results. Reproduce with node scripts/verify-billy-replay.mjs --full.
export const BILLY_REPLAY = {
  "seed": 726421019,
  "first": "cowboy",
  "matchedEvents": 29,
  "turn": 7,
  "attackerId": "cowboy-billy-1",
  "targetId": "wizard-bone-wall-2",
  "targetOrbsBefore": 2,
  "baseline": {
    "attack": 2,
    "targetOrbsAfter": 0,
    "winner": "cowboy",
    "endTurn": 13
  },
  "candidate": {
    "attack": 1,
    "targetOrbsAfter": 1,
    "winner": "wizard",
    "endTurn": 20
  },
  "cohort": {
    "firstSeed": 726420000,
    "deals": 2500,
    "gamesPerArm": 5000,
    "baselineCowboyWins": 3052,
    "candidateCowboyWins": 2646,
    "baselineFirstWins": 2972,
    "candidateFirstWins": 2902,
    "switchedCowboyToWizard": 549,
    "switchedWizardToCowboy": 143,
    "csvSha256": "73f25c8310fabc34b28165a0b6e1cfac8004b2f384ca2d240b302cb0158d8747"
  },
  "source": {
    "commit": "eedab9385931e093e156fdb7885c470eb2ec64eb",
    "cardHashes": [
      "2b46216473a61b4b9abe47a1a1bc7eaf382763b1092a1ef55aecefa667428b90",
      "eba09592944e8ca2d8e0bab29855b73d47dc14b2776e3b5bb97b4f41a70a6736"
    ],
    "proposalSeal": "ce4c34018d5cc827dd8f91e54f944db1f63360d74c4ff4cee9638955ed38ec12"
  }
};
