// Graybox page entry (issue 143 slices 1 to 3). The normal entry is Showdown: Play opens the Camp,
// which starts the Trail and, after it, the rivals, Wanted hunts and Open range, plus two players at any time. The lane duel is unchanged in
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
  Promise.all([import("./ui/showdown-screen.js"), import("./ui/showdown-camp.js"), import("./ui/showdown-builder.js"), import("./match/showdown-campaign.js"),
    import("./match/showdown-playtest.js"), import("./match/showdown-session.js")])
    .then(([{mountShowdown, freshSeed}, {mountCamp}, {mountBuilder}, {createCampaign}, {createPlaytestLog}, {twoPlayers}]) => {
  const title = node("title-screen"), screen = node("showdown"), campRoot = node("showdown-camp"), builderRoot = node("showdown-builder"), play = node("menu-play");
  // The camp replaces the lane-only entries (Wanted, Build Deck, the rival duels); they stay on ?mode=lanes until slice 3.
  for (const lane of title.querySelectorAll("#menu-stargazer, #menu-imp, [data-menu-page], nav a:not(#menu-lanes)")) lane.hidden = true;
  node("menu-lanes").hidden = false;
  const seed = new URLSearchParams(location.search).get("seed");
  // ?seed fixes every deal started from the Camp and every later game of a match, so a scripted check replays the same duels.
  const seedFor = () => (seed === null ? freshSeed() : Number(seed));
  // The browser's storage is read through the canonical store; a blocked storage leaves progress in memory only.
  let storage = null;
  try { storage = window.localStorage; } catch { /* storage is blocked */ }
  const campaign = createCampaign(storage);
  // One line per finished solo game for the Camp's playtest report, under the prototype's key.
  const playtest = createPlaytestLog(storage);
  const showOnly = (shown) => { for (const el of [title, screen, campRoot, builderRoot]) el.hidden = el !== shown; window.scrollTo(0, 0); };
  let last = null; // the Camp control that started the duel just left, so focus returns to it
  const toCamp = () => {
    showOnly(campRoot);
    camp.show();
    ((last && campRoot.querySelector(`${last}:not(:disabled)`)) ?? campRoot.querySelector("[data-duel], [data-choose], button"))?.focus();
  };
  const builder = mountBuilder(builderRoot, {campaign});
  const showdown = mountShowdown(screen, {onHome: toCamp, campaign, playtest, nextSeed: seedFor,
    // Between the games of a best of three with a side deck: the swap, then the next game.
    onSwap: (pool, deck, side, done) => {
      showOnly(builderRoot);
      builder.openSwap({pool, deck, side, done: (nextDeck, nextSide) => { showOnly(screen); done(nextDeck, nextSide); }});
    }});
  const camp = mountCamp(campRoot, {campaign, playtest, onHome: () => { showOnly(title); play.focus(); },
    onBuild: () => {
      showOnly(builderRoot);
      last = "#camp-build";
      builder.openDeck({done: toCamp, cancel: toCamp});
    },
    onDuel: (id, {players = 1, best = 1}) => {
      const duel = players === 2 ? twoPlayers() : id === "trail" ? campaign.trailDuel() : campaign.duel(id);
      if (!duel) return;
      last = players === 2 ? `[data-two="${best}"]` : best > 1 ? `[data-match="${id}"]` : `[data-duel="${id}"]`;
      showOnly(screen);
      showdown.start(duel, seedFor(), {players, best});
    }});
  play.addEventListener("click", toCamp);
  });
}
