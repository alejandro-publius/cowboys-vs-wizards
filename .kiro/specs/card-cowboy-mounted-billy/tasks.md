# Tasks: Mounted Billy (`cowboy-mounted-billy`)

Status words as in the Sheriff tasks. No test title cites these IDs, so the trace lists them as orphans. No test was run for this spec in this session. Rules test file: `prototypes/showdown/rules.test.js`.

- [ ] CARD-COWBOY-MOUNTED-BILLY-01 partial: `tests/game/card-specs.test.js`, "Showdown keeps the lane catalog's numbers for lane cards" asserts side, name, kind, stars, attack, health and bounty.
- [ ] CARD-COWBOY-MOUNTED-BILLY-02 unsigned. Assertion to add: with 1, 2 and 3 own troops, the summon actions number 0, 1 and 3.
- [ ] CARD-COWBOY-MOUNTED-BILLY-03 unsigned. Assertion to add: after a 2-tribute summon on turn 4, `canAttack` is true.
- [ ] CARD-COWBOY-MOUNTED-BILLY-04 covered: rules, "Ride: a rider may pass standing troops to strike the Base for one orb": `assert.deepEqual(attacks(state), ["0>0", "0>base", "1>0"])`.
- [ ] CARD-COWBOY-MOUNTED-BILLY-05 covered: same test, Wizard Base 4 after the ride-past.
- [ ] CARD-COWBOY-MOUNTED-BILLY-06 covered: rules, "damage beyond the target's last orb hits its Base, and a defeated target does not hit back": outcome `{baseDamage: 2, targetLeft: 0, attackerLeft: 5}`, Wizard Base 3.
- [ ] CARD-COWBOY-MOUNTED-BILLY-07 covered: rules, "the hit back an attack reports is the defender's attack, and the bot leaves a finished game alone": `hitBack` 3.
- [ ] CARD-COWBOY-MOUNTED-BILLY-08 covered: same test, `hitBack` 0 for the Mounted Billy in cover.
- [ ] CARD-COWBOY-MOUNTED-BILLY-09 unsigned. Assertion to add: `DECKS.cowboy["cowboy-mounted-billy"] === 1`.
- [ ] CARD-COWBOY-MOUNTED-BILLY-10 unsigned. Assertion to add: `settle(saveAt({wins: 4}), "trail", true).earned.cards` deep-equals `[["cowboy-mounted-billy", 1]]`.
- [ ] CARD-COWBOY-MOUNTED-BILLY-11 covered: `prototypes/showdown/progress.test.js`, "deck rules: sixteen cards, only what you own, rarity limits across deck and side deck, four in the side deck": `/Mounted Billy is Rare: at most 2/`.
