// Graybox page entry (issue 143). The graybox game is Showdown only: Play opens the Camp, which
// starts the open Trail duel and keeps what each win paid. Slice 3 retired the lane duel from this
// page, so no URL opens it here; an old lane address (?mode=lanes, match, ride-out, practice-*,
// fire-arc) loads this same Showdown menu. The lane rules stay only where the 3D page (src/main.js)
// imports them. esbuild inlines the dynamic imports, so the page stays one offline file.
const node = (id) => document.getElementById(id);

Promise.all([import("./ui/showdown-screen.js"), import("./ui/showdown-camp.js"), import("./match/showdown-campaign.js"), import("./match/showdown-playtest.js")])
  .then(([{mountShowdown, freshSeed}, {mountCamp}, {createCampaign}, {createPlaytestLog}]) => {
  const title = node("title-screen"), screen = node("showdown"), campRoot = node("showdown-camp"), play = node("menu-play");
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
