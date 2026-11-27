// Graybox page entry (issue 143). The graybox game is Showdown only: Play opens the Camp, which
// starts the Trail and, after it, the rivals, Wanted hunts, packs, deck builder, best of three and
// Open range, plus two players at any time. The Wizard preview (four Wizard-seat duels with their own save) is the
// Camp's last section after Boot Hill and opens on its own at ?wizard=1. Slice 3 retired the lane duel from this
// page, so no URL opens it here; an old lane address (?mode=lanes, match, ride-out, practice-*,
// fire-arc) loads this same Showdown menu. The illustrated title opens the Night Shift Saloon, the Outrider turn or Camp.
// esbuild inlines the dynamic imports, so the page stays one offline file.
import {mountReplayRoom} from "../apps/replay-room/src/room.mjs";
import replayLessons from "../apps/replay-room/src/lessons.json";
import {parseDealSeed} from "./game/showdown/seed.js";
import {EVEN_FIGHT_MODES, evenFightDuel, evenFightFromQuery} from "./match/showdown-even-fight.js";

const node = (id) => document.getElementById(id);

Promise.all([import("./ui/showdown-screen.js"), import("./ui/showdown-camp.js"), import("./ui/showdown-builder.js"), import("./match/showdown-campaign.js"),
  import("./match/showdown-playtest.js"), import("./match/showdown-session.js"), import("./match/showdown-turn.js"),
  import("./match/showdown-outrider.js"), import("./ui/outrider-camp.js"), import("./match/showdown-practice.js"),
  import("./match/showdown-wizard-campaign.js"), import("./ui/showdown-wizard-camp.js"), import("./match/showdown-earned.js"),
  typeof __CVW_DIORAMA__ !== "undefined" && __CVW_DIORAMA__ ? import("./ui/showdown-3d/scene.js") : null,
  import("./ui/wizard-lesson.js")])
  .then(([{mountShowdown, freshSeed}, {mountCamp}, {mountBuilder}, {createCampaign, createCampaignWriter}, {createPlaytestLog, PAGE_BUILD}, {twoPlayers}, {turnDuel},
    {outriderTurn}, {VERIFIED, outriderControls}, {PRACTICE_SEEDS, practiceDuel, practiceFromQuery},
    {createWizardPreview, wizardFromQuery, previewUnlocked, WIZARD_TRACK}, {mountWizardCamp}, {earnedControl, earnedDuel}, diorama,
    {mountWizardLesson, createLessonSession, lessonDuel}]) => {
  const title = node("title-screen"), screen = node("showdown"), campRoot = node("showdown-camp"), builderRoot = node("showdown-builder"), play = node("menu-play");
  // The Wizard lesson page (src/ui/wizard-lesson.js), a sibling of the duel screen.
  const lessonRoot = document.createElement("section");
  lessonRoot.id = "wizard-lesson";
  lessonRoot.className = "wizard-lesson";
  lessonRoot.hidden = true;
  screen.after(lessonRoot);
  const contest = typeof __CVW_CONTEST__ !== "undefined" && __CVW_CONTEST__;
  const query = new URLSearchParams(location.search);
  const evenFight = evenFightFromQuery(query);
  const seed = parseDealSeed(query.get("seed"));
  // A valid link fixes every deal. An absent or unusable seed gets a fresh deal each time.
  const seedFor = () => seed ?? freshSeed();
  // The browser's storage is read through the canonical store; a blocked storage leaves progress in memory only.
  let storage = null;
  try { storage = window.localStorage; } catch { /* storage is blocked */ }
  // Precedence of the opening queries: ?turn, then ?outrider, then ?practice, then ?wizard=1 (Fable: last). Any of the
  // first three in the query, valid or not, keeps its existing behaviour and the Wizard preview does not open.
  const [turn, outrider] = [query.get("turn"), query.get("outrider")];
  const practice = turn === null && outrider === null ? practiceFromQuery(location.search) : null;
  const wizard = !["turn", "outrider", "practice"].some((key) => query.has(key)) && wizardFromQuery(location.search);
  const directRoom = query.get("room") === "replay" &&
    !["turn", "outrider", "practice", "wizard", "lesson"].some((key) => query.has(key)) &&
    !(diorama && query.get("saloon") === "review") && query.get("replay") !== "billy";
  // K-096: a direct practice or Wizard preview visit writes no Cowboy key until the player chooses the Camp
  // (campaign.enter() in toCamp).
  const directBook = diorama && query.get("book") === "1";
  const campaign = createCampaign(storage, {deferImport: practice !== null || wizard || directRoom || directBook || evenFight !== null});
  // The Wizard preview's own save (cvw-showdown-wizard-preview-v1); creating it only reads that key.
  const preview = createWizardPreview(storage);
  // One line per finished solo game for the Camp's playtest report, under the prototype's key.
  const playtest = createPlaytestLog(storage);
  const room = node("replay-room");
  let outpost;
  const showOnly = (shown) => {
    if (shown !== campRoot) outpost?.close();
    if (shown !== screen) delete screen.dataset.contestChallenge;
    for (const el of [title, screen, campRoot, builderRoot, lessonRoot, room]) el.hidden = el !== shown;
    window.scrollTo(0, 0);
  };
  let last = null; // the Camp control that started the duel just left, so focus returns to it
  // Back from a duel: the Camp, or for a Wizard preview duel the place it was opened from. Reset after each use.
  let back = null;
  const home = () => { const go = back ?? toCamp; back = null; go(); };
  // The direct Wizard preview hides the Cowboy parts of the Camp page; these are the ones it hid.
  let hiddenForWizard = [];
  const showCowboyParts = () => { for (const el of hiddenForWizard) el.hidden = false; hiddenForWizard = []; };
  const toCamp = (message = "") => {
    showCowboyParts();
    outpost?.wizardInCamp();
    campRoot.removeAttribute("aria-labelledby"); // the landmark is "Camp" again (its aria-label)
    showOnly(campRoot);
    campaign.enter();
    camp.show(message);
    wizardCamp.show("camp", {unlocked: previewUnlocked(campaign.progress())});
    showEarned();
    if (message) { node("camp-changed").focus(); return; }
    // When that control is now disabled (a win's card offer is open), the Camp's own order: the claim
    // (offer or pack), then the first open duel. Selectors are tried in turn, not in document order.
    const usable = (selector) => campRoot.querySelector(`${selector}:not(:disabled)`);
    const returning = last && usable(last);
    if (returning && outpost?.restoreFocus(returning)) return;
    (returning || usable("#camp-claim button") || (outpost && usable("#camp-start-trail:not([hidden])")) ||
      (outpost ? usable("#camp-build") : usable("[data-duel]")) || usable("button"))?.focus();
  };
  // The direct Wizard preview: the Camp page with only the preview section shown. Nothing Cowboy is entered or written.
  const toWizard = () => {
    outpost?.wizardOnItsOwn();
    showOnly(campRoot);
    hiddenForWizard = [...hiddenForWizard, ...[...campRoot.children].filter((el) => el.id !== "camp-wizard" && !el.hidden)];
    for (const el of hiddenForWizard) el.hidden = true;
    // One name for the direct page: the landmark takes its label from the visible "Wizard preview" heading.
    campRoot.setAttribute("aria-labelledby", "wizard-direct-title");
    wizardCamp.show("direct");
    wizardCamp.focus(null); // the open tile; Back from a duel then moves focus to the tile that started it
  };
  // Commit one Cowboy save at a time across tabs. Offline pages without Web Locks still compare
  // their saved snapshot before writing. Confirmation dialogs and gameplay stay outside the lock.
  function showChangedCamp(message) {
    last = back = null;
    outpost?.close();
    toCamp(`${message} Your action was skipped.`);
  }
  const writeCamp = createCampaignWriter(storage, showChangedCamp);
  const builder = mountBuilder(builderRoot, {campaign, writeCamp, paintCardFaces: diorama?.paintCardFaces});
  function openDeck(rewardType, cancel) {
    const finish = () => {
      last = rewardType ? null : "#camp-build";
      toCamp();
    };
    showOnly(builderRoot);
    builder.openDeck({done: finish, cancel: cancel ?? finish, focusType: rewardType});
  }
  // Wizard lesson: review a finished duel or an episode file, rematch the identical deal. The rematch settles nothing
  // (kind "lesson"); its Wizard uses a lesson only when the player opted in (policy null otherwise).
  const showLesson = () => showOnly(lessonRoot);
  const lessonPage = mountWizardLesson(lessonRoot, {storage,
    onRematch: ({episode, policy}) => {
      showOnly(screen);
      showdown.start(lessonDuel(episode, Boolean(policy)), episode.seed, {lesson: {createSession: () => createLessonSession({episode, policy})}});
    },
    onClose: () => home()});
  const startCampDuel = (id, {players = 1, best = 1} = {}) => {
    const duel = players === 2 ? twoPlayers() : id === "trail" ? campaign.trailDuel() : campaign.duel(id);
    if (!duel) return false;
    delete screen.dataset.contestChallenge;
    last = players === 2 ? `[data-two="${best}"]` : best > 1 ? `[data-match="${id}"]` : `[data-duel="${id}"]`;
    showOnly(screen);
    showdown.start(duel, seedFor(), {players, best});
    return true;
  };
  const showdown = mountShowdown(screen, {onHome: home, campaign, writeCamp, playtest, nextSeed: seedFor, mountBoard: diorama?.mountDiorama,
    onBuildReward: openDeck,
    onOpenCaptureBook: diorama && openCollectionBook,
    onBootHill: () => campaign?.trailDuel?.()?.battlefield === "boot-hill" ? startCampDuel("trail") : false,
    onReview: (record) => { showLesson(); lessonPage.openFromDuel(record); },
    onLessonBack: () => { showLesson(); lessonPage.reopen(); },
    // Between the games of a best of three with a side deck: the swap, then the next game.
    onSwap: (pool, deck, side, done) => {
      showOnly(builderRoot);
      builder.openSwap({pool, deck, side, done: (nextDeck, nextSide) => { showOnly(screen); done(nextDeck, nextSide); }});
    }});
  const camp = mountCamp(campRoot, {campaign, writeCamp, playtest, paintCardFaces: diorama?.paintCardFaces, cardArtwork: diorama?.cardArtwork,
    openDestination: (id, control) => outpost?.open(id, control),
    dressNotices: (trailComplete) => outpost?.dressNotices(trailComplete),
    onHome: () => { showOnly(title); play.focus(); },
    onBuild: openDeck,
    onDuel: startCampDuel});
  const openBookCard = diorama?.mountGallery(title, screen, {cowboy: campaign.owned, wizard: preview.owned});
  function openCollectionBook(id, source) {
    const origin = campRoot.contains(source) ? campRoot : screen;
    openBookCard(id, source, (type, reopen) => writeCamp(() => {
      // Closing the book focused its opener. The player may have moved on while waiting for the lock.
      if (document.activeElement !== source) return;
      campaign.refresh();
      if (!campaign.owned(type)) return;
      openDeck(type, () => {
        showOnly(origin);
        if (origin === campRoot) outpost.restoreFocus(source);
        reopen();
      });
    }));
  }
  if (openBookCard) campRoot.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-book-card]");
    if (button && !button.disabled && !campRoot.hidden) openCollectionBook(button.dataset.bookCard, button);
  });
  // Play from the title is a fresh entry: forget the control of the last duel so toCamp opens on the Trail instead of
  // restoring that duel's room. Only a return from a duel (home, Back to camp) keeps `last`.
  play.addEventListener("click", () => { last = null; outpost?.close(); toCamp(); });
  // Experiment for review (K-095, K-008): two recorded Dragon turns, opened from these optional Camp controls or
  // ?turn=dragon-c5 and ?turn=dragon-c5-70. Only ids allowlisted in showdown-turn.js open; it saves nothing.
  const TURN_CONTROLS = {"dragon-c5": "camp-turn-dragon", "dragon-c5-70": "camp-turn-dragon-70"};
  campRoot.insertAdjacentHTML("beforeend", `<section id="camp-experiment" aria-labelledby="camp-experiment-title"><h2 id="camp-experiment-title">Experiment</h2>
    <p class="sd-note">For review, not a bounty. Nothing here is saved.</p>
    <div class="sd-row"><button type="button" id="camp-turn-dragon" data-turn="dragon-c5">Try one Dragon turn</button>
    <button type="button" id="camp-turn-dragon-70" data-turn="dragon-c5-70">Try another Dragon turn</button>
    <button type="button" id="camp-replay-room">Replay Room</button></div></section>`);
  const openTurn = (id, returnFocus = `#${TURN_CONTROLS[id]}`) => {
    const turn = turnDuel(id);
    if (!turn) return false;
    last = returnFocus;
    showOnly(screen);
    showdown.start(turn.duel, turn.seed, {fromWanted: returnFocus === "#camp-scout-dragon"});
    return true;
  };
  campRoot.addEventListener("click", (event) => { const b = event.target.closest("button[data-turn]"); if (b) openTurn(b.dataset.turn); });
  node("camp-experiment").insertAdjacentHTML("beforeend", `<details id="camp-even-fight"><summary>Even Fight preview</summary>
    <p class="sd-note">Play with fixed decks, cover that blocks spells and two extra Base orbs for the second player. Your Camp progress and cards stay as you left them.</p>
    <div class="sd-row">${Object.entries(EVEN_FIGHT_MODES).map(([id, mode]) => `<a id="camp-even-fight-${id}" data-even-fight="${id}" href="?even-fight=${id}">${mode.label}</a>`).join(" ")}</div></details>`);
  const openEvenFight = (id) => {
    last = `#camp-even-fight-${id}`;
    node("camp-even-fight").open = true;
    showOnly(screen);
    showdown.start(evenFightDuel(), seedFor(), EVEN_FIGHT_MODES[id]);
  };
  campRoot.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-even-fight]");
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openEvenFight(link.dataset.evenFight);
  });
  const roomBack = node("replay-room-back");
  let unmountRoom;
  function leaveRoom() {
    unmountRoom?.();
    unmountRoom = null;
  }
  function openRoom(returnFocus = "#camp-replay-room") {
    last = returnFocus;
    roomBack.textContent = returnFocus === "#camp-scout-dragon" ? "Back to Wanted" : "Back to Camp";
    unmountRoom?.();
    unmountRoom = mountReplayRoom(node("replay-room-body"), replayLessons, {onPlayTurn(id) {
      if (openTurn(id, returnFocus)) leaveRoom();
    }});
    showOnly(room);
    roomBack.focus();
  }
  node("camp-replay-room").addEventListener("click", () => openRoom());
  node("camp-scout-dragon").addEventListener("click", () => openRoom("#camp-scout-dragon"));
  roomBack.addEventListener("click", () => { leaveRoom(); toCamp(); });
  const openWanted = () => {
    last = null;
    toCamp();
    if (outpost?.open("camp-bounties-title")) return;
    const heading = node("camp-bounties-title");
    heading.tabIndex = -1;
    heading.focus();
    heading.scrollIntoView({block: "start"});
  };
  campRoot.addEventListener("click", (event) => {
    const link = event.target.closest('a[href="?room=wanted"]');
    if (!link || event.button !== 0 || event.ctrlKey || event.shiftKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    openWanted();
  });
  // Wizard lesson saved in this browser: reopened from this control or ?lesson=saved. A stale save is cleared there.
  node("camp-experiment").insertAdjacentHTML("beforeend", `<div class="sd-row"><button type="button" id="camp-wizard-lesson">Open saved Wizard lesson</button></div>
    <p class="sd-note">Unlike the rest of this section, a Wizard lesson keeps one marked episode in this browser.</p>`);
  const openSavedLesson = (from = null) => {
    last = from ? "#camp-wizard-lesson" : null;
    showLesson();
    lessonPage.openSaved();
  };
  node("camp-wizard-lesson").addEventListener("click", (event) => openSavedLesson(event.currentTarget));
  // K-011: Outrider turns, only the ids scripts/outrider-gate.mjs verified at build time: one Camp control, the Ledger's
  // two position links (both inside the Camp root) and ?outrider=<id>.
  node("camp-experiment").insertAdjacentHTML("beforeend", outriderControls());
  const openOutrider = (id, from = null) => {
    const turn = outriderTurn(id, VERIFIED);
    if (!turn) return false;
    // Focus returns to the control that opened it: the Camp entry or the Ledger link.
    last = from?.closest("#ledger-outrider") ? `#ledger-outrider [data-outrider="${id}"]` : "#camp-outrider-turn";
    showOnly(screen);
    if (contest) screen.dataset.contestChallenge = "";
    const duel = contest ? {...turn.duel, name: "Ride or Fight?", lesson: "Choose the Outrider. Attack a troop, or ride past it to the Wizard Base."} : turn.duel;
    showdown.start(duel, turn.seed);
    return true;
  };
  campRoot.addEventListener("click", (event) => { const b = event.target.closest("button[data-outrider]"); if (b) openOutrider(b.dataset.outrider, b); });
  if (contest && VERIFIED.some((entry) => entry.id === "case-e")) {
    const challenge = document.createElement("button");
    challenge.id = "menu-challenge";
    challenge.type = "button";
    challenge.className = "frontier-plaque";
    challenge.textContent = "Ride or Fight?";
    challenge.addEventListener("click", () => openOutrider("case-e"));
    play.before(challenge);
  }
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
      else { last = outpost ? "#camp-wizard summary" : null; toCamp(); }
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
  outpost = diorama?.mountCampOutpost(campRoot, openBookCard);
  const openSaloon = (review = false) => {
    last = null;
    toCamp();
    if (review) outpost.openSaloonReview();
    else outpost.open("night-shift-saloon");
  };
  if (contest && outpost) {
    const saloon = document.createElement("button");
    saloon.id = "menu-saloon";
    saloon.type = "button";
    saloon.className = "frontier-plaque";
    saloon.textContent = "Night Shift Saloon";
    saloon.setAttribute("aria-haspopup", "dialog");
    saloon.setAttribute("aria-controls", "room-for-night-shift-saloon");
    saloon.addEventListener("click", () => openSaloon());
    play.parentElement.prepend(saloon);
    play.textContent = "Camp";
    play.classList.add("menu-camp");
  }
  const openBillyReplay = () => {
    outpost?.open("camp-collection-room");
    const ledger = node("camp-ledger");
    ledger.open = true;
    ledger.querySelector('[data-billy-line="baseline"]').focus();
  };
  campRoot.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-billy-replay]");
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openBillyReplay();
  });
  if (turn !== null) openTurn(turn);
  if (outrider !== null && turn === null) openOutrider(outrider);
  if (practice !== null) openPractice(practice);
  if (wizard) toWizard();
  if (evenFight !== null) openEvenFight(evenFight);
  if (query.get("lesson") === "saved" && !["turn", "outrider", "practice", "wizard"].some((key) => query.has(key))) openSavedLesson();
  if (!["turn", "outrider", "practice", "wizard", "lesson"].some((key) => query.has(key))) {
    if (outpost && query.get("saloon") === "review") {
      openSaloon(true);
    } else if (query.get("replay") === "billy") {
      toCamp();
      openBillyReplay();
    } else if (directRoom) openRoom();
    else if (query.get("room") === "wanted" && evenFight === null) openWanted();
  }
  });
