import {EFFECTS, cardOf} from "../game/showdown/cards.js";
import {applyAction, createShowdown} from "../game/showdown/rules.js";

// Seed 0 deals all three cards in time to reach the witness on turn two with ordinary decks.
export function dealHellfire() {
  let state = createShowdown(0, {first: "cowboy"});
  for (const action of [
    {type: "summon", cardId: "cowboy-sheriff-3", tributes: []},
    {type: "end"},
    {type: "summon", cardId: "wizard-skeleton-4", tributes: []},
  ]) state = applyAction(state, action).state;
  return state;
}

export const hellfireHtml = `<section class="forge-hellfire" aria-labelledby="forge-hellfire-title">
  <h4 id="forge-hellfire-title">Who gets burned by Hellfire?</h4>
  <ul aria-label="Troops on the board">
    <li data-cowboy></li>
    <li data-wizard></li>
  </ul>
  <div data-readings>
    <p>You play the Wizards. Choose the wording you think Hellfire follows to cast it.</p>
    <div class="sd-row">
      <button type="button" value="all">Remove 1 orb from every troop.</button>
      <button type="button" value="enemy">${EFFECTS.hellfire.text}</button>
    </div>
  </div>
  <div data-result hidden>
    <p data-verdict tabindex="-1"></p>
    <p>Hellfire’s printed wording is “${EFFECTS.hellfire.text}”</p>
    <button type="button" data-retry>Replay the same board</button>
  </div>
</section>`;

export function mountHellfire(host) {
  const board = dealHellfire();
  const sheriff = board.sides.cowboy.board[0], skeleton = board.sides.wizard.board[0];
  const ally = cardOf(skeleton.cardId).name;
  const readings = host.querySelector("[data-readings]"), result = host.querySelector("[data-result]");
  const verdict = result.querySelector("[data-verdict]");
  const choices = [...readings.querySelectorAll("button")];
  let alternate;
  function showTroops(after) {
    for (const [side, faction] of [["cowboy", "Cowboys"], ["wizard", "Wizards"]]) {
      const troop = board.sides[side].board[0];
      const left = after?.sides[side].board[0]?.health ?? 0;
      const orbs = after ? `${troop.health} → ${left} orbs` : `${troop.health} orbs`;
      host.querySelector(`[data-${side}]`).textContent = `${faction} · ${cardOf(troop.cardId).name} · ${orbs}`;
    }
  }
  showTroops();

  for (const choice of choices) choice.addEventListener("click", () => {
    const {state} = applyAction(board, {type: "spell", cardId: "wizard-hellfire-1"});
    const enemyLeft = state.sides.cowboy.board[0]?.health ?? 0;
    const allyLeft = state.sides.wizard.board[0]?.health ?? 0;
    const allTroops = choice.value === "all";
    const allyPrediction = allTroops ? skeleton.health - 1 : skeleton.health;
    const matches = enemyLeft === sheriff.health - 1 && allyLeft === allyPrediction;
    showTroops(state);
    verdict.textContent = `“${allTroops ? "Every troop" : "Every enemy troop"}” ${matches ? "matches this cast" : "fails on this board"}. It predicts ${allyPrediction} orbs for your ${ally}. After Hellfire, it has ${allyLeft}.`;
    alternate = choices.find((button) => button !== choice);
    readings.hidden = true;
    result.hidden = false;
    verdict.focus();
  });
  result.querySelector("[data-retry]").addEventListener("click", () => {
    showTroops();
    result.hidden = true;
    readings.hidden = false;
    alternate.focus();
  });
}
