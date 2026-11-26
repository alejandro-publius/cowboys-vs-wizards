// The Showdown duel in the graybox (issue 143 slices 1 and 2). Adapted from the reference screen in
// prototypes/showdown/main.js, solo only. Everything drawn comes from session.view() (viewFor),
// session.legal() (legalActions for this seat) and presentEvent text. The full state never
// reaches this module, and no Wizard hand, trap or deck card id is written into the page.
// Slice 2: a finished duel is settled once through the campaign (src/match/showdown-campaign.js),
// and the result shows what it paid and the card choice before the way back to Camp.
// Slice 3: every Camp duel (Trail, rivals, Wanted hunts, the even match), best of three with the
// side-deck swap between games (src/match/showdown-match.js), and two players on one screen. With
// two players the board is drawn from the active seat's view only, and a curtain hides the whole
// table, with no hand or trap in the page, while the screen changes hands.
// Wizard seat (for the proposed Wizard campaign, docs/design/showdown-wizard-campaign-brief.md): start(..., {seat:
// "wizard"}) gives the human the Wizards against the bot's Cowboys. It settles only through a campaign passed to
// that start, never through the mount's (Cowboy) campaign, and adds no playtest line.
import {EFFECTS, KEYWORDS, RARITY, TYPES, cardOf, has, tributes, typeOf} from "../game/showdown/cards.js";
import {presentEvent} from "../game/showdown/presenter.js";
import {newRunId} from "../match/showdown-playtest.js";
import {TRAP_SLOTS, attackOf, attackOutcome, canAttack, newestUndeadIndex, opponent} from "../game/showdown/rules.js";
import {createShowdownSession} from "../match/showdown-session.js";
import {matchOver, matchWinner, newMatch, nextGame, offersSwap, recordGame, swapPool, withSwap} from "../match/showdown-match.js";
import {createCuePlayer, cuesFor} from "./showdown-cues.js";
import {FRAMES} from "./card-frames.js";
import {lessonSetup} from "./wizard-lesson.js";

const name = (cardId) => cardOf(cardId).name;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const orbs = (now, max) => `<span class="sd-orbs" role="img" aria-label="${now} of ${Math.max(now, max)} orbs">${"●".repeat(now)}<span class="sd-lost">${"○".repeat(Math.max(0, max - now))}</span></span>`;
// Troop, spell and trap use the pull request 139 frames; gear and location add the reference screen's marks.
const FRAME = {...FRAMES, gear: {mark: "◆", line: "Gear"}, location: {mark: "■", line: "Location"}};
const typeLine = (card) => `<span class="sd-type">${FRAME[card.kind].mark} ${card.kind === "troop" ? `Troop · ${card.tag}` : FRAME[card.kind].line} · ${RARITY[card.rarity][0]}</span>`;
const keywords = (card) => (card.keys ?? []).map((key) => `<span class="sd-key" title="${KEYWORDS[key][1]}">${KEYWORDS[key][0]}</span>`).join(" ");
function raisePaymentHint({board, discard}, payments) {
  const hints = new Set();
  for (const {tributes: slots} of payments) {
    if (board.filter(Boolean).length - slots.length + 1 >= board.length)
      return "The Wizard fills your last slot, so nothing returns.";
    // Tribute reaches the pile before Raise. Gear cannot be an Undead troop.
    const paid = slots.map((slot) => board[slot].cardId);
    const pile = [...discard, ...paid];
    const target = pile[newestUndeadIndex(pile)];
    const result = target ? `${name(target)} returns with 1 orb` : "no Undead to return";
    hints.add(`Pay ${paid.map(name).join(" and ")}: ${result}.`);
  }
  return [...hints].join(" ");
}

function costLine(type) {
  const cost = tributes(`${type}-1`);
  if (cost) return `Cost: ${cost} of your troops, sent to the graveyard. Attacks the turn it arrives.`;
  return TYPES[type].keys.includes("quickdraw") ? "Cost: none." : "Cost: none. Rests the turn it arrives.";
}
export function face(type, extra = "") {
  const card = TYPES[type];
  const rules = card.kind !== "troop" ? EFFECTS[card.effect].text : "";
  return `<strong>${card.name}</strong>${typeLine(card)}${card.kind === "troop" ? `${card.attack} attack · ${plural(card.health, "orb")} ${keywords(card)}` : ""}
    ${rules ? `<span class="sd-note">${rules}</span>` : ""}${card.kind === "troop" ? `<span class="sd-note">${costLine(type)}</span>` : ""}${extra}`;
}

const TEMPLATE = `
  <header><h1>Showdown</h1><button id="sd-home" type="button">Back to camp</button></header>
  <section id="sd-curtain" aria-label="Pass the screen" hidden>
    <p id="sd-curtain-text"></p>
    <button type="button" id="sd-ready">I'm ready</button>
  </section>
  <div id="sd-table">
  <p id="sd-lesson"></p>
  <p id="sd-status" role="status"></p>
  <p id="sd-feedback" aria-live="polite"></p>
  <p id="sd-cue" aria-hidden="true"></p>
  <div id="sd-result"></div>
  <p id="sd-location" class="sd-note"></p>
  <div id="sd-field"><section id="sd-board" aria-label="Board"></section></div>
  <p id="sd-prompt"></p>
  <div class="sd-row" id="sd-actions">
    <button type="button" id="sd-end">End turn</button>
    <button type="button" id="sd-boot-hill" hidden>Continue to Boot Hill</button>
    <button type="button" id="sd-cover" aria-describedby="sd-prompt" hidden>Take cover</button>
    <button type="button" id="sd-cancel" hidden>Cancel</button>
    <button type="button" id="sd-restart">Restart this duel</button>
  </div>
  <section id="sd-hand" aria-label="Your hand"></section>
  <section aria-label="What happened"><h2>What happened</h2><ol id="sd-log"></ol></section>
  <section aria-label="Graveyards"><h2>Graveyards</h2>
    <p class="sd-note">Cowboys: <span id="sd-cowboy-graveyard"></span></p>
    <p class="sd-note">Wizards: <span id="sd-wizard-graveyard"></span></p>
  </section>
  <section aria-label="Keywords"><h2>Keywords</h2><ul id="sd-keywords"></ul></section>
  </div>`;

export const OFFER_HEADING = "Bonus: pick 1 more card to keep";
export const offerRow = (offer, owned) => `<div class="sd-row">${offer.map((type) => `<button type="button" class="sd-card ${TYPES[type].side} ${TYPES[type].rarity} sd-can" data-frame="${TYPES[type].kind}" data-choose="${type}">
  ${face(type, `<span class="sd-note">You own ${owned(type)}.</span>`)}</button>`).join("")}</div>`;
export const rewardDeckButton = (type) => `<button type="button" data-build-reward>Build with ${TYPES[type].name}</button>`;
export const pays = (cards) => cards.map(([type, copies]) => `${TYPES[type].name}${copies > 1 ? ` ×${copies}` : ""}`).join(", ");

const FACTION = {cowboy: "Cowboy", wizard: "Wizard"};

// campaign: the Cowboy seat's campaign. settle(duel, won) once per decided solo duel, choose(type), progress(), owned(type), trailDuel(),
// duel(id, deck) for any Camp duel. playtest (optional): add(entry) once per finished solo game.
// nextSeed() deals each later game (the next game of a match, a repeat, two players again); a Rematch
// after a loss is a fresh deal. onSwap(pool, deck, side, done) opens the between-games side-deck swap.
// cueOptions go to createCuePlayer (showdown-cues.js); only a check sets them, to shorten the step.
// Wizard lesson (src/ui/wizard-lesson.js): onReview(record) opens the lesson for a finished single solo Cowboy duel;
// record is {seed, setup, cowboyActions, expected}. start(duel, seed, {lesson: {createSession}}) plays a lesson rematch
// (duel.kind "lesson"): it settles nothing and logs nothing, and onLessonBack() returns to the lesson.
export function mountShowdown(root, {onHome, campaign, writeCamp = (change) => change(), playtest, cueOptions, nextSeed = freshSeed, onSwap, mountBoard, onReview, onLessonBack, onBootHill, onBuildReward}) {
  root.innerHTML = TEMPLATE;
  const $ = (id) => root.querySelector(`#${id}`);
  let session, duel, seed, lines, latest, pick, outcome, picked, run, started, challengeAttacked = false, playbackIdle = true, bootHillOffered = false;
  // Only an Outrider attack made as the first move can be compared by replaying the opening deal.
  let atChallengeOpening = false, openingShot = null;
  // The lesson record of the current game: its frozen setup and the Cowboy's actions in order. lesson: a rematch's session factory.
  let setup = null, cowboyActions = [], lesson = null;
  // seat: the solo player's side. camp: the campaign this duel settles through, or null (nothing is settled).
  let players = 1, match = null, curtain = false, seat = "cowboy", camp = campaign;
  let settling = false;
  const cues = createCuePlayer(root, cueOptions);
  const boardPresentation = mountBoard?.(root);
  const solo = () => players === 1;
  // A Wizard lesson reviews one single solo game of the Cowboy seat against the ordinary bot: not a game of a best of
  // three, two players, the Wizard seat, or a lesson rematch (whose Wizard may not be the ordinary one).
  const reviewable = (current) => Boolean(onReview) && solo() && seat === "cowboy" && !match && !lesson && current.kind !== "lesson";
  const viewer = () => session.viewer();
  // Solo wording speaks to the player; two players are named by faction.
  const whoseBase = (side) => (solo() && side === viewer() ? "Your" : FACTION[side]);
  const sides = (side) => `${FACTION[side]}s`;

  // Logs a batch of events and returns its placeholder cues, each tied to its log line.
  function record(events, before) {
    latest = events.map((event) => presentEvent(event));
    const first = lines.length;
    for (const [i, event] of events.entries()) lines.push({turn: event.type === "turn", text: latest[i]});
    const batch = cuesFor(events, before, session.view()).map((cue) => ({...cue, line: first + cue.index}));
    for (const cue of batch) lines[cue.line].cue = cue.kind;
    return batch;
  }
  // best 3 plays a best of three. players 2: two people on one screen, starter decks, nothing saved.
  // seat "wizard" (solo): the human plays the Wizards. Its campaign, if any, comes with this start; without one the
  // Wizard seat settles nothing. The Cowboy seat keeps the mount's campaign unless another is passed.
  function start(nextDuel, dealSeed, {players: seats = 1, best = 1, seat: side = "cowboy", campaign: own, lesson: rematch = null} = {}) {
    const opener = document.activeElement; // the control that opened this duel, read before the deal
    [duel, players, seat] = [nextDuel, seats, seats === 1 ? side : "cowboy"];
    lesson = rematch && seats === 1 && seat === "cowboy" && best === 1 ? rematch : null;
    camp = lesson ? null : own ?? (seat === "cowboy" ? campaign : null);
    const progress = solo() ? camp?.progress() : null;
    match = best > 1 ? newMatch(progress ? {deck: progress.deck, side: progress.side} : {}) : null;
    deal(dealSeed);
    opened(opener);
  }
  // A duel opened by keyboard from another screen (the title's Ride or Fight?, a Camp tile, a lesson or preview button)
  // hides the control that opened it, which would drop focus to the page. Focus goes to the duel's first choice instead:
  // a troop's decision (an Outrider or experiment turn opens on one), else a playable card, else End turn. A pointer or a
  // direct link leaves focus alone: the opener is then not :focus-visible, or focus is already on the page.
  function opened(opener) {
    if (curtain || root.hidden || !opener || opener === document.body || root.contains(opener) || opener.getClientRects().length > 0) return;
    let keyed = false;
    try { keyed = opener.matches(":focus-visible"); } catch { /* a browser without :focus-visible keeps focus as before */ }
    if (keyed) usable("#sd-board [data-own]", "#sd-hand button", "#sd-end", "#sd-result button", "#sd-home")?.focus();
  }
  // One game: of a single duel, or the current game of a match (the match's deck, the loser opening).
  function deal(dealSeed) {
    seed = dealSeed;
    const current = solo() && match && camp ? camp.duel(duel.id, match.deck) ?? duel : duel;
    // The lesson record is taken before the deal, from the duel as it is dealt (grit and all), and frozen. It is null
    // when the duel cannot be trained (wizard-lesson.js lessonSetup: level-2 Wizard, no landing bosses).
    setup = reviewable(current) ? lessonSetup(current, seed) : null;
    cowboyActions = [...(current.prefix ?? [])];
    session = lesson ? lesson.createSession() : createShowdownSession({seed, duel: current, players, seat, ...(match?.first ? {first: match.first} : {})});
    curtain = !solo();
    lines = [{turn: true, text: `Turn 1: the ${session.view().first === "cowboy" ? "Cowboys" : "Wizards"}.`}];
    latest = [];
    pick = null;
    outcome = null;
    picked = null;
    run = newRunId();
    started = Date.now();
    challengeAttacked = false;
    atChallengeOpening = "contestChallenge" in root.dataset;
    openingShot = null;
    $("sd-lesson").textContent = duel.lesson;
    $("sd-restart").textContent = "Restart this duel";
    playbackIdle = true;
    bootHillOffered = false;
    cues.clear();
    boardPresentation?.clear();
    boardPresentation?.setBattlefield?.(current.battlefield);
    const batch = record(session.opening, null);
    finish(() => {
      render();
      // An experiment turn opens on its decision: its replayed history is in the log, not played as cues.
      cues.play(duel.prefix ? [] : batch);
    });
  }
  function act(action) {
    pick = null;
    const [before, seat] = [session.view(), viewer()];
    const trace = [];
    const events = session.act(action, boardPresentation ? (step) => trace.push(step) : undefined);
    if (action.type === "attack") challengeAttacked = true;
    if (setup) cowboyActions.push(structuredClone(action));
    const batch = record(events, before);
    if (atChallengeOpening && action.type === "attack" && typeOf(before.sides[seat].board[action.slot].cardId) === "cowboy-outrider") {
      openingShot = {slot: action.slot, report: latest.join(" "),
        replayLabel: action.target === "base" ? "Try fighting instead" : "Try riding instead"};
    }
    atChallengeOpening = false;
    finish(() => {
      // Two players: hide the table while the screen changes hands.
      curtain = !solo() && !session.view().result && viewer() !== seat;
      const canAnimate = !curtain && Boolean(boardPresentation?.animate);
      playbackIdle = !canAnimate;
      const activeRun = run;
      render(trace[0]?.before);
      cues.play(batch);
      if (canAnimate) {
        boardPresentation.animate(trace, () => {
          if (run !== activeRun) return;
          playbackIdle = true;
          showChallengeChoices();
        });
      }
    });
  }
  // A game counts once it ends; a solo duel is settled exactly once, when it (or its match) is decided.
  function finish(present) {
    const view = session.view();
    const result = view.result;
    if (!result || outcome) return present();
    outcome = {winner: result.winner, matchOver: true};
    if (match) {
      match = recordGame(match, {winner: result.winner, first: view.first});
      outcome.matchOver = matchOver(match);
    }
    // Two players, an experiment turn (showdown-turn.js) and a Wizard lesson rematch settle nothing and add no playtest line.
    if (!solo() || duel.kind === "turn" || duel.kind === "lesson") return present();
    // The run id makes the log ignore a second report of this same finished game. The log is the Cowboy career's.
    const logGame = () => {
      if (seat === "cowboy") playtest?.add({name: duel.name, won: result.winner === session.seat, turns: view.turn,
        seconds: Math.round((Date.now() - started) / 1000), rules: false, run, duel: duel.id, seed});
    };
    const won = match ? matchWinner(match) === session.seat : result.winner === session.seat;
    if (!camp || camp !== campaign) {
      logGame();
      if (camp && outcome.matchOver) Object.assign(outcome, camp.settle(duel, won));
      return present();
    }
    // A duel can end in a tab that was left open. Show its verdict after the save decision,
    // so no reward is announced or made claimable before the career has accepted it.
    settling = true;
    $("sd-end").disabled = true;
    $("sd-status").textContent = "Saving duel result…";
    const complete = (payment) => {
      settling = false;
      Object.assign(outcome, payment);
      const hadFocus = root.contains(document.activeElement);
      present();
      if (hadFocus && document.activeElement === document.body) usable("#sd-result button", "#sd-home")?.focus();
    };
    return writeCamp(() => {
      logGame();
      complete(outcome.matchOver ? camp.settle(duel, won) : {});
    }, (message) => complete({won, conflict: message}));
  }
  // After a result: the next game of the match, a rematch, a repeat, or nothing (back to camp).
  function againLabel() {
    if (!outcome.matchOver) return `Game ${match.game + 1}`;
    if (duel.kind === "turn") return "Retry";
    if (duel.kind === "lesson") return "Same deal again";
    if (!solo()) return duel.kind === "earned" ? "Rematch: earned decks, not an even match" : "Play again";
    if (!outcome.won) return repeat() ? "Rematch" : null;
    return duel.kind === "trail" || !repeat() ? null : "Play it again";
  }
  // The same Camp duel again, as progress now has it (the next hunt, grit after a loss), or null.
  const repeat = () => (!camp ? null : duel.kind === "trail" ? camp.trailDuel() : duel.id ? camp.duel(duel.id) : null);
  function again() {
    const best = match ? 3 : 1;
    if (!outcome.matchOver) {
      match = nextGame(match);
      // Solo, with a side deck: the swap comes before the next game.
      if (solo() && offersSwap(match) && onSwap) {
        return onSwap(swapPool(match), match.deck, match.side, (deck, side) => { match = withSwap(match, deck, side); deal(nextSeed()); });
      }
      return deal(nextSeed());
    }
    // Two players again with the same decks (the starter decks, or the earned decks of showdown-earned.js).
    if (!solo()) return start(duel, nextSeed(), {players: 2, best});
    if (duel.kind === "turn" || duel.kind === "lesson") return deal(seed);
    // A loss is a fresh deal of the same duel; a repeat (a beaten rival, the next hunt, the even match) uses nextSeed.
    const next = repeat();
    if (next) start(next, outcome.won ? nextSeed() : freshSeed(), {best, seat, campaign: camp});
  }
  const playsOf = (cardId) => session.legal().filter((a) => a.cardId && name(a.cardId) === name(cardId));

  function clickCard(cardId) {
    const options = playsOf(cardId);
    if (!options.length) return;
    // A trap, a location, an untargeted spell or a free troop has one way to be played.
    if (options.length === 1 && options[0].target === undefined && options[0].slot === undefined && !options[0].tributes?.length) return act(options[0]);
    pick = cardOf(cardId).kind === "troop" ? {card: cardId, tributes: []} : {card: cardId};
    render();
  }
  function clickOwn(slot) {
    if (pick?.tributes) {
      const paid = pick.tributes.includes(slot) ? pick.tributes.filter((s) => s !== slot) : [...pick.tributes, slot].sort();
      const done = playsOf(pick.card).find((a) => a.tributes.join() === paid.join());
      if (done) return act(done);
      pick = {...pick, tributes: paid};
    } else if (pick?.card) {
      const gear = playsOf(pick.card).find((a) => a.type === "gear" && a.slot === slot);
      if (gear) return act(gear);
    } else if (session.legal().some((a) => (a.type === "attack" || a.type === "cover") && a.slot === slot)) pick = {troop: slot};
    render();
  }
  function clickEnemy(target) {
    const options = session.legal();
    const chosen = pick?.troop !== undefined ? options.find((a) => a.type === "attack" && a.slot === pick.troop && a.target === target)
      : pick?.card ? playsOf(pick.card).find((a) => a.target === target) : null;
    if (chosen) act(chosen);
  }

  // Why a card in hand cannot be played now, read from this seat's view.
  function blocked(view, cardId) {
    const card = cardOf(cardId);
    const mine = view.sides[viewer()];
    if (view.attacking) return "No more cards this turn: a troop has acted.";
    if (card.kind === "troop") {
      if (view.summonUsed) return "One troop a turn.";
      const cost = tributes(cardId);
      return mine.board.filter(Boolean).length < cost ? `Needs ${plural(cost, "troop")} of yours to pay with.` : "Your board is full.";
    }
    if (card.kind === "trap") return view.setUsed ? "One trap a turn." : mine.traps.length >= TRAP_SLOTS ? "Both trap slots are full." : "Not now.";
    if (view.castUsed) return "One spell, gear or location a turn.";
    return card.kind === "location" ? "Already the location." : card.kind === "gear" ? "No troop to carry it." : "No target.";
  }

  const previewId = (target) => `sd-preview-${target}`;

  // What an attack would do, computed on the public view: face-down traps are not counted.
  function preview(view, target) {
    const o = attackOutcome(view, pick.troop, target);
    const foe = view.sides[opponent(viewer())];
    const note = (text, tone = "") => `<span id="${previewId(target)}" aria-hidden="true" class="sd-note${tone ? ` sd-${tone}` : ""}">${foe.trapCount ? "Without trap effects: " : ""}${text}</span>`;
    if (target === "base") return note(`${foe.board.some(Boolean) ? "Ride past: " : ""}Hit the Base for ${o.baseDamage}`, "good");
    const lastStand = o.targetLeft === 0 && has(foe.board[target].cardId, "laststand") ? ". Its Last Stand costs yours 1 orb" : "";
    if (o.targetLeft === 0) return note(`Defeated${o.baseDamage ? `, ${o.baseDamage} through to the Base` : foe.board[target].cover ? ", nothing reaches the Base" : ""}${lastStand}`, "good");
    if (foe.board[target].cover) return note(`Survives on ${o.targetLeft}. It is in cover and does not hit back.`);
    if (attackOf(view, foe.board[target]) === 0) return note(`Survives on ${o.targetLeft}. It has no attack, so yours is unharmed.`);
    return note(`Survives on ${o.targetLeft} and hits back: yours ${o.attackerLeft === 0 ? "is defeated" : `drops to ${o.attackerLeft}`}`, o.attackerLeft === 0 ? "warn" : "");
  }

  // After a win: what it paid and the two cards to choose from. After a loss: the rematch's grit.
  // A game inside a match and a two-player game pay nothing, but they still need the button that moves on.
  function rewardPanel() {
    const label = outcome.conflict ? null : againLabel();
    const review = setup && onReview ? `<button type="button" id="sd-review">Review a Wizard move</button>`
      : duel.kind === "lesson" && onLessonBack ? `<button type="button" id="sd-lesson-back">Back to the lesson</button>` : "";
    const again = (label ? `<button type="button" id="sd-again">${label}</button>` : "") + review;
    if (!outcome.earned) {
      const notice = outcome.conflict ? `<p role="status">${outcome.conflict} This duel did not change your career.</p>` : "";
      return `${notice}<div class="sd-row">${again}<button type="button" id="sd-camp">Back to camp</button></div>`;
    }
    const {won, earned, intoDeck, grit} = outcome;
    const offer = camp.progress().offer;
    const build = picked && camp === campaign && onBuildReward ? rewardDeckButton(picked) : "";
    return [
      earned.captured ? `<h2>Captured</h2><div class="sd-row"><div class="sd-card ${TYPES[earned.captured].side} ${TYPES[earned.captured].rarity}" data-frame="${TYPES[earned.captured].kind}">${face(earned.captured)}</div></div>` : "",
      earned.cards.length ? `<h2>New in your collection</h2><p class="sd-good">You earned ${pays(earned.cards)}.</p>` : "",
      intoDeck.length ? `<p class="sd-note">In your deck now: ${intoDeck.map(([type, copies, replaced]) => `${TYPES[type].name} ×${copies} in place of ${TYPES[replaced].name} ×${copies}`).join(", ")}.</p>` : "",
      earned.packs ? `<p class="sd-good">You earned ${plural(earned.packs, "pack")}. Open ${earned.packs > 1 ? "them" : "it"} in camp.</p>` : "",
      earned.cards.length && !intoDeck.length ? `<p class="sd-note">${earned.cards.length > 1 ? "They are" : "It is"} in your collection, not your deck yet: use Build deck in camp.</p>` : "",
      won && offer ? `<h2>${OFFER_HEADING}</h2>${offerRow(offer, camp.owned)}`
        : picked ? `<p class="sd-good">Added ${TYPES[picked].name}: you now own ${camp.owned(picked)}. Your deck has ${camp.progress().deck[picked] ?? 0}.</p>` : "",
      !won && grit ? `<p class="sd-note">Grit: your Base starts the rematch with ${5 + grit} orbs.</p>` : "",
      `<div class="sd-row">${again}<button type="button" id="sd-camp">Back to camp</button>${build}</div>`,
    ].join("");
  }

  // The title challenge shows Continue to Boot Hill once its attack has played. The first time it appears in a deal, the
  // polite feedback gets one added sentence after the attack line, so a screen reader hears the new choice once; focus
  // stays put. The next render rewrites the feedback without it.
  function showChallengeChoices() {
    if (openingShot && playbackIdle) {
      $("sd-lesson").textContent = openingShot.report;
      $("sd-restart").textContent = openingShot.replayLabel;
    }
    const shown = "contestChallenge" in root.dataset && Boolean(onBootHill) && campaign?.trailDuel?.()?.battlefield === "boot-hill" && challengeAttacked && playbackIdle;
    $("sd-boot-hill").hidden = !shown;
    if (!shown || bootHillOffered) return;
    bootHillOffered = true;
    const note = document.createElement("span");
    note.textContent = " Continue to Boot Hill is now available.";
    $("sd-feedback").append(note);
  }

  function render(presentationStart) {
    // The curtain: nothing of either seat's hand or traps stays in the page while the screen is passed.
    // Focus moves only when the curtain goes up or down: onto "I'm ready" when it rises, and off the hidden curtain
    // onto the table when it clears (a mouse click on "I'm ready" would otherwise leave focus on a hidden button).
    const [rises, clears] = [curtain && $("sd-curtain").hidden, !curtain && !$("sd-curtain").hidden];
    const lost = clears && (!document.activeElement || document.activeElement === document.body || $("sd-curtain").contains(document.activeElement));
    $("sd-curtain").hidden = !curtain;
    $("sd-table").hidden = curtain;
    if (curtain) {
      boardPresentation?.clear();
      for (const id of ["sd-board", "sd-hand", "sd-result", "sd-prompt", "sd-feedback", "sd-status", "sd-location"]) $(id).innerHTML = "";
      $("sd-curtain-text").textContent = `Pass the screen to the ${FACTION[session.view().active]} player.`;
      if (rises && !root.hidden) $("sd-ready").focus();
      return;
    }
    const view = session.view();
    const own = viewer(), foe = opponent(own);
    // Two players after the result: both look at the board, so no hand or set trap is shown.
    const shared = !solo() && Boolean(view.result);
    const options = session.legal();
    const mine = options.length > 0;
    const attacking = pick?.troop !== undefined;
    const kind = pick?.card ? cardOf(pick.card).kind : null;
    const aims = new Set(attacking ? options.filter((a) => a.type === "attack" && a.slot === pick.troop).map((a) => a.target)
      : kind === "spell" ? playsOf(pick.card).map((a) => a.target) : []);
    const carriers = new Set(kind === "gear" ? playsOf(pick.card).map((a) => a.slot) : []);
    // Legal attacks describe the outcome as well as the shared aiming prompt.
    const aiming = attacking || kind === "spell" ? ' aria-describedby="sd-prompt"' : "";
    const targetDescription = (target) => attacking && aims.has(target)
      ? ` aria-describedby="${previewId(target)} sd-prompt"` : aiming;

    const raising = pick?.tributes && has(pick.card, "raise");
    const row = (side) => {
      const s = view.sides[side];
      const isOwn = side === own;
      const baseOpen = !isOwn && aims.has("base");
      const traps = isOwn && !shared ? (s.traps.length ? `Set: ${s.traps.map(name).join(", ")}` : "No trap set") : s.trapCount ? `${plural(s.trapCount, "card")} face down` : "Nothing face down";
      // The other seat's hand is card backs (the deck back's .card-back element) and a count, never faces.
      const backs = isOwn ? "" : `<span class="sd-backs" role="img" aria-label="${FACTION[side]} hand: ${plural(s.handCount, "card")}, face down">${'<span class="card-back" aria-hidden="true"></span>'.repeat(s.handCount)}</span>`;
      const base = `<button type="button" class="sd-base ${side}${baseOpen ? " sd-can" : ""}" ${baseOpen ? 'data-enemy="base"' : "disabled"}${isOwn ? "" : targetDescription("base")} data-base="${side}">
        <strong>${whoseBase(side)} Base</strong>${orbs(s.base, s.baseMax)}
        <span class="sd-note">Hand ${s.handCount} · Deck ${s.deckCount} · Graveyard ${s.discard.length}</span>${backs}
        <span class="sd-note">▲ ${traps}</span>${baseOpen ? preview(view, "base") : ""}</button>`;
      const slots = s.board.map((troop, slot) => {
        if (!troop) return `<button type="button" class="sd-slot ${side}" data-slot="${side}-${slot}" disabled><span class="sd-note">empty</span></button>`;
        const card = cardOf(troop.cardId);
        let cls = "", data = "disabled", note = troop.cover ? "In cover" : troop.stunned ? "Stunned" : "";
        if (isOwn && mine) {
          const tribute = pick?.tributes && playsOf(pick.card).some((a) => a.tributes.includes(slot));
          const ready = canAttack(view, troop);
          const actable = options.some((a) => (a.type === "attack" || a.type === "cover") && a.slot === slot);
          if (tribute) { cls = pick.tributes.includes(slot) ? " sd-chosen" : " sd-can"; data = `data-own="${slot}"` + (raising ? ' aria-describedby="sd-prompt"' : ""); note = "Tribute"; }
          else if (carriers.has(slot)) { cls = " sd-can"; data = `data-own="${slot}"`; note = "Give it the gear"; }
          else if (pick?.troop === slot) { cls = " sd-pick"; note = ready ? "Choose a target, or take cover" : "It can take cover"; }
          else if (!pick && actable) { cls = " sd-can"; data = `data-own="${slot}"`; note = ready ? "Can attack" : "Can take cover"; }
          else if (troop.arrived === view.turn && !ready && !troop.attacked) note = note || "Rests the turn it arrives";
          else if (troop.attacked && !troop.cover) note = "Has attacked";
        } else if (!isOwn && aims.has(slot)) {
          cls = " sd-can"; data = `data-enemy="${slot}"`;
          if (kind === "spell") note = cardOf(pick.card).effect === "tie" ? "Would be stunned" : troop.health === 1 ? "Would be defeated" : `Would drop to ${troop.health - 1}`;
        }
        const attack = attackOf(view, troop);
        return `<button type="button" class="sd-slot ${side}${cls}" data-frame="troop" data-slot="${side}-${slot}" ${data}${isOwn ? "" : targetDescription(slot)}><strong>${card.name}</strong><span class="sd-type">${FRAME.troop.mark} Troop · ${card.tag}</span>
          ${attack} attack${attack !== card.attack ? ` (+${attack - card.attack})` : ""} ${orbs(troop.health, card.health)} ${keywords(card)}
          ${troop.gear.length ? `<span class="sd-note">◆ ${troop.gear.map(name).join(", ")}</span>` : ""}${note ? `<span class="sd-note">${note}</span>` : ""}${!isOwn && attacking && aims.has(slot) ? preview(view, slot) : ""}</button>`;
      }).join("");
      return `<div class="sd-side" data-side="${side}">${base}${slots}</div>`;
    };
    $("sd-board").innerHTML = row(foe) + row(own);
    const landing = view.arrivals.map((due) => `${TYPES[due.type].name} lands at the start of turn ${Math.max(due.turn, view.turn + (view.active === due.side ? 2 : 1))}.`).join(" ");
    $("sd-location").textContent = landing + (landing && view.location ? " " : "") + (view.location ? `■ Location: ${name(view.location.cardId)}. ${EFFECTS[cardOf(view.location.cardId).effect].text.replace("Location. ", "")}` : "");

    const playable = new Set(options.filter((a) => a.cardId).map((a) => name(a.cardId)));
    $("sd-hand").innerHTML = (shared ? [] : view.sides[own].hand).map((cardId) => {
      const card = cardOf(cardId);
      const on = playable.has(card.name);
      return `<button type="button" class="sd-card ${card.side} ${card.rarity}${pick?.card === cardId ? " sd-pick" : on ? " sd-can" : ""}" data-frame="${card.kind}" data-card="${cardId}" ${on ? "" : "disabled"}>
        ${face(typeOf(cardId), mine && !on ? `<span class="sd-note sd-warn">${blocked(view, cardId)}</span>` : "")}</button>`;
    }).join("");

    const r = view.result;
    // data-series: the illustrated table (showdown-3d/table-ui.js) draws this same tally where the player can see it.
    const score = match ? ` · <span data-series>game ${match.game} of 3 · ${solo() ? `you ${match.wins[own]}, ${sides(foe)} ${match.wins[foe]}` : `Cowboys ${match.wins.cowboy}, Wizards ${match.wins.wizard}`}</span>` : "";
    const verdict = !r ? "" : r.winner === null ? "Draw." : !solo() ? `The ${sides(r.winner)} win: the ${FACTION[opponent(r.winner)]} Base fell.`
      : r.winner === own ? `You win: the ${FACTION[foe]} Base fell.` : "You lose: your Base fell.";
    $("sd-status").innerHTML = r ? `<span class="sd-result ${!solo() || r.winner === own ? "sd-good" : "sd-warn"}">${verdict}</span>${score}`
      : `${duel.name}${score} · turn ${view.turn} · ${solo() ? (view.active === own ? "your turn" : `the ${sides(foe)}' turn`) : `the ${sides(view.active)}' turn`}`;
    $("sd-feedback").textContent = session.failure?.() ? `The lesson Wizard stopped: ${session.failure()} Use Back to camp or Restart this duel.`
      : latest.length ? `Last: ${latest.join(" ")}` : "";
    $("sd-result").innerHTML = r ? rewardPanel() : "";

    const canCover = attacking && options.some((a) => a.type === "cover" && a.slot === pick.troop);
    const guarded = view.sides[foe].board.some((troop) => troop && has(troop.cardId, "guard"));
    $("sd-prompt").textContent = r ? "" : pick?.tributes ? `Choose ${tributes(pick.card)} of your troops to send to the graveyard as payment for ${name(pick.card)}.`
      : kind === "gear" ? `Choose one of your troops to carry ${name(pick.card)}.`
      : kind === "spell" ? `Choose an enemy troop for ${name(pick.card)}.`
      : attacking ? (aims.size === 0 ? "This troop cannot attack now." : guarded ? "A Guard stands in the way: attack it first." : aims.has("base") && aims.size === 1 ? "No enemy troops: strike the Base." : "Choose what to attack.")
      : view.attacking ? "No more cards this turn. Act with your other troops, or end the turn."
      : view.turn === 1 ? "Play your cards: one troop a turn. Nobody attacks on the opening turn."
      : "First play cards (one troop, one other card). Then act with your troops. Once a troop acts, no more cards this turn.";
    let hint = "";
    if (raising) {
      $("sd-prompt").textContent = `Choose a tribute for ${name(pick.card)}.`;
      hint = raisePaymentHint(view.sides[own], playsOf(pick.card));
    } else if (attacking && aims.size && view.sides[foe].trapCount) {
      hint = "A face-down trap springs before damage.";
    }
    if (hint) {
      const detail = document.createElement("span");
      detail.className = "sd-choice-hint";
      detail.textContent = " " + hint;
      $("sd-prompt").append(detail);
    }
    // The cover choice comes after the attack's trap hint, so the hint reads as part of the attack. With no attack, it starts with the button's name.
    if (canCover) $("sd-prompt").append(` ${aims.size ? "Or take" : "Take"} cover: until your next turn it keeps extra damage off your Base, but it will not hit back.`);
    $("sd-end").hidden = Boolean(r);
    $("sd-end").disabled = !options.some((a) => a.type === "end");
    showChallengeChoices();
    $("sd-cover").hidden = !canCover;
    $("sd-cancel").hidden = !pick;
    $("sd-restart").hidden = Boolean(r);
    $("sd-log").innerHTML = lines.map((l, i) => `<li data-line="${i}"${l.cue ? ` data-cue-kind="${l.cue}"` : ""}${l.turn ? ' class="sd-turn"' : ""}>${l.text}</li>`).join("");
    $("sd-log").scrollTop = $("sd-log").scrollHeight;
    for (const side of ["cowboy", "wizard"]) $(`sd-${side}-graveyard`).textContent = view.sides[side].discard.map(name).join(", ") || "empty";
    // Keywords from the duel's two public deck lists, so the list never depends on a hidden card.
    const inPlay = new Set(Object.values(duel.options.decks).flatMap((counts) => Object.keys(counts)).flatMap((type) => TYPES[type].keys ?? []));
    $("sd-keywords").innerHTML = Object.entries(KEYWORDS).filter(([key]) => inPlay.has(key)).map(([, [word, rule]]) => `<li><strong>${word}.</strong> ${rule}</li>`).join("")
      || "<li>No keywords in this duel.</li>";
    cues.paint();
    boardPresentation?.paint(view,presentationStart);
    if (lost && !root.hidden) usable("#sd-hand button", "#sd-board [data-own]", "#sd-end", "#sd-result button")?.focus();
  }

  // Each render replaces the board and hand buttons, which drops keyboard focus. After a keyboard
  // activation (a click with detail 0, or Escape) focus goes to the next usable button: a new pick's
  // first legal choice, back to what opened a cancelled pick, the same button, or the next thing to
  // play. A mouse click (detail 1 or more) never moves focus, and Escape moves it only from a duel button.
  let origin = null; // the button that opened the current pick
  const pickKey = (p) => p ? p.card ?? `troop-${p.troop}` : null;
  const keyOf = (b) => !b || !root.contains(b) ? null : b.id ? `#${b.id}`
    : b.dataset.card ? `[data-card="${b.dataset.card}"]` : b.dataset.slot ? `[data-slot="${b.dataset.slot}"]` : b.dataset.base ? `[data-base="${b.dataset.base}"]` : null;
  // The first enabled, shown match of the earliest selector in the list that has one.
  const usable = (...selectors) => {
    for (const selector of selectors) {
      const found = selector && [...root.querySelectorAll(selector)].find((n) => !n.disabled && !n.hidden && n.getClientRects().length > 0);
      if (found) return found;
    }
    return null;
  };
  const pickStarted = (before) => pickKey(pick) !== null && pickKey(pick) !== pickKey(before);
  function refocus(key, before) {
    if (root.hidden) return;
    if (curtain) return $("sd-ready").focus();
    const next = (pickStarted(before) ? usable("#sd-board button", "#sd-cover", "#sd-cancel") : null)
      ?? (before && !pick ? usable(origin) : null) ?? usable(key)
      ?? usable("#sd-hand button", "#sd-board [data-own]", "#sd-end", "#sd-result button", "#sd-home");
    if (next && next !== document.activeElement) next.focus();
  }

  root.addEventListener("click", (event) => {
    const b = event.target.closest("button");
    if (!b || b.disabled || !session || settling) return;
    const [key, before, keyboard] = [keyOf(b), pick, event.detail === 0];
    const d = b.dataset;
    if (d.card) clickCard(d.card);
    else if (d.own) clickOwn(Number(d.own));
    else if (d.enemy) clickEnemy(d.enemy === "base" ? "base" : Number(d.enemy));
    else if (b.id === "sd-end") act({type: "end"});
    else if (b.id === "sd-cover" && pick?.troop !== undefined) act(session.legal().find((a) => a.type === "cover" && a.slot === pick.troop));
    else if (b.id === "sd-cancel") { pick = null; render(); }
    else if (b.id === "sd-restart") {
      const replay = openingShot;
      deal(seed);
      if (keyboard && replay) {
        const rider = usable(`[data-own="${replay.slot}"]`);
        if (rider) { rider.focus(); return; }
      }
    }
    else if (b.id === "sd-ready" && curtain) { curtain = false; render(); }
    else if (d.choose && camp?.progress().offer?.includes(d.choose)) {
      const claim = () => {
        if (root.hidden || !root.contains(b)) return;
        camp.choose(d.choose);
        picked = d.choose;
        render();
        $("sd-camp")?.focus();
      };
      if (camp === campaign) writeCamp(claim);
      else claim();
    }
    else if (b.hasAttribute("data-build-reward") && picked && camp === campaign && onBuildReward) {
      cues.clear(); boardPresentation?.clear();
      onBuildReward(picked);
    }
    else if (b.id === "sd-again" && outcome) again();
    else if (b.id === "sd-review" && outcome && setup) {
      const view = session.view();
      cues.clear(); boardPresentation?.clear();
      onReview({seed, setup, cowboyActions: structuredClone(cowboyActions), expected: {result: view.result, turn: view.turn}});
    }
    else if (b.id === "sd-boot-hill" && onBootHill) {
      cues.clear(); boardPresentation?.clear();
      if (onBootHill() !== false && keyboard) {
        usable("#sd-hand button", "#sd-board [data-own]", "#sd-end", "#sd-result button", "#sd-home")?.focus();
        return;
      }
    }
    else if (b.id === "sd-lesson-back") { cues.clear(); boardPresentation?.clear(); onLessonBack(); }
    else if (b.id === "sd-home" || b.id === "sd-camp") { cues.clear(); boardPresentation?.clear(); onHome(); }
    if (pickStarted(before)) origin = key;
    if (keyboard) refocus(key, before);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && pick && !root.hidden) {
      const [key, before] = [keyOf(document.activeElement), pick];
      pick = null;
      render();
      if (key) refocus(key, before);
    }
  });
  return {start};
}

export const freshSeed = () => Math.floor(Math.random() * 100000);
