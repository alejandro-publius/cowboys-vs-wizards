import {cardOf, typeOf} from "../game/showdown/cards.js";
import {BILLY_REPLAY} from "./billy-replay.data.js";

function finish(engine, state, level) {
  while (!state.result) state = engine.playTurn(state, level).state;
  return {winner: state.result.winner, turn: state.turn};
}

// After the proposed shot the Wizard brings out Headless Horseman. Both choices
// below are actions offered to that Billy by the pinned rules on the same next turn.
function nextBillyChoice(engine, state, level) {
  if (state.result || state.active !== "cowboy") return null;
  const slot = state.sides.cowboy.board.findIndex(troop => troop?.cardId === BILLY_REPLAY.attackerId);
  const target = state.sides.wizard.board.findIndex(troop => troop && typeOf(troop.cardId) === "wizard-headless-horseman");
  const legal = engine.legalActions(state);
  const attack = legal.find(a => a.type === "attack" && a.slot === slot && a.target === target);
  const cover = legal.find(a => a.type === "cover" && a.slot === slot);
  if (!attack || !cover) return null;
  const orbs = position => ({
    billy: position.sides.cowboy.board[slot]?.health ?? 0,
    horseman: position.sides.wizard.board[target]?.health ?? 0,
  });
  return {
    turn: state.turn,
    opponent: cardOf(state.sides.wizard.board[target].cardId).name,
    orbs: orbs(state),
    play(move) {
      const action = {attack, cover}[move];
      const next = engine.applyAction(state, action).state;
      return {...finish(engine, next, level), orbs: orbs(next)};
    },
  };
}

function ending({winner, turn}) {
  const outcome = winner === "cowboy" ? "the Cowboys won" : winner === "wizard" ? "the Wizards won" : "the duel ended in a draw";
  return `${outcome} on turn ${turn}.`;
}

// Both rules use the same pre-shot position. applyAction and playTurn return new states.
// The choices in the Saloon never enter the campaign or change the released card catalog.
export function takeBillyShot(table, line) {
  const engine = table[line];
  let {state, events} = engine.applyAction(table.shot.state, table.shot.action);
  const hit = events.find(event => event.type === "attack" && event.cardId === BILLY_REPLAY.attackerId && event.target === BILLY_REPLAY.targetId);
  if (!hit) throw new Error("The Saloon shot did not reach Bone Wall");
  let choice = null;
  if (line === "candidate") {
    // Finish the Cowboy turn and play the Wizard's reply before offering control.
    state = engine.playTurn(state, table.botLevel).state;
    if (!state.result) state = engine.playTurn(state, table.botLevel).state;
    choice = nextBillyChoice(engine, state, table.botLevel);
  }
  return {targetLeft: hit.targetLeft, ...finish(engine, state, table.botLevel), choice};
}

export function mountBillyTable(root, table) {
  if (!table) return;
  const {attackerId, baseline, candidate, targetOrbsBefore} = BILLY_REPLAY;
  const printed = cardOf(attackerId).attack === baseline.attack ? "Current" : "Recorded";
  root.hidden = false;
  root.innerHTML = `<h3 id="saloon-shot-title">Billy at Bone Wall</h3>
    <p class="saloon-sr-only">Fire for ${baseline.attack} at Bone Wall. Then try Kiro’s ${candidate.attack}-damage shot on the same deal.</p>
    <div class="saloon-shot-cards">
      <span data-shot-card="billy"><strong>Billy</strong></span>
      <span data-shot-card="wall"><strong>Bone Wall</strong><span class="saloon-life" aria-hidden="true"></span><span class="saloon-shot-orbs"></span></span>
    </div>
    <div class="saloon-shot-actions">
      <button type="button" data-shot="baseline" aria-pressed="false">Fire for ${baseline.attack} · ${printed}</button>
      <button type="button" data-shot="candidate" aria-pressed="false">Fire for ${candidate.attack} · Proposed</button>
    </div>
    <p class="saloon-shot-result" role="status" aria-live="polite" aria-atomic="true"></p>
    <section class="saloon-shot-reply" aria-labelledby="saloon-reply-title" hidden>
      <div class="saloon-horseman">
        <p class="saloon-reply-prompt"></p>
        <h4 id="saloon-reply-title"></h4>
        <p class="saloon-duel-orbs"></p>
      </div>
      <p class="saloon-sr-only">If Billy takes cover, a hit on him can’t spill over to your Base.</p>
      <div class="saloon-shot-actions">
        <button type="button" data-reply="attack" aria-pressed="false">Attack</button>
        <button type="button" data-reply="cover" aria-pressed="false" title="Cover keeps extra damage off your Base">Take cover</button>
      </div>
      <p class="saloon-reply-result" role="status" aria-live="polite" aria-atomic="true"></p>
    </section>
    <details class="saloon-bot-finish" hidden>
      <summary>How did the bots play this deal?</summary><p></p>
    </details>`;
  const wallCard = root.querySelector('[data-shot-card="wall"]');
  const tokens = root.querySelector(".saloon-life");
  for (let i = 0; i < targetOrbsBefore; i++) tokens.append(document.createElement("i"));
  const orbs = root.querySelector(".saloon-shot-orbs");
  const showOrbs = left => {
    orbs.textContent = `${left} of ${targetOrbsBefore} orbs`;
    wallCard.toggleAttribute("data-defeated", left === 0);
    Array.from(tokens.children).forEach((token, i) => token.toggleAttribute("data-spent", i >= left));
  };
  showOrbs(targetOrbsBefore);
  const result = root.querySelector(".saloon-shot-result");
  const shots = root.querySelectorAll("button[data-shot]");
  const reply = root.querySelector(".saloon-shot-reply");
  const moves = reply.querySelectorAll("button[data-reply]");
  const replyResult = reply.querySelector(".saloon-reply-result");
  const comparison = root.querySelector(".saloon-bot-finish");
  const vitals = reply.querySelector(".saloon-duel-orbs");
  const orbCount = n => `${n} ${n === 1 ? "orb" : "orbs"}`;
  const showDuelOrbs = ({billy, horseman}) => {
    vitals.textContent = `Billy: ${orbCount(billy)} · Horseman: ${orbCount(horseman)}`;
  };
  let choice = null;
  for (const button of moves) button.addEventListener("click", () => {
    if (!choice) return;
    const move = button.dataset.reply;
    const resolved = choice.play(move);
    showDuelOrbs(resolved.orbs);
    for (const other of moves) other.setAttribute("aria-pressed", String(other === button));
    const deed = move === "cover" ? "Billy took cover" : `Billy attacked ${choice.opponent}`;
    replyResult.textContent = `${deed}. Billy has ${orbCount(resolved.orbs.billy)} left. The bots played on and ${ending(resolved)}`;
  });
  for (const button of shots) button.addEventListener("click", () => {
    const line = button.dataset.shot;
    const run = takeBillyShot(table, line);
    const {targetLeft} = run;
    showOrbs(targetLeft);
    for (const shot of shots) shot.setAttribute("aria-pressed", String(shot === button));
    const wall = targetLeft ? `Bone Wall holds with ${targetLeft} orb.` : "Bone Wall falls.";
    const botEnding = `The bots played on and ${ending(run)}`;
    choice = run.choice;
    result.textContent = choice ? `${wall} Your move is next.` : `${wall} ${botEnding}`;
    comparison.open = false;
    comparison.hidden = !choice;
    comparison.querySelector("p").textContent = choice ? botEnding : "";
    reply.hidden = !choice;
    replyResult.textContent = "";
    for (const move of moves) move.setAttribute("aria-pressed", "false");
    if (choice) {
      reply.querySelector(".saloon-reply-prompt").textContent = `Turn ${choice.turn} · Your move`;
      reply.querySelector("#saloon-reply-title").textContent = choice.opponent;
      showDuelOrbs(choice.orbs);
      reply.querySelector('[data-reply="attack"]').textContent = `Attack ${choice.opponent}`;
    }
  });
}
