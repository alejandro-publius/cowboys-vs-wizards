// Seat audit detail in the Sheriff's Ledger. Every fixture here is synthetic and test-only; none is a measured result.
import test from "node:test";
import assert from "node:assert/strict";
import {BILLY_REPLAY as R} from "../../src/ui/billy-replay.data.js";
import {RULE_GATE, RULE_SOURCE, SEAT_REPRODUCE, billyReplayHtml, firstPlayerShares, seatAuditHtml, seatAuditOk, seatObservation, seatRows}
  from "../../src/ui/billy-replay.js";

const cells = (cowboy, wizard, draw) => ({cowboy, wizard, draw});
// 10 synthetic deals. Transitions read baseline winner, then candidate winner.
const synthetic = () => ({
  schema: 1, protocolSha256: "synthetic-protocol", sourceCommit: "<i>synthetic</i>", firstSeed: 1, deals: 10, totalDuels: 40,
  byFirst: {
    cowboy: {gamesPerArm: 10, baseline: cells(7, 3, 0), candidate: cells(5, 4, 1),
      transitions: {cowboy: cells(5, 1, 1), wizard: cells(0, 3, 0), draw: cells(0, 0, 0)}},
    wizard: {gamesPerArm: 10, baseline: cells(4, 6, 0), candidate: cells(3, 7, 0),
      transitions: {cowboy: cells(3, 1, 0), wizard: cells(0, 6, 0), draw: cells(0, 0, 0)}},
  },
  blocks: [{firstSeed: 1, deals: 10, baselineCowboyWins: 11, candidateCowboyWins: 8}],
  csvSha256: "synthetic-csv",
});
const empty = () => {
  const zero = () => cells(0, 0, 0);
  const side = () => ({gamesPerArm: 0, baseline: zero(), candidate: zero(), transitions: {cowboy: zero(), wizard: zero(), draw: zero()}});
  return {...synthetic(), deals: 0, totalDuels: 0, byFirst: {cowboy: side(), wizard: side()}, blocks: []};
};

test("rows give Cowboy win shares per opening faction from the raw counts", () => {
  const seat = synthetic();
  assert.ok(seatAuditOk(seat));
  assert.deepEqual(seatRows(seat).map((r) => [r.label, r.baseline.wins, r.baseline.games, r.candidate.wins, r.candidate.games, r.change]), [
    ["All starts", 11, 20, 8, 20, "−15.00 pts"],
    ["Cowboys open", 7, 10, 5, 10, "−20.00 pts"],
    ["Wizards open", 4, 10, 3, 10, "−10.00 pts"],
  ]);
  const first = firstPlayerShares(seat);
  assert.deepEqual([first.baseline.wins, first.candidate.wins, first.baseline.games, first.change], [13, 12, 20, "−5.00 pts"]);
  assert.equal(seatObservation(first, R),
    "The side that goes first wins 65.00% of games with Billy at attack 2 and 60.00% at attack 1, so going first still gives an edge.");
});

test("the takeaway names the favoured seat from the recorded shares", () => {
  const at = (before, now) => seatObservation({baseline: {share: before}, candidate: {share: now}}, R);
  assert.match(at(0.45, 0.55), /so going first now gives an edge\.$/);
  assert.match(at(0.45, 0.4), /so going second still gives an edge\.$/);
  assert.match(at(0.55, 0.5), /so neither seat has an edge\.$/);
  assert.equal(at(null, null), "No games are recorded yet.");
});

test("the detail renders a labelled table, the derived finding and the reproduce command", () => {
  const html = seatAuditHtml(synthetic(), R);
  assert.match(html, /<summary>Who wins when they go first\?<\/summary>/);
  assert.match(html, /<th scope="col">Attack 2<\/th><th scope="col">Attack 1<\/th>/);
  assert.match(html, /<th scope="row">All starts<\/th><td>55\.00%<\/td><td>40\.00%<\/td><td>−15\.00 pts<\/td>/);
  assert.match(html, /<th scope="row">Cowboys open<\/th><td>70\.00%<\/td><td>50\.00%<\/td>/);
  assert.match(html, /<th scope="row">Wizards open<\/th><td>40\.00%<\/td><td>30\.00%<\/td>/);
  assert.match(html, /<p class="sd-billy-seat-finding">The side that goes first wins 65\.00% of games with Billy at attack 2 and 60\.00% at attack 1, so going first still gives an edge\.<\/p>/);
  assert.equal(html.match(/65\.00%/g).length, 1, "the first-player share appears once");
  assert.match(html, /40 games from 10 deals/);
  assert.match(html, /20 paired comparisons/);
  assert.match(html, /Draws: 0 at attack 2, 1 at attack 1/);
  assert.match(html, /two level-2 bots with fixed decks/);
  assert.doesNotMatch(html, /not the balance of every card/);
  assert.ok(html.includes(`<code>${SEAT_REPRODUCE}</code>`));
  assert.match(html, /outcome hash <code>synthet<\/code>/);
  assert.doesNotMatch(html, /undefined/);
  assert.ok(!html.includes("<i>"), "data strings are escaped");
});

test("a nested disclosure names the written rule and both gate runs without stating a verdict", () => {
  const html = seatAuditHtml(synthetic(), R);
  const nested = html.slice(html.indexOf("<details", 1), html.indexOf("</details>") + 10);
  assert.match(nested, /^<details class="sd-note sd-billy-seat-verify"><summary>Check each version against the written rule<\/summary>/);
  assert.ok(nested.includes(`<code>${RULE_SOURCE}</code>`));
  for (const arm of ["baseline", "candidate"]) assert.ok(nested.includes(`<code>${RULE_GATE} ${arm}</code>`));
  assert.doesNotMatch(nested, /\b(passes|passed|rejected|fails)\b/i);
  assert.ok(html.indexOf(SEAT_REPRODUCE) < html.indexOf(RULE_GATE), "the full verification stays first");
});

test("hashes the result does not record are left out of the verify line", () => {
  const seat = synthetic();
  delete seat.csvSha256;
  seat.protocolSha256 = 42;
  const html = seatAuditHtml(seat, R);
  assert.doesNotMatch(html, /undefined|outcome hash|protocol hash/);
  assert.ok(html.includes(`<code>${SEAT_REPRODUCE}</code>`));
});

test("a totalDuels that disagrees with the counts shows no figures", () => {
  assert.equal(seatAuditOk({...synthetic(), totalDuels: 41}), false);
  assert.equal(seatAuditOk({...synthetic(), totalDuels: "40"}), false);
  const {totalDuels, ...without} = synthetic();
  assert.equal(totalDuels, 40);
  assert.ok(seatAuditOk(without));
});

test("no games shows dashes instead of dividing by zero", () => {
  const seat = empty();
  assert.ok(seatAuditOk(seat));
  for (const r of seatRows(seat)) assert.deepEqual([r.baseline.share, r.candidate.share, r.change], [null, null, "—"]);
  const html = seatAuditHtml(seat, R);
  assert.doesNotMatch(html, /NaN|Infinity/);
  assert.match(html, /<th scope="row">All starts<\/th><td>—<\/td><td>—<\/td><td>—<\/td>/);
  assert.match(html, /No games are recorded yet\./);
});

test("counts that are not whole numbers or do not add up show no figures", () => {
  const bad = synthetic();
  bad.byFirst.cowboy.baseline.cowboy = "<b>7</b>";
  const off = synthetic();
  off.byFirst.wizard.transitions.cowboy = cells(2, 2, 0);
  for (const seat of [bad, off, null, {...synthetic(), schema: 2}]) {
    assert.equal(seatAuditOk(seat), false);
    const html = seatAuditHtml(seat, R);
    assert.match(html, /do not add up, so no figures are shown/);
    assert.doesNotMatch(html, /<b>|<table/);
  }
});

test("the replay keeps its own 10,000-game text and the seat sample follows it", () => {
  const html = billyReplayHtml(R, synthetic());
  assert.match(html, /<h4[^>]*>Cowboy wins in the 10,000-game replay sample<\/h4>/);
  assert.match(html, /5,000 games per version, fixed decks and two level-2 bots/);
  assert.match(html, /Independent of the 10,000-game replay cohort above/);
  assert.ok(html.indexOf("How to verify this replay") < html.indexOf("Who wins when they go first?"));
  assert.match(html, /data-billy-line="baseline"/);
});
