import {CARDS, tributeCost} from "../game/cards.js";
import {BOSSES, clearedFor, HUNT_GOAL, HUNTS_BY_ID, rewardEarned} from "../game/bounty-hunt.js";
import {typeLine} from "./card-frames.js";

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

// Fable's first-session order (.artifacts/coordination/fable-first-session.md §2).
// Display order only: BOSSES and the canonical hunt data stay as they are.
export const WRAITH_NOTICE_ORDER = Object.freeze([
  "gallows-lantern", "ferry-crossing", "blacksmith-forge", "lamplighter-row", "chapel-bell-tower",
]);
const WRAITH_RIDE_NOTE = " On a hunt your troops can Ride Out. In a standard duel only cards marked Ride can Ride.";
const posterOrder = (boss) => (boss.id === "lantern-wraith" ? WRAITH_NOTICE_ORDER : boss.hunts);
// Wraith poster first, then the Dragon.
const firstWraith = (a, b) => (b.id === "lantern-wraith") - (a.id === "lantern-wraith");

// One poster and hunt list per boss. Each boss counts only its own hunts.
// onPosse(opener, kind) is optional; without it no showcase button appears.
export function renderWantedBoard(content, profile, start, onPosse) {
  const {clearedHunts} = profile;
  for (const boss of [...BOSSES].sort(firstWraith)) {
    const earned = rewardEarned(profile, boss);
    const reward = CARDS[`${boss.reward}-1`];
    const achievement = boss.achievement === "bounty-hunter" ? "Bounty Hunter" : "Lantern Snuffer";
    const poster = element("article", null, "wanted-poster");
    poster.dataset.boss = boss.id;
    poster.append(
      element("p", "Wanted", "wanted-eyebrow"),
      element("h3", boss.name),
      element("small", typeLine("wanted")),
      element("p", boss.id === "lantern-wraith" ? boss.brief + WRAITH_RIDE_NOTE : boss.brief),
      element("strong", `${Math.min(clearedFor(profile, boss), HUNT_GOAL)} / ${HUNT_GOAL} hunts cleared`, "wanted-progress"),
      element("p", earned
        ? `${achievement} earned. ${reward.name} is ready in Build Deck.`
        : `Clear five different hunts to earn ${achievement} and add ${reward.name} to your collection.`),
      element("p", `${reward.name} · ${reward.attack} attack · ${reward.health} orbs · ${tributeCost(reward.stars)} tribute`, "wanted-reward"),
    );
    if (earned && typeof onPosse === "function") {
      const kind = boss.id === "lantern-wraith" ? "wraith" : "dragon";
      const label = `Duel with the ${kind === "wraith" ? "Wraith" : "Dragon"} Posse`;
      const duel = element("button", label, "wanted-posse");
      duel.type = "button";
      duel.addEventListener("click", () => onPosse(duel, kind));
      poster.append(duel);
    }
    const list = element("ul", null, "wanted-hunts");
    list.setAttribute("aria-label", `${boss.name} hunts`);
    for (const id of posterOrder(boss)) {
      const hunt = HUNTS_BY_ID.get(id);
      const row = element("li");
      const cleared = clearedHunts.includes(hunt.id);
      const copy = element("div");
      copy.append(element("strong", hunt.name), element("p", hunt.description));
      const play = element("button", cleared ? "Replay" : "Hunt");
      play.type = "button";
      play.setAttribute("aria-label", `${cleared ? "Replay" : "Hunt"} ${hunt.name}`);
      if (cleared) row.dataset.cleared = "true";
      play.addEventListener("click", () => start(play, hunt.id));
      row.append(copy, play);
      list.append(row);
    }
    content.append(poster, list);
  }
}
