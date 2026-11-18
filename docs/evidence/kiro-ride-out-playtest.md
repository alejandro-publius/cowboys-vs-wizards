# Ride Out one-decision playtest page

An offline page that asks a player to make the one Cowboy decision where the
Ride Out experiment (`.kiro/specs/ride-out`) changes a Normal CPU match.

## Reproduce

```sh
node scripts/build-ride-out-playtest.mjs
```

This writes `.artifacts/card-rd/ride-out-playtest/index.html`, which is not
committed. Built with Node v26.0.0 on top of `a5f3e0a`: 8832 bytes, sha256
`f29f6b983b0b4e4f6f5919cf926dc236fc8879273719049b81867150aaa5199a`.

## What the builder asserts

Seed 61007, shipped opening, Wizard first, Normal CPU on both sides, played
once with ordinary rules and once with `{ rideOut: true }`. The build fails
unless:

- both matches share their first 27 actions and their sides at `log[26]`,
  where the Wizard has ended its round 7 phase;
- at `log[27]` the ordinary match summons Sheriff to slot 0 and casts Deadeye
  on slot 0, and the Ride Out match moves Mounted Billy from slot 1 to slot 2;
- the ordinary match is a Wizard win in round 8, with Bases Cowboy 1,
  Wizard 3 after round 7;
- the Ride Out match is a draw in round 7, with Bases Cowboy 0, Wizard 0, and
  its round 7 clash damage events show the Wizards in the middle and left
  lanes hitting the Cowboy Base while Mounted Billy hits the Wizard Base from
  the right lane.

The page shows the Cowboy's hand and both sides' lanes before the choice. Both
outcomes stay hidden until a line is chosen and the note ("What did you expect
to gain or give up with this choice?") is locked or skipped. The page inlines
`experiments/ride-out-playtest/page.css` and `page.js` and uses no network or
storage.

## Human result

Pending. Nobody has played the page yet, and its browser interaction has not
been checked.
