import {CARDS, tributeCost} from "../game/cards.js";
import {DRAGON_HUNTS} from "../game/bounty-notices.js";
import {dragonRewardEarned, HUNT_GOAL} from "../game/bounty-hunt.js";

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function renderWantedBoard(content, profile, start) {
  const {clearedHunts} = profile;
  const earned = dragonRewardEarned(profile);
  const reward = CARDS["cowboy-captured-dragon-1"];
  const poster = element("article", null, "wanted-poster");
  const name = element("h3", "Graveyard Dragon");
  poster.append(
    element("p", "Wanted", "wanted-eyebrow"),
    name,
    element("p", "Bring down the Dragon and keep your Base standing. Monsters hold their lanes and strike at the clash."),
    element("strong", `${Math.min(clearedHunts.length, HUNT_GOAL)} / ${HUNT_GOAL} hunts cleared`, "wanted-progress"),
    element("p", earned
      ? "Bounty Hunter earned. Captured Dragon is ready in Build Deck."
      : "Clear five different hunts to earn Bounty Hunter and add Captured Dragon to your collection."),
    element("p", `${reward.name} · ${reward.attack} attack · ${reward.health} orbs · ${tributeCost(reward.stars)} tribute`, "wanted-reward"),
  );
  const list = element("ul", null, "wanted-hunts");
  for (const hunt of DRAGON_HUNTS) {
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
