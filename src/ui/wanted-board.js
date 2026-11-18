import {CARDS, tributeCost} from "../game/cards.js";
import {BOSSES, clearedFor, HUNT_GOAL, HUNTS_BY_ID, rewardEarned} from "../game/bounty-hunt.js";

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

// One poster and hunt list per boss. Each boss counts only its own hunts.
export function renderWantedBoard(content, profile, start) {
  const {clearedHunts} = profile;
  for (const boss of BOSSES) {
    const earned = rewardEarned(profile, boss);
    const reward = CARDS[`${boss.reward}-1`];
    const achievement = boss.achievement === "bounty-hunter" ? "Bounty Hunter" : "Lantern Snuffer";
    const poster = element("article", null, "wanted-poster");
    poster.dataset.boss = boss.id;
    poster.append(
      element("p", "Wanted", "wanted-eyebrow"),
      element("h3", boss.name),
      element("p", boss.brief),
      element("strong", `${Math.min(clearedFor(profile, boss), HUNT_GOAL)} / ${HUNT_GOAL} hunts cleared`, "wanted-progress"),
      element("p", earned
        ? `${achievement} earned. ${reward.name} is ready in Build Deck.`
        : `Clear five different hunts to earn ${achievement} and add ${reward.name} to your collection.`),
      element("p", `${reward.name} · ${reward.attack} attack · ${reward.health} orbs · ${tributeCost(reward.stars)} tribute`, "wanted-reward"),
    );
    const list = element("ul", null, "wanted-hunts");
    list.setAttribute("aria-label", `${boss.name} hunts`);
    for (const id of boss.hunts) {
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
