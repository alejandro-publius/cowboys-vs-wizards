// Play one clash using the production rules, with a pre-clash drift for the Captured Wraith.
import { CARDS } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { shiftDestinations, shiftTroop } from "../../src/game/lanes.js";
import { resolveClash, resultAfterClash, pendingDrift } from "../../src/game/clash.js";
import { legalActions } from "../../src/game/legal.js";
import { applyAction } from "../../src/game/actions.js";
import { createHunt, HUNTS_BY_ID } from "../../src/game/bounty-hunt.js";

const WRAITH = "cowboy-captured-wraith-1";
const WRAITH_LANE = 1;
const BOSS = "wizard-lantern-wraith-1";
const DEADEYE_TARGET = 2; // lane 3, the marked lane in Blacksmith Forge
const troop = (cardId) => ({ cardId, health: CARDS[cardId].health });

const POSITIONS = {
  gallows: {
    goal: "Learn the move: the Lantern Wraith is marked to drift into lane 1. Your Base has 2 orbs.",
  },
  blacksmith: {
    goal: "Catch the Wraith by clearing its destination. It is marked to drift into lane 3, where a 1-orb Skeleton stands across from Billy. Your Base has 2 orbs.",
  },
  raid: {
    goal: "The Wizard's Base is down to 2 orbs.",
    cowboyBase: 5,
    wizardBase: 2,
  },
  lastStand: {
    goal: "Your Base has one orb left.",
    cowboyBase: 1,
    wizardBase: 5,
  },
  splitTrail: {
    goal: "Your Wraith can hold or drift into either open lane. Your Base has 5 orbs; the Wizard's Base has 2.",
    cowboyBase: 5,
    wizardBase: 2,
  },
  rematch: {
    goal: "Two clashes, one drift for both. Both Bases have 3 orbs. After clash 2 the higher Base wins; equal Bases are a draw.",
  },
};

// Split Trail leaves both lanes next to the Wraith available.
function setup(position) {
  if (position === "rematch") return rematchSetup();
  if (position === "gallows") return createHunt(HUNTS_BY_ID.get("gallows-lantern"));
  if (position === "blacksmith") return createHunt(HUNTS_BY_ID.get("blacksmith-forge"));
  const { cowboyBase, wizardBase } = POSITIONS[position];
  const state = createMatch(0);
  state.round = 5;
  state.sides.cowboy.baseOrbs = cowboyBase;
  state.sides.wizard.baseOrbs = wizardBase;
  state.sides.cowboy.board = position === "splitTrail"
    ? [null, troop(WRAITH), null]
    : [null, troop(WRAITH), troop("cowboy-billy-1")];
  state.sides.wizard.board = [null, troop("wizard-skeleton-1"), troop("wizard-wizard-1")];
  return state;
}

// Plays one clash. choice: "hold" or "drift". Returns the new state, events, result.
function play(position, choice) {
  let state = setup(position);
  const events = [];
  if (position === "gallows") {
    if (choice === "drift") {
      const ride = legalActions(state, "cowboy").find((a) => a.type === "ride-out" && a.slot === 1 && a.destination === 0);
      const applied = applyAction(state, ride);
      if (!applied.ok) throw new Error(`Ride Out rejected: ${applied.reason}`);
      state = applied.state;
      events.push(...applied.events);
    }
    resolveClash(state, (event) => events.push(event));
    return { state, events, result: resultAfterClash(state) };
  }
  if (position === "blacksmith") {
    if (choice === "deadeye") {
      const cast = legalActions(state, "cowboy").find((a) => a.type === "spell" && CARDS[a.cardId].name === "Deadeye" && a.target === DEADEYE_TARGET && a.destination == null);
      if (!cast) throw new Error("No legal Deadeye on lane 3");
      const applied = applyAction(state, cast);
      if (!applied.ok) throw new Error(`Deadeye rejected: ${applied.reason}`);
      state = applied.state;
      events.push(...applied.events);
    }
    resolveClash(state, (event) => events.push(event));
    return { state, events, result: resultAfterClash(state) };
  }
  if (choice === "drift" || choice.startsWith("drift:")) {
    const destination = choice === "drift" ? shiftDestinations(state.sides.cowboy.board, WRAITH_LANE)[0] : Number(choice.slice(6));
    if (!shiftDestinations(state.sides.cowboy.board, WRAITH_LANE).includes(destination)) throw new Error(`Illegal drift to lane ${destination + 1}`);
    shiftTroop(state.sides.cowboy.board, WRAITH_LANE, destination);
    events.push({ type: "drift", destination });
  }
  resolveClash(state, (event) => events.push(event));
  return { state, events, result: resultAfterClash(state) };
}

const who = (side) => (side === "cowboy" ? "Your" : "Enemy");
const name = (cardId) => CARDS[cardId].name;

// Rematch: rounds 8 and 9 of a real match, so the production clash and the
// round-limit result decide it. The drift is the prototype power from above.
// Cowboy: Sheriff (lane 1), Wraith (lane 2). Wizard: Skeleton in lanes 1 and 2,
// one Skeleton in hand. Both Bases 3. The Wizard has already acted in round 8.
function rematchSetup() {
  const state = createMatch(0);
  state.round = 8;
  state.startingSide = "wizard";
  state.activeSide = "cowboy";
  const { cowboy, wizard } = state.sides;
  cowboy.baseOrbs = wizard.baseOrbs = 3;
  cowboy.hand = []; cowboy.deck = [];
  wizard.hand = ["wizard-skeleton-3"]; wizard.deck = [];
  cowboy.board = [troop("cowboy-sheriff-1"), troop(WRAITH), null];
  wizard.board = [troop("wizard-skeleton-1"), troop("wizard-skeleton-2"), null];
  return state;
}

// The Rival's reply policy, stated on the page: if one of your troops faces an
// open Wizard lane, summon the Skeleton there (strongest attacker first);
// otherwise keep it in hand. Returns a legal summon action or null.
function rivalReply(state) {
  const { cowboy, wizard } = state.sides;
  const open = [0, 1, 2].filter((i) => cowboy.board[i] && !wizard.board[i])
    .sort((a, b) => CARDS[cowboy.board[b].cardId].attack - CARDS[cowboy.board[a].cardId].attack);
  if (!open.length) return null;
  return legalActions(state, "wizard").find((a) => a.type === "summon" && a.slot === open[0] && a.tributes.length === 0) ?? null;
}

// Replays the rematch from the fixture. picks: up to two of "hold" | "drift".
// The drift can be used once; a second "drift" is refused.
function runRematch(picks) {
  let state = rematchSetup();
  const out = { stage: "first", clashes: [], reply: null, drifted: false, state, result: null };
  const apply = (action) => {
    const r = applyAction(state, action);
    if (!r.ok) throw new Error(`${action.type} rejected: ${r.reason}`);
    state = r.state;
    return r.events;
  };
  const end = (side) => apply({ type: "end-phase", side, revision: state.revision });
  const clash = (pick, side) => {
    const events = [];
    if (pick === "drift") {
      if (out.drifted) throw new Error("The drift is already spent");
      const board = state.sides.cowboy.board;
      const slot = board.findIndex((t) => t?.cardId === WRAITH);
      const to = shiftDestinations(board, slot)[0];
      if (to === undefined) throw new Error("No open lane to drift into");
      shiftTroop(board, slot, to);
      events.push({ type: "drift", destination: to });
      out.drifted = true;
    }
    events.push(...end(side));
    out.clashes.push({ events, cowboyBase: state.sides.cowboy.baseOrbs, wizardBase: state.sides.wizard.baseOrbs });
  };
  const finish = () => { out.state = state; return out; };
  if (picks.length < 1) return finish();
  clash(picks[0], "cowboy"); // round 8 ends with the Cowboy phase
  end("cowboy"); // round 9: you pass, the Wizard replies
  const reply = rivalReply(state);
  out.reply = reply ? { events: apply(reply), lane: reply.slot } : { events: [], lane: null };
  out.stage = "second";
  if (picks.length < 2) return finish();
  clash(picks[1], "wizard"); // the Wizard's end runs clash 2
  out.stage = "done";
  out.result = state.result;
  return finish();
}

const REMATCH_PLANS = [
  { picks: ["drift", "hold"], label: "drift at once" },
  { picks: ["hold", "drift"], label: "hold, then drift after the reply" },
  { picks: ["hold", "hold"], label: "never drift" },
];

function rematchVerdict(run) {
  const { cowboy, wizard } = run.state.sides;
  const score = `Bases ${cowboy.baseOrbs} to ${wizard.baseOrbs}`;
  const r = run.result;
  if (!r || r.winner === null) return { cls: "", text: `Draw: ${score}. Neither side is ahead.` };
  const how = r.reason === "base-destroyed" ? "a Base is destroyed" : "the round limit";
  return r.winner === "cowboy"
    ? { cls: "win", text: `You win at ${how}: ${score}.` }
    : { cls: "lose", text: `You lose at ${how}: ${score}.` };
}

function rematchWhy(picks) {
  if (picks[0] === "drift") return "The Wraith hit the Wizard's Base at once, but lane 2 stood open for both clashes, so a Skeleton hit your Base twice. The Rival then blocked lane 3 and the Wraith never hit a Base again.";
  if (picks[1] === "drift") return "Clash 1 was blocked everywhere. No lane of yours faced an open lane, so the Rival kept its Skeleton and left lane 3 open. The drift landed unanswered and lane 2 stood open for only one clash.";
  return "Nothing reached a Base: every lane stayed blocked, and the Wraith and the Skeleton in lane 2 defeated each other.";
}

function describe(events) {
  return events.flatMap((e) => {
    if (e.type === "ride-out") return [e.side === "wizard" ? `The Lantern Wraith drifted to lane ${e.destination + 1}.` : `Billy rode to lane ${e.destination + 1}.`];
    if (e.type === "spell") return [`${e.spell} hit the Enemy ${name(e.target.cardId)} in lane ${e.target.slot + 1}, ${e.before} to ${e.after}.`];
    if (e.type === "drift") return [`Captured Wraith drifted to lane ${e.destination + 1}.`];
    if (e.type === "summon") return [`${who(e.side)} ${name(e.cardId)} was summoned into lane ${e.slot + 1}.`];
    if (e.type === "damage") {
      const hitter = `${who(e.attacker.side)} ${name(e.attacker.cardId)}`;
      const target = e.target.kind === "base" ? `${who(e.target.side)} Base` : `${who(e.target.side)} ${name(e.target.cardId)}`;
      return [`Lane ${e.lane + 1}: ${hitter} hit ${target}, ${e.before} to ${e.after}.`];
    }
    if (e.type === "defeat") return [`${who(e.side)} ${name(e.cardId)} was defeated.`];
    return [];
  });
}

function verdict(result) {
  if (!result) return { cls: "", text: "Both Bases survived the clash." };
  if (result.winner === "cowboy") return { cls: "win", text: "You win: the Wizard's Base is destroyed." };
  if (result.winner === "wizard") return { cls: "lose", text: "You lose: your Base is destroyed." };
  return { cls: "", text: "Draw: both Bases are destroyed." };
}

function huntVerdict(state, result) {
  if (result?.reason === "bounty-captured") return { cls: "win", text: "Captured: the Lantern Wraith is defeated." };
  if (state.sides.cowboy.baseOrbs === 0) return { cls: "lose", text: "You lose: your Base is destroyed." };
  if (result) return { cls: "lose", text: "The Wraith escaped." };
  return { cls: "", text: "The Wraith survived the clash." };
}

// Split Trail copy comes from the clash events, so it states what happened.
function splitWhy(events) {
  const lines = [];
  for (const e of events) {
    if (e.type === "damage" && e.target.kind === "base") lines.push(`${who(e.target.side)} Base took ${e.amount} in lane ${e.lane + 1}.`);
    if (e.type === "damage" && e.target.kind === "troop") lines.push(`${who(e.target.side)} ${name(e.target.cardId)} absorbed the hit in lane ${e.lane + 1}.`);
  }
  return lines.join(" ") || "No Base was hit.";
}

function why(position, choice, events) {
  if (position === "splitTrail") return splitWhy(events);
  if (position === "blacksmith") {
    const drifted = events.some((e) => e.type === "ride-out" && e.drift);
    const caught = events.some((e) => e.type === "defeat" && e.side === "wizard" && e.cardId === BOSS);
    if (choice === "hold") return "The Skeleton occupied marked lane 3, so the drift was blocked. The Wraith stayed in lane 2 and, with no one across from it, hit your Base.";
    if (!drifted) return "Deadeye did not open lane 3 for the drift.";
    return caught
      ? "Deadeye cleared the Skeleton from lane 3, so the Wraith drifted in and fought Billy there. Billy's attack finished it."
      : "Deadeye cleared lane 3 and the Wraith drifted in against Billy, but it survived the clash.";
  }
  if (position === "gallows") {
    return choice === "drift"
      ? "Billy was already in lane 1 when the Wraith drifted in, so they fought each other there."
      : "Lane 1 was empty, so the Wraith drifted in and faced your Base instead of Billy.";
  }
  if (position === "raid") {
    return choice === "drift"
      ? "Drifting put the Wraith's 2 attack on an undefended Base, but the Skeleton, now unblocked, hit your Base."
      : "Holding kept the Wraith blocked by the Skeleton, so the Wizard's Base took nothing and the raid stalled.";
  }
  return choice === "drift"
    ? "Drifting left the Skeleton's lane open, and it hit your last orb. Your Wraith's hit on the Wizard's Base did not matter."
    : "Holding kept the Wraith in front of the Skeleton, which absorbed the hit, so your last orb survived.";
}

const $ = (id) => document.getElementById(id);
let position = "gallows";
let played = null; // choice already made this round
let picks = []; // Rematch choices so far, one per clash

function renderRematch() {
  const run = runRematch(picks);
  renderBoard(run.state);
  const spent = run.drifted;
  const dest = run.stage === "done" ? undefined : shiftDestinations(run.state.sides.cowboy.board, run.state.sides.cowboy.board.findIndex((t) => t?.cardId === WRAITH))[0];
  $("goal").textContent = POSITIONS.rematch.goal;
  $("blurb").textContent = "You captured the Lantern Wraith. You get one drift for the whole rematch, and two clashes to use it in.";
  $("reset").textContent = "Restart rematch";
  $("drift2").hidden = true;
  $("hold").textContent = run.stage === "second" && spent ? "Continue to clash 2 (drift spent)" : run.stage === "first" ? "Hold: Wraith stays in lane 2" : "Hold: Wraith stays put";
  $("drift").textContent = run.stage === "second" && spent ? "Drift (spent)" : dest === undefined ? "Drift (no open lane)" : `Drift to lane ${dest + 1}`;
  $("hold").disabled = run.stage === "done";
  $("drift").disabled = run.stage === "done" || spent || dest === undefined;
  for (const b of document.querySelectorAll("[data-position]")) b.setAttribute("aria-pressed", String(b.dataset.position === position));
  const base = (side) => run.state.sides[side].baseOrbs;
  const clashHtml = run.clashes.map((c, i) => `<p><b>Clash ${i + 1} of 2</b>: ${picks[i] === "drift" ? "you drifted" : "you held"}.</p>
    <ul>${describe(c.events).map((line) => `<li>${line}</li>`).join("")}</ul>
    <p>Bases after clash ${i + 1}: yours ${c.cowboyBase}, Wizard's ${c.wizardBase}.</p>`);
  const replyHtml = run.reply
    ? `<p><b>Rival reply:</b> ${run.reply.lane === null
      ? "No troop of yours faced an open lane, so the Wizard kept its Skeleton and passed."
      : `Your Wraith faced open lane ${run.reply.lane + 1}, so the Wizard summoned a Skeleton there.`}</p>`
    : "";
  const status = `Clash ${Math.min(picks.length + 1, 2)} of 2 · Drift: ${spent ? "spent" : "saved"} · Bases: yours ${base("cowboy")}, Wizard's ${base("wizard")}`;
  if (run.stage === "done") {
    const v = rematchVerdict(run);
    const others = REMATCH_PLANS.filter((p) => p.picks.join() !== picks.join())
      .map((p) => `<p><b>Other line (${p.label}):</b> ${rematchVerdict(runRematch(p.picks)).text}</p>`).join("");
    $("outcome").innerHTML = `<strong class="${v.cls}">${v.text}</strong>${clashHtml.join("")}${replyHtml}
      <p><b>Why:</b> ${rematchWhy(picks)}</p>${others}
      <p><button type="button" data-goto="rematch">Restart rematch</button></p>`;
    return;
  }
  if (run.stage === "first") {
    $("outcome").innerHTML = `<p class="status">${status}</p>
      <p>Round 8 of 9. The Wizard has committed. Lane 3 is empty on both sides. The drift happens before attacks, and you can use it only once.</p>
      <p>The Rival answers a troop that faces an open lane by summoning its Skeleton there. Otherwise it passes.</p>`;
    return;
  }
  $("outcome").innerHTML = `<p class="status">${status}</p>${clashHtml.join("")}${replyHtml}
    <p>Round 9 of 9, the last clash. ${spent ? "The drift is spent, so only holding is left." : "Drift now, or hold and take the Bases as they stand."}</p>`;
}

function orbs(now, max) {
  return `<span class="orbs" role="img" aria-label="${now} of ${max} orbs">${"●".repeat(now)}<span class="lost">${"○".repeat(Math.max(0, max - now))}</span></span>`;
}

function cardHtml(side, t, mark) {
  if (!t) return `<div class="empty">empty</div>`;
  const card = CARDS[t.cardId];
  return `<div class="card ${side}${mark ? " mark" : ""}"><b>${card.name}</b><br>ATK ${card.attack}<br>${orbs(t.health, card.health)}</div>`;
}

function renderBoard(state) {
  const mark = position === "gallows" ? pendingDrift(state)?.destination : position === "blacksmith" ? state.bountyDrift.destination : -1;
  const lane = (side, i) => `<div class="lane${side === "wizard" && i === mark ? " marked" : ""}">${cardHtml(side, state.sides[side].board[i], side === "cowboy" && state.sides[side].board[i]?.cardId === WRAITH)}</div>`;
  const base = (side, label) => `<div class="base ${side}">${label} Base ${orbs(state.sides[side].baseOrbs, 5)}</div>`;
  const row = (side) => [0, 1, 2].map((i) => lane(side, i)).join("");
  const labels = [1, 2, 3].map((i) => `<div class="lane-heading">Lane ${i}${i - 1 === mark ? " (marked)" : ""}</div>`).join("");
  $("board").innerHTML = base("wizard", "Wizard") + labels + row("wizard") + row("cowboy") + base("cowboy", "Your");
}

function render() {
  played = null;
  picks = [];
  if (position === "rematch") return renderRematch();
  $("reset").textContent = "Reset";
  const state = setup(position);
  renderBoard(state);
  $("goal").textContent = POSITIONS[position].goal;
  const gallows = position === "gallows";
  const blacksmith = position === "blacksmith";
  $("blurb").textContent = gallows
    ? "Learn the Lantern Wraith's move by fighting it."
    : blacksmith
      ? "Learn a second way to catch the Lantern Wraith: clear the lane it wants to drift into."
      : "You captured the Lantern Wraith. Its drift is a one-clash prototype power here.";
  const split = position === "splitTrail";
  const dests = gallows || blacksmith ? [] : shiftDestinations(state.sides.cowboy.board, WRAITH_LANE);
  $("hold").textContent = blacksmith ? "Hold" : "Hold lane";
  $("drift").textContent = gallows
    ? "Ride Billy to lane 1"
    : blacksmith ? "Deadeye the Skeleton in lane 3" : `Drift to lane ${dests[0] + 1}`;
  $("drift2").hidden = !split;
  if (split) $("drift2").textContent = `Drift to lane ${dests[1] + 1}`;
  $("hold").disabled = $("drift").disabled = $("drift2").disabled = false;
  $("outcome").innerHTML = gallows
    ? "Before the first clash, the Wraith drifts into marked lane 1 if that lane is empty. Then everything attacks."
    : blacksmith
      ? "Before the first clash, the Wraith drifts into marked lane 3 if that lane is empty. Then everything attacks."
      : "The Wizard has committed. The drift happens before attacks.";
  for (const b of document.querySelectorAll("[data-position]")) b.setAttribute("aria-pressed", String(b.dataset.position === position));
  played = null;
}

function choose(choice) {
  if (played) return;
  played = choice;
  const { state, events, result } = play(position, choice);
  renderBoard(state);
  $("hold").disabled = $("drift").disabled = $("drift2").disabled = true;
  const gallows = position === "gallows";
  const hunt = gallows || position === "blacksmith";
  const choiceName = (c) => (c === "hold" ? (hunt && !gallows ? "hold" : "hold lane") : c === "deadeye" ? "Deadeye the Skeleton in lane 3" : c === "drift" ? (gallows ? "ride Billy to lane 1" : "drift") : `drift to lane ${Number(c.slice(6)) + 1}`);
  const verdictOf = (r) => (hunt ? huntVerdict(r.state, r.result) : verdict(r.result));
  const options = position === "splitTrail" ? ["hold", "drift:0", "drift:2"] : position === "blacksmith" ? ["hold", "deadeye"] : ["hold", "drift"];
  const v = verdictOf({ state, result });
  const others = options.filter((c) => c !== choice)
    .map((c) => `<p><b>Other choice (${choiceName(c)}):</b> ${verdictOf(play(position, c)).text}</p>`).join("");
  const next = hunt && result?.reason === "bounty-captured"
    ? `<p><button type="button" data-goto="raid">Use the captured Wraith</button></p>`
    : position === "raid" ? `<p><button type="button" data-goto="lastStand">Optional: try Last stand</button></p>` : position === "lastStand" ? `<p><button type="button" data-goto="rematch">Optional: play the two-clash Rematch</button></p>` : "";
  $("outcome").innerHTML = `<strong class="${v.cls}">${v.text}</strong>
    <ul>${describe(events).map((line) => `<li>${line}</li>`).join("")}</ul>
    <p><b>Why:</b> ${why(position, choice, events)}</p>
    ${others}${next}`;
}

function pick(choice) {
  if (picks.length >= 2) return;
  picks.push(choice);
  renderRematch();
}

for (const b of document.querySelectorAll("[data-position]")) {
  b.addEventListener("click", () => { position = b.dataset.position; render(); });
}
$("outcome").addEventListener("click", (e) => {
  const go = e.target.closest("[data-goto]");
  if (go) { position = go.dataset.goto; render(); }
});
$("hold").addEventListener("click", () => (position === "rematch" ? pick("hold") : choose("hold")));
$("drift").addEventListener("click", () => {
  if (position === "rematch") return pick("drift");
  choose(position === "blacksmith" ? "deadeye" : position === "splitTrail" ? `drift:${shiftDestinations(setup(position).sides.cowboy.board, WRAITH_LANE)[0]}` : "drift");
});
$("drift2").addEventListener("click", () => choose(`drift:${shiftDestinations(setup(position).sides.cowboy.board, WRAITH_LANE)[1]}`));
$("reset").addEventListener("click", render);
render();
