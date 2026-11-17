# Seed range validation (issue #71)

Agent: Kiro CLI. Base: main ebd44ab.

Problem: `parseSeed` in `src/match/controller.js` accepted any safe integer. The engine reduces seeds with `>>>0`, so values such as 4294967356 silently aliased to seed 60.

Change: a supplied seed must be an integer from 0 to 4294967295, as a number or a digit string. Negatives, larger values, fractions and non-digit strings are refused before `createMatch`, with the message "Seed must be a whole number from 0 to 4294967295." Engine RNG, `createMatch` and the default random seed are unchanged. Restart still reuses a pinned seed.

Tests (`tests/match/controller.test.js`): the refusal case now also covers -1, "-5", 4294967296, "4294967296", 2**32+60 and "-0x1". The restart case now pins 4294967295 (valid maximum) and checks seeds "0" and 60. The earlier -5 case was removed because negative seeds are no longer valid.

Observed: `node --test tests/match/controller.test.js` passed 10 of 10. `npm test` exited 0. No browser build was run; the change touches no renderer or UI code.
