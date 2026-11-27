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

export function mountBillyTable(root, table, portrait) {
  if (!table) return;
  const {attackerId, baseline, candidate, targetOrbsBefore} = BILLY_REPLAY;
  const printed = cardOf(attackerId).attack === baseline.attack ? "Current" : "Recorded";
  root.hidden = false;
  root.dataset.billyPhase = "shot";
  root.innerHTML = `<h3 id="saloon-shot-title">Billy vs. Bone Wall</h3>
    <div class="saloon-shot-board">
      <div class="saloon-shot-cards">
        <div class="saloon-shot-actions" role="group" aria-label="Choose Billy’s shot">
          <button type="button" data-shot="baseline" data-shot-card="billy" aria-pressed="false"><strong class="saloon-move-name">Fire for ${baseline.attack}</strong><span class="saloon-move-stat">${printed} Billy</span></button>
          <button type="button" data-shot="candidate" data-shot-card="billy" aria-pressed="false"><strong class="saloon-move-name">Fire for ${candidate.attack}</strong><span class="saloon-move-stat">Kiro’s proposal</span></button>
        </div>
        <span data-shot-card="wall"><strong>Bone Wall</strong><span class="saloon-life" aria-hidden="true"></span><span class="saloon-shot-orbs"></span></span>
      </div>
    </div>
    <section class="saloon-shot-reply" aria-labelledby="saloon-reply-title" hidden>
      <div class="saloon-horseman">
        <p class="saloon-reply-prompt"></p>
        <h4 id="saloon-reply-title"></h4>
        <p class="saloon-duel-orbs"></p>
      </div>
      <div class="saloon-shot-actions" role="group" aria-label="Choose Billy’s reply">
        <button type="button" data-reply="attack" aria-pressed="false"><strong class="saloon-move-name">Attack</strong><span class="saloon-move-stat">Shoot Horseman</span></button>
        <button type="button" data-reply="cover" aria-pressed="false"><strong class="saloon-move-name">Take cover</strong><span class="saloon-move-stat">Block spillover</span></button>
      </div>
    </section>
    <p class="saloon-shot-status saloon-shot-result saloon-reply-result" role="status" aria-live="polite" aria-atomic="true"></p>
    <details class="saloon-bot-finish" hidden>
      <summary>Bot replay report</summary><p></p>
    </details>`;
  for (const [selector, type] of [
    ['[data-shot-card="billy"], [data-reply="cover"]', "cowboy-billy"],
    ['[data-shot-card="wall"]', "wizard-bone-wall"],
    ['.saloon-horseman, [data-reply="attack"]', "wizard-headless-horseman"],
  ]) for (const slot of root.querySelectorAll(selector)) {
    const face = portrait?.(type);
    if (face) slot.prepend(face);
  }
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
  const comparison = root.querySelector(".saloon-bot-finish");
  const vitals = reply.querySelector(".saloon-duel-orbs");
  const orbCount = n => `${n} ${n === 1 ? "orb" : "orbs"}`;
  let choice = null;
  const showDuelOrbs = orbs => {
    vitals.replaceChildren();
    for (const [actor, name] of [["billy", "Billy"], ["horseman", "Horseman"]]) {
      const stat = document.createElement("span");
      stat.append(`${name} `);
      const dots = document.createElement("span");
      dots.setAttribute("role", "img");
      dots.setAttribute("aria-label", orbCount(orbs[actor]));
      dots.textContent = "●".repeat(orbs[actor]) + "○".repeat(choice.orbs[actor] - orbs[actor]);
      stat.append(dots);
      vitals.append(stat);
    }
  };
  for (const button of moves) button.addEventListener("click", () => {
    if (!choice) return;
    const move = button.dataset.reply;
    const resolved = choice.play(move);
    showDuelOrbs(resolved.orbs);
    for (const other of moves) other.setAttribute("aria-pressed", String(other === button));
    const deed = move === "cover" ? "Billy took cover" : "Billy attacked";
    result.textContent = `${deed}. In bot play, ${ending(resolved)}`;
  });
  for (const button of shots) button.addEventListener("click", () => {
    const line = button.dataset.shot;
    const run = takeBillyShot(table, line);
    const {targetLeft} = run;
    showOrbs(targetLeft);
    for (const shot of shots) shot.setAttribute("aria-pressed", String(shot === button));
    const wall = targetLeft ? `Bone Wall holds with ${targetLeft} orb.` : "Bone Wall falls.";
    const botEnding = `In bot play, ${ending(run)}`;
    choice = run.choice;
    root.dataset.billyPhase = choice ? "reply" : "shot";
    result.textContent = choice ? `${wall} Choose Billy’s reply.` : `${wall} ${botEnding}`;
    comparison.open = false;
    comparison.hidden = !choice;
    comparison.querySelector("p").textContent = choice
      ? `Deal ${BILLY_REPLAY.seed}. With both sides on bot play, ${ending(run)}` : "";
    reply.hidden = !choice;
    for (const move of moves) move.setAttribute("aria-pressed", "false");
    if (choice) {
      reply.querySelector(".saloon-reply-prompt").textContent = `Turn ${choice.turn}`;
      reply.querySelector("#saloon-reply-title").textContent = choice.opponent;
      showDuelOrbs(choice.orbs);
    }
  });
}
