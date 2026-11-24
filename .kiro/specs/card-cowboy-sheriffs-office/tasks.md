# Tasks: Sheriff's Office (`cowboy-sheriffs-office`)

Status words as in the Sheriff tasks. No test title cites these IDs, so the trace lists them as orphans. No test was run for this spec in this session. Rules test file: `prototypes/showdown/rules.test.js`; progress test file: `prototypes/showdown/progress.test.js`.

- [ ] CARD-COWBOY-SHERIFFS-OFFICE-01 covered: `tests/game/card-specs.test.js`, "canonical Showdown values for a sample of cards": `TYPES["cowboy-sheriffs-office"]` deep-equals `{side: "cowboy", name: "Sheriff's Office", rarity: "rare", kind: "location", effect: "office", fresh: true}`.
- [ ] CARD-COWBOY-SHERIFFS-OFFICE-02 partial: rules, "locations: one for the whole table, it adds attack by type tag, and a new one replaces it" plays the Office from hand. The action list is not asserted.
- [ ] CARD-COWBOY-SHERIFFS-OFFICE-03 covered: same test, "The location already in play cannot be played again": no `location` action.
- [ ] CARD-COWBOY-SHERIFFS-OFFICE-04 unsigned. Assertion to add: after the play, `state.location` deep-equals `{cardId: "cowboy-sheriffs-office-1", side: "cowboy"}` and `cowboy.discard` does not include it.
- [ ] CARD-COWBOY-SHERIFFS-OFFICE-05 partial: same test, the Sheriff's `attackOf` is 2. Outrider and Ranger are not asserted.
- [ ] CARD-COWBOY-SHERIFFS-OFFICE-06 covered: same test, Billy's `attackOf` stays 2 ("the Outlaw does not").
- [ ] CARD-COWBOY-SHERIFFS-OFFICE-07 unsigned. Assertion to add: with the Boneyard in play, the Office play leaves `wizard.discard` ending with `wizard-boneyard-1`.
- [ ] CARD-COWBOY-SHERIFFS-OFFICE-08 covered: same test, `assert.deepEqual(state.sides.cowboy.discard, ["cowboy-sheriffs-office-1"])` after the Boneyard.
- [ ] CARD-COWBOY-SHERIFFS-OFFICE-09 unsigned. Assertion to add: after the Office, a Deadeye and a Six-Shooter in hand give no `spell` or `gear` action.
- [ ] CARD-COWBOY-SHERIFFS-OFFICE-10 unsigned. Assertion to add: `presentEvent({type: "location", side: "cowboy", cardId: "cowboy-sheriffs-office-1"})` equals the exact sentence.
- [ ] CARD-COWBOY-SHERIFFS-OFFICE-11 unsigned. Assertion to add: `win(saveAt({rivals: 1}), "rival:imp").earned` deep-equals `{cards: [["cowboy-sheriffs-office", 1]], packs: 1, captured: null}`.
- [ ] CARD-COWBOY-SHERIFFS-OFFICE-12 partial: progress, "a rival's own reward cannot be earned before that rival is beaten, and never goes past its limit": thirty packs after one rival hold the Six-Shooter but no Office. Offers are not asserted.
- [ ] CARD-COWBOY-SHERIFFS-OFFICE-13 unsigned. Assertion to add: `DECKS.cowboy["cowboy-sheriffs-office"] === undefined`.
- [ ] CARD-COWBOY-SHERIFFS-OFFICE-14 unsigned. Assertion to add: a deck of 2 plus a side deck of 1 returns a problem.
