// Graybox page entry (issue 143 slice 1). The normal entry is Showdown: Play opens Trail duel 1,
// Boot Hill. The lane duel is unchanged in src/graybox.js and is reachable at ?mode=lanes; the
// lane-only modes its checks and links already use (?mode=match, ride-out, practice-*, fire-arc)
// keep loading it. esbuild inlines both dynamic imports, so the page stays one offline file and
// only the chosen app's module runs.
export const LANE_MODES = Object.freeze(["lanes", "match", "ride-out", "practice-dynamiter", "practice-tribute", "fire-arc"]);

const node = (id) => document.getElementById(id);
const mode = new URLSearchParams(location.search).get("mode");

if (LANE_MODES.includes(mode)) {
  node("menu-showdown").hidden = false;
  import("./graybox.js");
} else {
  Promise.all([import("./ui/showdown-screen.js"), import("./match/showdown-session.js")]).then(([{mountShowdown, freshSeed}, {bootHill}]) => {
  const title = node("title-screen"), screen = node("showdown"), play = node("menu-play");
  // Lane-only entries stay on ?mode=lanes until slice 2 brings the camp.
  for (const lane of title.querySelectorAll("#menu-stargazer, #menu-imp, [data-menu-page], nav a:not(#menu-lanes)")) lane.hidden = true;
  node("menu-lanes").hidden = false;
  const seed = new URLSearchParams(location.search).get("seed");
  const home = () => { screen.hidden = true; title.hidden = false; play.focus(); };
  const showdown = mountShowdown(screen, {onHome: home});
  // No Showdown progress is saved in slice 1, so every Play is a clean profile's first duel.
  play.addEventListener("click", () => {
    title.hidden = true;
    screen.hidden = false;
    showdown.start(bootHill(), seed === null ? freshSeed() : Number(seed));
    window.scrollTo(0, 0);
  });
  });
}
