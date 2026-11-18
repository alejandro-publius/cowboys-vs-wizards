// Builds the offline one-decision Ride Out playtest page:
//   node scripts/build-ride-out-playtest.mjs
// Plays seed 61007 as a Normal CPU mirror (shipped opening, Wizard first)
// twice: ordinary rules and { rideOut: true }. The matches share their first
// 27 actions. At log[27] the Cowboy either summons Sheriff to slot 0 and casts
// Deadeye on slot 0, or rides Mounted Billy from slot 1 to slot 2. The script
// asserts that history and both results, then writes
// .artifacts/card-rd/ride-out-playtest/index.html with
// experiments/ride-out-playtest/page.css and page.js inlined. The page shows
// the Cowboy's hand and the lanes before the choice; page.js keeps both
// outcomes hidden until the choice is locked and the note is locked or skipped.
// The Ride Out outcome explains the draw from its round 7 clash events.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { playMatch } from "./play-match.mjs";
import { openingMatch } from "../src/game/opening-policy.js";
import { chooseAction } from "../src/game/cpu.js";
import { CARDS } from "../src/game/cards.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = path.join(ROOT, "experiments/ride-out-playtest");
const OUT = path.join(ROOT, ".artifacts/card-rd/ride-out-playtest/index.html");
const SEED = 61007;
const FIRST = "wizard";
const SHARED = 27; // log[0..26] are shared; log[27] is the Cowboy's decision
const LANES = ["Left", "Middle", "Right"]; // slots 0, 1, 2
const SIDE_NAME = { cowboy: "Cowboy", wizard: "Wizard" };

const normal = { cowboy: chooseAction, wizard: chooseAction };
const ordinary = playMatch(SEED, normal, openingMatch(SEED, "shipped", FIRST));
const rideOut = playMatch(SEED, normal, openingMatch(SEED, "shipped", FIRST, { rideOut: true }));

const name = (cardId) => CARDS[cardId].name;
const esc = (text) => String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
const baseOrbs = (sides) => ({ cowboy: sides.cowboy.baseOrbs, wizard: sides.wizard.baseOrbs });

// The shared history and the board the Cowboy decides on.
const history = (match) => match.log.slice(0, SHARED).map(({ action }) => action);
assert.deepEqual(history(rideOut), history(ordinary), "the first 27 actions differ");
const last = ordinary.log[SHARED - 1];
assert.deepEqual(rideOut.log[SHARED - 1].state.sides, last.state.sides, "sides differ at log[26]");
assert.deepEqual([last.round, last.side, last.action.type], [7, "wizard", "end-phase"], "log[26] is not the Wizard ending round 7");
const before = last.state;
for (const side of ["cowboy", "wizard"]) assert.equal(before.sides[side].board.length, LANES.length, `${side} lanes`);

// The Cowboy's round 7 phase in each line, from log[27] through its end-phase.
function phase(match) {
  const rest = match.log.slice(SHARED);
  return rest.slice(0, rest.findIndex(({ action }) => action.type === "end-phase") + 1);
}
function said({ round, side, action }) {
  const what =
    action.type === "summon" ? `summon ${name(action.cardId)} to slot ${action.slot}, tributes [${action.tributes}]`
    : action.type === "spell" ? `cast ${name(action.cardId)} on slot ${action.target}`
    : action.type === "ride-out" ? `ride out slot ${action.slot} to slot ${action.destination}`
    : action.type;
  return `round ${round} ${side}: ${what}`;
}
assert.deepEqual(phase(ordinary).map(said), [
  "round 7 cowboy: summon Sheriff to slot 0, tributes []",
  "round 7 cowboy: cast Deadeye on slot 0",
  "round 7 cowboy: end-phase",
]);
assert.deepEqual(phase(rideOut).map(said), [
  "round 7 cowboy: ride out slot 1 to slot 2",
  "round 7 cowboy: end-phase",
]);
assert.equal(name(before.sides.cowboy.board[1].cardId), "Mounted Billy");

// The actual results, and the Base totals after the round 7 clash (the state
// after the round's last action).
assert.deepEqual(ordinary.state.result, { winner: "wizard", loser: "cowboy", reason: "base-destroyed", round: 8 });
assert.deepEqual(rideOut.state.result, { winner: null, loser: null, reason: "base-destroyed", round: 7 });
const basesAfter = (match, round) => baseOrbs(match.log.findLast((entry) => entry.round === round).state.sides);
assert.deepEqual(basesAfter(ordinary, 7), { cowboy: 1, wizard: 3 }, "ordinary round 7 Bases");
assert.deepEqual(basesAfter(rideOut, 7), { cowboy: 0, wizard: 0 }, "Ride Out round 7 Bases");

// Page text, from the engine's events for each line's moves.
const [summon, spell] = phase(ordinary).map(({ events }) => events[0]);
const [ride] = phase(rideOut).map(({ events }) => events[0]);
const lane = (slot) => LANES[slot].toLowerCase();

// Why the Ride Out line is a draw, from its round 7 clash damage events: both
// Wizards hit the Cowboy Base, from the lane Mounted Billy left and from the
// open left lane, while Billy hits the Wizard Base.
const clash = phase(rideOut).flatMap(({ events }) => events).filter(({ type }) => type === "damage");
const baseHit = (slot, side) => clash.find((hit) => hit.lane === slot && hit.target.kind === "base" && hit.target.side === side);
const hitBy = (hit) => (hit ? CARDS[hit.attacker.cardId] : undefined);
const middleHit = baseHit(ride.slot, "cowboy");
const leftHit = baseHit(0, "cowboy");
const billyHit = baseHit(ride.destination, "wizard");
assert.equal(hitBy(middleHit)?.side, "wizard", "no Wizard troop hits the Cowboy Base from the lane Mounted Billy left");
assert.equal(hitBy(leftHit)?.side, "wizard", "no Wizard troop hits the Cowboy Base from the left lane");
assert.equal(hitBy(billyHit)?.id, ride.cardId, "Mounted Billy does not hit the Wizard Base");
const rideOutClash =
  `In the round ${before.round} clash, ${name(ride.cardId)} has left the ${lane(middleHit.lane)} lane unguarded, ` +
  `so the ${hitBy(middleHit).name} there hits your Base. ` +
  `The ${hitBy(leftHit).name} in the ${lane(leftHit.lane)} lane also has an open lane and hits your Base. ` +
  `${hitBy(billyHit).name} hits the Wizard Base from the ${lane(billyHit.lane)} lane as your Base falls.`;

const lines = [
  {
    id: "ordinary",
    title: `${name(summon.cardId)}, then ${name(spell.cardId)}`,
    moves:
      `Summon ${name(summon.cardId)} to the ${lane(summon.slot)} lane. ` +
      `Cast ${name(spell.cardId)} on the ${name(spell.target.cardId)} in the ${lane(spell.target.slot)} lane ` +
      `(health ${spell.before} to ${spell.after}). End your phase.`,
    match: ordinary,
  },
  {
    id: "ride-out",
    title: `Ride Out with ${name(ride.cardId)}`,
    moves:
      `Spend your summon to move ${name(ride.cardId)} from the ${lane(ride.slot)} lane to the ${lane(ride.destination)} lane. ` +
      `It keeps its ${ride.health} health. Cast no spell. End your phase.`,
    clash: rideOutClash,
    match: rideOut,
  },
];

const bases = ({ cowboy, wizard }) => `Cowboy ${cowboy}, Wizard ${wizard}`;
const resultText = ({ winner, round }) =>
  winner ? `The ${SIDE_NAME[winner]} wins in round ${round}.` : `Draw in round ${round}: both Bases are destroyed.`;
function troopCell(troop) {
  if (!troop) return `<td class="empty">Empty</td>`;
  const card = CARDS[troop.cardId];
  return `<td>${esc(card.name)}<span class="stats">Attack ${card.attack}, health ${troop.health} of ${card.health}</span></td>`;
}
const laneRow = (side, label) => `<tr><th scope="row">${label}</th>${before.sides[side].board.map(troopCell).join("")}</tr>`;
function handItem(cardId) {
  const card = CARDS[cardId];
  const about = card.kind === "troop" ? `troop, ${card.stars} stars, attack ${card.attack}, health ${card.health}` : card.kind;
  return `<li>${esc(card.name)}: ${esc(about)}</li>`;
}
const choice = (line) =>
  `<button type="button" data-line="${line.id}" data-title="${esc(line.title)}" aria-pressed="false">` +
  `<span class="line-title">${esc(line.title)}</span>${esc(line.moves)}</button>`;
const outcome = (line) => `<article data-line="${line.id}" aria-labelledby="line-${line.id}">
<h3 id="line-${line.id}"><span class="role"></span>${esc(line.title)}</h3>
<p class="bases">Bases after the round ${before.round} clash: ${bases(basesAfter(line.match, before.round))}</p>
${line.clash ? `<p>${esc(line.clash)}</p>\n` : ""}<p>${esc(resultText(line.match.state.result))}</p>
</article>`;

const css = readFileSync(path.join(PAGE, "page.css"), "utf8");
const js = readFileSync(path.join(PAGE, "page.js"), "utf8");
assert.doesNotMatch(css, /<\/style/i, "page.css cannot be inlined");
assert.doesNotMatch(js, /<\/script|<!--/i, "page.js cannot be inlined");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ride Out playtest: one decision</title>
<style>
${css}</style>
</head>
<body>
<main>
<h1>Ride Out playtest: one decision</h1>
<p>You play the Cowboy. Until now, both sides were played by the Normal CPU. Choose the line you would play. Both outcomes stay hidden until your choice is locked.</p>

<section aria-labelledby="board-heading">
<h2 id="board-heading" tabindex="-1">Round ${before.round}: your phase</h2>
<p>The Wizard has ended its round ${before.round} phase. The clash comes after yours.</p>
<p class="bases">Bases: ${bases(baseOrbs(before.sides))}</p>
<table>
<caption>Lanes</caption>
<thead><tr><th scope="col">Side</th>${LANES.map((label) => `<th scope="col">${label}</th>`).join("")}</tr></thead>
<tbody>
${laneRow("wizard", "Wizard (CPU)")}
${laneRow("cowboy", "Cowboy (you)")}
</tbody>
</table>
<h3>Your hand</h3>
<ul>
${before.sides.cowboy.hand.map(handItem).join("\n")}
</ul>
</section>

<section aria-labelledby="choice-heading">
<h2 id="choice-heading">Choose your line</h2>
<p class="hint">Pressing a line locks it.</p>
${lines.map(choice).join("\n")}
</section>

<section id="locked" aria-labelledby="locked-heading" hidden>
<h2 id="locked-heading" tabindex="-1">Choice locked</h2>
<p>Your line: <strong id="locked-line"></strong>. Time to decide: <span id="locked-time"></span> seconds.</p>
<div id="note-field">
<label for="note">What did you expect to gain or give up with this choice?</label>
<textarea id="note" rows="4"></textarea>
</div>
<p id="note-status" class="hint"></p>
<button type="button" id="reveal">Lock note and show outcomes</button>
<button type="button" id="skip">Show outcomes without a note</button>
</section>

<section id="outcome" aria-labelledby="outcome-heading" hidden>
<h2 id="outcome-heading" tabindex="-1">Outcomes</h2>
<p>After the Cowboy's round ${before.round} phase, both sides are the Normal CPU to the end of the match.</p>
<div id="lines">
${lines.map(outcome).join("\n")}
</div>
<button type="button" id="reset">Start over</button>
</section>

<footer>Seed ${SEED}, shipped opening, Wizard first, Normal CPU on both sides. Built offline by <code>node scripts/build-ride-out-playtest.mjs</code>. Nothing on this page is saved or sent.</footer>
</main>
<script>
${js}</script>
</body>
</html>
`;

// Every element page.js looks up by id is on the page.
for (const [, id] of js.matchAll(/byId\("([\w-]+)"\)/g)) assert.ok(html.includes(` id="${id}"`), `page.js needs #${id}`);

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
const sha256 = createHash("sha256").update(html).digest("hex");
console.log(`${path.relative(ROOT, OUT)}: ${Buffer.byteLength(html)} bytes, sha256 ${sha256}`);
for (const line of lines) {
  console.log(`${line.title}: Bases after round 7 ${bases(basesAfter(line.match, 7))}; ${resultText(line.match.state.result)}`);
}
