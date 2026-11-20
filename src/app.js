// Graybox page entry (issue 143). The graybox game is Showdown only: Play opens the Camp, which
// starts the Trail and, after it, the rivals, Wanted hunts, packs, deck builder, best of three and
// Open range, plus two players at any time. Slice 3 retired the lane duel from this
// page, so no URL opens it here; an old lane address (?mode=lanes, match, ride-out, practice-*,
// fire-arc) loads this same Showdown menu. The lane rules stay only where the 3D page (src/main.js)
// imports them. esbuild inlines the dynamic imports, so the page stays one offline file.
const node = (id) => document.getElementById(id);

Promise.all([import("./ui/showdown-screen.js"), import("./ui/showdown-camp.js"), import("./ui/showdown-builder.js"), import("./match/showdown-campaign.js"),
  import("./match/showdown-playtest.js"), import("./match/showdown-session.js"), import("./match/showdown-turn.js"),
  import("./match/showdown-outrider.js"), import("./ui/outrider-camp.js")])
  .then(([{mountShowdown, freshSeed}, {mountCamp}, {mountBuilder}, {createCampaign}, {createPlaytestLog}, {twoPlayers}, {turnDuel},
    {outriderTurn}, {VERIFIED, outriderControls}]) => {
  const title = node("title-screen"), screen = node("showdown"), campRoot = node("showdown-camp"), builderRoot = node("showdown-builder"), play = node("menu-play");
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
    // When that control is now disabled (a win's card offer is open), the Camp's own order: the claim
    // (offer or pack), then the first open duel. Selectors are tried in turn, not in document order.
    const usable = (selector) => campRoot.querySelector(`${selector}:not(:disabled)`);
    ((last && usable(last)) ?? usable("#camp-claim button") ?? usable("[data-duel]") ?? usable("button"))?.focus();
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
  // Experiment for review (K-095, K-008): two recorded Dragon turns, opened from these optional Camp controls or
  // ?turn=dragon-c5 and ?turn=dragon-c5-70. Only ids allowlisted in showdown-turn.js open; it saves nothing.
  const TURN_CONTROLS = {"dragon-c5": "camp-turn-dragon", "dragon-c5-70": "camp-turn-dragon-70"};
  campRoot.insertAdjacentHTML("beforeend", `<section id="camp-experiment" aria-labelledby="camp-experiment-title"><h2 id="camp-experiment-title">Experiment</h2>
    <p class="sd-note">For review, not a bounty. Nothing here is saved.</p>
    <div class="sd-row"><button type="button" id="camp-turn-dragon" data-turn="dragon-c5">Try one Dragon turn</button>
    <button type="button" id="camp-turn-dragon-70" data-turn="dragon-c5-70">Try another Dragon turn</button></div></section>`);
  const openTurn = (id) => {
    const turn = turnDuel(id);
    if (!turn) return false;
    last = `#${TURN_CONTROLS[id]}`;
    showOnly(screen);
    showdown.start(turn.duel, turn.seed);
    return true;
  };
  campRoot.addEventListener("click", (event) => { const b = event.target.closest("button[data-turn]"); if (b) openTurn(b.dataset.turn); });
  // K-011: Outrider turns, only the ids scripts/outrider-gate.mjs verified at build time (?outrider=<id> or the Camp control).
  node("camp-experiment").insertAdjacentHTML("beforeend", outriderControls());
  const openOutrider = (id) => {
    const turn = outriderTurn(id, VERIFIED);
    if (!turn) return false;
    last = `[data-outrider="${id}"]`;
    showOnly(screen);
    showdown.start(turn.duel, turn.seed);
    return true;
  };
  campRoot.addEventListener("click", (event) => { const b = event.target.closest("button[data-outrider]"); if (b) openOutrider(b.dataset.outrider); });
  const turn = new URLSearchParams(location.search).get("turn");
  if (turn !== null) openTurn(turn);
  const outrider = new URLSearchParams(location.search).get("outrider");
  if (outrider !== null && turn === null) openOutrider(outrider);
  });
