// Graybox page entry (issue 143). The graybox game is Showdown only: Play opens the Camp, which
// starts the Trail and, after it, the rivals, Wanted hunts, packs, deck builder, best of three and
// Open range, plus two players at any time. The Wizard preview (four Wizard-seat duels with their own save) is the
// Camp's last section after Boot Hill and opens on its own at ?wizard=1. Slice 3 retired the lane duel from this
// page, so no URL opens it here; an old lane address (?mode=lanes, match, ride-out, practice-*,
// fire-arc) loads this same Showdown menu. The old 3D page has been removed. esbuild inlines the dynamic imports, so the page stays one offline file.
const node = (id) => document.getElementById(id);

Promise.all([import("./ui/showdown-screen.js"), import("./ui/showdown-camp.js"), import("./ui/showdown-builder.js"), import("./match/showdown-campaign.js"),
  import("./match/showdown-playtest.js"), import("./match/showdown-session.js"), import("./match/showdown-turn.js"),
  import("./match/showdown-outrider.js"), import("./ui/outrider-camp.js"), import("./match/showdown-practice.js"),
  import("./match/showdown-wizard-campaign.js"), import("./ui/showdown-wizard-camp.js"), import("./match/showdown-earned.js"),
  typeof __CVW_DIORAMA__ !== "undefined" && __CVW_DIORAMA__ ? import("./ui/showdown-3d/scene.js") : null])
  .then(([{mountShowdown, freshSeed}, {mountCamp}, {mountBuilder}, {createCampaign}, {createPlaytestLog, PAGE_BUILD}, {twoPlayers}, {turnDuel},
    {outriderTurn}, {VERIFIED, outriderControls}, {PRACTICE_SEEDS, practiceDuel, practiceFromQuery},
    {createWizardPreview, wizardFromQuery, previewUnlocked, WIZARD_TRACK}, {mountWizardCamp}, {earnedControl, earnedDuel}, diorama]) => {
  const title = node("title-screen"), screen = node("showdown"), campRoot = node("showdown-camp"), builderRoot = node("showdown-builder"), play = node("menu-play");
  const seed = new URLSearchParams(location.search).get("seed");
  // ?seed fixes every deal started from the Camp and every later game of a match, so a scripted check replays the same duels.
  const seedFor = () => (seed === null ? freshSeed() : Number(seed));
  // The browser's storage is read through the canonical store; a blocked storage leaves progress in memory only.
  let storage = null;
  try { storage = window.localStorage; } catch { /* storage is blocked */ }
  // Precedence of the opening queries: ?turn, then ?outrider, then ?practice, then ?wizard=1 (Fable: last). Any of the
  // first three in the query, valid or not, keeps its existing behaviour and the Wizard preview does not open.
  const query = new URLSearchParams(location.search);
  const [turn, outrider] = [query.get("turn"), query.get("outrider")];
  const practice = turn === null && outrider === null ? practiceFromQuery(location.search) : null;
  const wizard = !["turn", "outrider", "practice"].some((key) => query.has(key)) && wizardFromQuery(location.search);
  // K-096: a direct practice or Wizard preview visit writes no Cowboy key until the player chooses the Camp
  // (campaign.enter() in toCamp).
  const campaign = createCampaign(storage, {deferImport: practice !== null || wizard});
  // The Wizard preview's own save (cvw-showdown-wizard-preview-v1); creating it only reads that key.
  const preview = createWizardPreview(storage);
  // One line per finished solo game for the Camp's playtest report, under the prototype's key.
  const playtest = createPlaytestLog(storage);
  const showOnly = (shown) => { for (const el of [title, screen, campRoot, builderRoot]) el.hidden = el !== shown; window.scrollTo(0, 0); };
  let last = null; // the Camp control that started the duel just left, so focus returns to it
  // Back from a duel: the Camp, or for a Wizard preview duel the place it was opened from. Reset after each use.
  let back = null;
  const home = () => { const go = back ?? toCamp; back = null; go(); };
  // The direct Wizard preview hides the Cowboy parts of the Camp page; these are the ones it hid.
  let hiddenForWizard = [];
  const showCowboyParts = () => { for (const el of hiddenForWizard) el.hidden = false; hiddenForWizard = []; };
  const toCamp = () => {
    showCowboyParts();
    campRoot.removeAttribute("aria-labelledby"); // the landmark is "Camp" again (its aria-label)
    showOnly(campRoot);
    campaign.enter();
    camp.show();
    wizardCamp.show("camp", {unlocked: previewUnlocked(campaign.progress())});
    showEarned();
    // When that control is now disabled (a win's card offer is open), the Camp's own order: the claim
    // (offer or pack), then the first open duel. Selectors are tried in turn, not in document order.
    const usable = (selector) => campRoot.querySelector(`${selector}:not(:disabled)`);
    ((last && usable(last)) ?? usable("#camp-claim button") ?? usable("[data-duel]") ?? usable("button"))?.focus();
  };
  // The direct Wizard preview: the Camp page with only the preview section shown. Nothing Cowboy is entered or written.
  const toWizard = () => {
    showOnly(campRoot);
    hiddenForWizard = [...hiddenForWizard, ...[...campRoot.children].filter((el) => el.id !== "camp-wizard" && !el.hidden)];
    for (const el of hiddenForWizard) el.hidden = true;
    // One name for the direct page: the landmark takes its label from the visible "Wizard preview" heading.
    campRoot.setAttribute("aria-labelledby", "wizard-direct-title");
    wizardCamp.show("direct");
    wizardCamp.focus(null); // the open tile; Back from a duel then moves focus to the tile that started it
  };
  const builder = mountBuilder(builderRoot, {campaign});
  const showdown = mountShowdown(screen, {onHome: home, campaign, playtest, nextSeed: seedFor, mountBoard: diorama?.mountDiorama,
    // Between the games of a best of three with a side deck: the swap, then the next game.
    onSwap: (pool, deck, side, done) => {
      showOnly(builderRoot);
      builder.openSwap({pool, deck, side, done: (nextDeck, nextSide) => { showOnly(screen); done(nextDeck, nextSide); }});
    }});
  const camp = mountCamp(campRoot, {campaign, playtest, paintCardFaces: diorama?.paintCardFaces,
    onHome: () => { showOnly(title); play.focus(); },
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
  diorama?.mountGallery(title, screen);
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
  // K-011: Outrider turns, only the ids scripts/outrider-gate.mjs verified at build time: one Camp control, the Ledger's
  // two position links (both inside the Camp root) and ?outrider=<id>.
  node("camp-experiment").insertAdjacentHTML("beforeend", outriderControls());
  const openOutrider = (id, from = null) => {
    const turn = outriderTurn(id, VERIFIED);
    if (!turn) return false;
    // Focus returns to the control that opened it: the Camp entry or the Ledger link.
    last = from?.closest("#ledger-outrider") ? `#ledger-outrider [data-outrider="${id}"]` : "#camp-outrider-turn";
    showOnly(screen);
    showdown.start(turn.duel, turn.seed);
    return true;
  };
  campRoot.addEventListener("click", (event) => { const b = event.target.closest("button[data-outrider]"); if (b) openOutrider(b.dataset.outrider, b); });
  // K-096: Boot Hill practice, collapsed at the end of the Camp. Each deal is a native link (?practice=<seed>) that can
  // be copied or opened in a new tab; a plain click or Enter opens the same duel here through openPractice.
  // Only the seeds in showdown-practice.js open; nothing is saved (see that file).
  campRoot.insertAdjacentHTML("beforeend", `<details id="camp-practice"${PAGE_BUILD ? ` data-build="${PAGE_BUILD}"` : ""}><summary>Practice Boot Hill</summary>
    <p class="sd-note">The first Trail duel with the starter deck. Nothing here is saved. Each link opens one fixed deal.</p>
    <div class="sd-row">${PRACTICE_SEEDS.map((s) => `<a id="camp-practice-${s}" data-practice="${s}" href="?practice=${s}">Deal ${s}</a>`).join(" ")}</div></details>`);
  const openPractice = (seed) => {
    const practice = practiceDuel(seed);
    if (!practice) return false;
    node("camp-practice").open = true; // so Back to camp can return focus to the link
    last = `#camp-practice-${seed}`;
    showOnly(screen);
    showdown.start(practice.duel, practice.seed);
    return true;
  };
  campRoot.addEventListener("click", (event) => {
    const a = event.target.closest("a[data-practice]");
    if (!a || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openPractice(Number(a.dataset.practice));
  });
  // Wizard preview (Fable's ruling): the last section of the Camp, shown once Boot Hill is won, and ?wizard=1 on its own.
  // Its duels play the Wizard seat and settle only through the preview, so no Cowboy key or playtest line is written.
  campRoot.insertAdjacentHTML("beforeend", `<details id="camp-wizard" hidden></details>`);
  const openWizard = (id) => {
    const duel = preview.duel(id);
    if (!duel) return;
    const direct = campRoot.querySelector("#camp-wizard").dataset.mode === "direct";
    back = () => {
      if (direct) toWizard();
      else { last = null; toCamp(); }
      wizardCamp.focus(id);
    };
    showOnly(screen);
    showdown.start(duel, seedFor(), {seat: duel.seat, campaign: preview});
  };
  const wizardCamp = mountWizardCamp(node("camp-wizard"), {preview, track: WIZARD_TRACK, onDuel: openWizard, onCowboyCamp: toCamp});
  // Earned decks (showdown-earned.js, Fable's ruling): one two-player game, the Camp's Cowboy deck against the Wizard
  // preview deck, after the Camp's two-player buttons once the preview has a win. Read-only: the two-player screen
  // settles nothing and logs nothing. Refreshed on each Camp entry and after any Camp click (Start preview over).
  node("camp-open").insertAdjacentHTML("afterend", `<div id="camp-earned-row" class="sd-row" hidden></div>`);
  const showEarned = () => {
    const html = earnedControl(earnedDuel(campaign.progress(), preview.progress()));
    const row = node("camp-earned-row");
    if (row.innerHTML !== html) row.innerHTML = html;
    row.hidden = !html;
  };
  campRoot.addEventListener("click", (event) => {
    if (!event.target.closest("button[data-earned]")) return showEarned();
    const duel = earnedDuel(campaign.progress(), preview.progress());
    if (!duel) return showEarned();
    last = "#camp-earned";
    showOnly(screen);
    showdown.start(duel, seedFor(), {players: 2});
  });
  if (turn !== null) openTurn(turn);
  if (outrider !== null && turn === null) openOutrider(outrider);
  if (practice !== null) openPractice(practice);
  if (wizard) toWizard();
  });
