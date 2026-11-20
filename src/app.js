// Graybox page entry (issue 143 slices 1 and 2). The normal entry is Showdown: Play opens the Camp,
// which starts the open Trail duel and keeps what each win paid. The lane duel is unchanged in
// src/graybox.js and is reachable at ?mode=lanes; the lane-only modes its checks and links already use (?mode=match, ride-out, practice-*, fire-arc)
// keep loading it. esbuild inlines both dynamic imports, so the page stays one offline file and
// only the chosen app's module runs.
export const LANE_MODES = Object.freeze(["lanes", "match", "ride-out", "practice-dynamiter", "practice-tribute", "fire-arc"]);

const node = (id) => document.getElementById(id);
const mode = new URLSearchParams(location.search).get("mode");

if (LANE_MODES.includes(mode)) {
  node("menu-showdown").hidden = false;
  import("./graybox.js");
} else {
  Promise.all([import("./ui/showdown-screen.js"), import("./ui/showdown-camp.js"), import("./match/showdown-campaign.js"), import("./match/showdown-playtest.js")])
    .then(([{mountShowdown, freshSeed}, {mountCamp}, {createCampaign}, {createPlaytestLog}]) => {
  const title = node("title-screen"), screen = node("showdown"), campRoot = node("showdown-camp"), play = node("menu-play");
  // The camp replaces the lane-only entries (Wanted, Build Deck, the rival duels); they stay on ?mode=lanes until slice 3.
  for (const lane of title.querySelectorAll("#menu-stargazer, #menu-imp, [data-menu-page], nav a:not(#menu-lanes)")) lane.hidden = true;
  node("menu-lanes").hidden = false;
  const seed = new URLSearchParams(location.search).get("seed");
  // The browser's storage is read through the canonical store; a blocked storage leaves progress in memory only.
  let storage = null;
  try { storage = window.localStorage; } catch { /* storage is blocked */ }
  const campaign = createCampaign(storage);
  // One line per finished Trail duel for the Camp's playtest report, under the prototype's key.
  const playtest = createPlaytestLog(storage);
  const showOnly = (shown) => { for (const el of [title, screen, campRoot]) el.hidden = el !== shown; window.scrollTo(0, 0); };
  const toCamp = () => { showOnly(campRoot); camp.show(); campRoot.querySelector("[data-duel], [data-choose], button")?.focus(); };
  const showdown = mountShowdown(screen, {onHome: toCamp, campaign, playtest});
  // ?seed fixes every deal started from the Camp, so a scripted check replays the same Trail duels.
  const camp = mountCamp(campRoot, {campaign, playtest, onHome: () => { showOnly(title); play.focus(); },
    onDuel: () => {
      const duel = campaign.trailDuel();
      if (!duel) return;
      showOnly(screen);
      showdown.start(duel, seed === null ? freshSeed() : Number(seed));
    }});
  play.addEventListener("click", toCamp);
  });
}
