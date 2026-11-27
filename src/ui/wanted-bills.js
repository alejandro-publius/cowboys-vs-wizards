import {TYPES} from "../game/showdown/cards.js";
import {BOUNTIES, HUNTS} from "../game/showdown/progress.js";

export function mountWantedBills(list, scout) {
  const lock = document.createElement("p");
  lock.id = "wanted-hunt-condition";
  lock.textContent = `Finish the Trail to hunt. Capture each boss in ${HUNTS} wins.`;
  scout.closest("aside").remove();
  list.before(lock);
  const bills = new Map();
  for (const bounty of BOUNTIES) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    item.append(button);
    if (bounty.boss === "wizard-dragon") {
      item.append(scout);
      list.prepend(item);
    } else list.append(item);
    bills.set(`hunt:${bounty.id}`, {bounty, button});
  }

  return (hunts, offer) => {
    lock.hidden = !hunts.some(duel => duel.state === "locked");
    for (const duel of hunts) {
      const {bounty, button} = bills.get(duel.id);
      const locked = duel.state === "locked";
      const captured = duel.state === "won";
      const dragon = bounty.boss === "wizard-dragon";
      const scouting = locked && dragon;
      // The app binds the Ranger replay and its return focus to this exact button at startup.
      const bill = scouting ? scout : button;
      if (scouting) button.remove();
      else if (dragon) {
        if (!button.parentNode) scout.before(button);
        scout.textContent = "Scout with the Ranger";
        scout.classList.remove("sd-tile");
        scout.removeAttribute("aria-label");
        scout.removeAttribute("aria-describedby");
        delete scout.dataset.wantedBounty;
        delete scout.dataset.wantedWins;
      }

      let action;
      delete bill.dataset.duel;
      delete bill.dataset.bookCard;
      bill.disabled = false;
      if (scouting) action = "Scout with the Ranger";
      else if (locked || captured) {
        bill.dataset.bookCard = captured ? bounty.reward : bounty.boss;
        action = captured ? `Inspect ${TYPES[bounty.reward].name}` : "Inspect in Field Guide";
      } else {
        bill.dataset.duel = duel.id;
        bill.disabled = Boolean(offer);
        action = offer ? "Claim your Camp reward first" : `Start hunt ${duel.cleared + 1}`;
      }

      bill.dataset.wantedBounty = bounty.id;
      bill.dataset.wantedWins = duel.cleared;
      bill.classList.add("sd-tile");
      bill.setAttribute("aria-label", `${duel.name}. ${captured ? "Captured. " : ""}${action}. ${duel.cleared} of ${HUNTS} hunts won.`);
      if (locked) bill.setAttribute("aria-describedby", lock.id);
      else bill.removeAttribute("aria-describedby");
      const marks = Array.from({length: HUNTS}, (_, i) => `<i${i < duel.cleared ? ' class="won"' : ""}></i>`).join("");
      bill.innerHTML = `<span class="wanted-masthead">Wanted</span>
        <span class="wanted-terms">Dead or alive</span>
        <span class="wanted-portrait" data-portrait="${bounty.boss}">${captured ? '<b class="wanted-stamp">Captured</b>' : ""}</span>
        <strong class="wanted-name">${duel.name}</strong>
        <span class="wanted-tally" aria-hidden="true">Hunts won ${marks}</span>
        <span class="wanted-action">${action}</span>`;
    }
  };
}
