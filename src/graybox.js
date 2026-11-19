import {chooseAction, cpuFor} from "./game/cpu.js";
import {bossOfHunt, clearedFor, createHunt, earnedRewards, HUNT_GOAL, HUNTS_BY_ID, rewardEarned} from "./game/bounty-hunt.js";
import {CARDS, tributeCost} from "./game/cards.js";
import {deckIds, validateDeck} from "./game/deck-builder.js";
import {BILLY_POSSE, DEADEYE_CONTROL, IMP_DECK, IMP_NAME, STARGAZER_DECK, STARGAZER_NAME, WRAITH_POSSE, frontierUnlocked} from "./game/deck-presets.js";
import {GRAYBOX_OPENINGS, openingMatch, parseOpeningParams} from "./game/opening-policy.js";
import {clashForecast, rideForecasts} from "./match/clash-forecast.js";
import {clashLog} from "./match/clash-log.js";
import {createController, FABLE_ENGINE} from "./match/controller.js";
import {guideLine, guideProgress, trackGuide} from "./match/guide.js";
import {DEFAULT_PAUSES} from "./match/presenter.js";
import {createRideOutLesson, RIDE_OUT_LESSON_SEED} from "./match/ride-out-lesson.js";
import {createScheduler} from "./match/scheduler.js";
import {blockedReasons} from "./match/selection.js";
import {spellForecasts} from "./match/spell-forecast.js";
import {summonForecasts} from "./match/summon-forecast.js";
import {createProfileStore} from "./profile/player-profile.js";
import {cardModel} from "./ui/card-model.js";
import {mountCards} from "./ui/cards.js";
import {mountTitleMenu} from "./ui/title-menu.js";
import {WRAITH_NOTICE_ORDER} from "./ui/wanted-board.js";

const node = (id) => document.getElementById(id);
const arena = node("arena");
const match = node("match");
const profile = createProfileStore();
const params = new URLSearchParams(location.search);
// The graybox alone also accepts ?opening=freeOpener (guaranteed free opener).
const opening = parseOpeningParams(params, GRAYBOX_OPENINGS);
const FREE_OPENER_NOTE = "Free-opener test: an opening hand with no free summon swaps its last card for the top free troop in that deck.";
const hints = params.get("guide") === "1";
// ?wizard=stargazer and ?wizard=imp are explicit test/replay selections, separate from the menu entitlement.
// Optional Wizard opponents: the validated wizardDeck list and its name.
const OPPONENTS = {stargazer: {deck: STARGAZER_DECK, name: STARGAZER_NAME}, imp: {deck: IMP_DECK, name: IMP_NAME}};
const queryOpponent = params.get("wizard");
const wantsRideOut = params.get("rideOut") === "1";
const RIDE_OUT_NOTE = "Summon or Ride Out this turn. You can cast a spell afterward.";
// How to Play → Start guided duel: starter deck, seed 690, Normal Wizard
// (Fable 5.2 first-session brief, .artifacts/coordination/first-ten-minutes-kiro-brief.md).
// Seed 60 and every other seed stay reachable by ?seed= and the seed links.
const GUIDED_SEED = "690";
// Fable 5.2 first-session brief §3: an unsaved, entitled draft on a fixed deal. No Ride Out.
const POSSE_SEED = "2328";
const POSSE_NOTE = "Wraith Posse: Captured Wraith joins in place of one Sheriff. It is free to summon, hits for 2 and has 2 orbs. Troops hold their lanes; only cards marked Ride can Ride.";
const WRAITH_NOTICE_TEXT = "A notice is up on the Wanted board: the Lantern Wraith.";
const chosenCpu = cpuFor(params.get("cpu"));
const requestedDeck = params.get("deck");
const pinnedPreset = new Map([["billy-posse", BILLY_POSSE], ["deadeye-control", DEADEYE_CONTROL]]).get(requestedDeck);
const scheduler = createScheduler();
const instant = () => ({impact: 0, end: 0});
// The overlay reads the presenter's displayed state. The renderer has no shadow copy of the rules or board.
const renderer = {
  reset() {}, clear() {}, setTroopOrbs() {}, setBaseOrbs() {},
  summon: instant, spell: instant, attack: instant, move: instant, remove: instant,
};
const pauses = Object.fromEntries(Object.keys(DEFAULT_PAUSES).map((kind) => [kind, 0]));
let guided = false;
let progress = guideProgress();
let run = 0;
let roundEvents = [];
let latestClash = null;
// Completed clash summaries of this deal, oldest first; reset in createMatch.
let clashHistory = [];
// Each match captures its configuration. Replay and draft starts can supply
// a configuration for exactly one call to createMatch.
let deal = null;
let nextDeal = null;
// The run whose capture first finished all five Wraith notices.
let wraithFinishedRun = null;
let capturedRun = null;
let resultGo = null;

// Only the rewards this profile has earned may enter a deck.
const deckEntitlement = () => {
  const saved = profile.get();
  return {rewards: earnedRewards(saved), frontierCards: frontierUnlocked(saved)};
};

// Read at match creation, so a deck saved mid-match only affects later deals.
function freshDeal(seed, opponent = null) {
  const counts = guided || requestedDeck === "starter" ? null : pinnedPreset?.counts ?? profile.get().deck;
  const options = {rideOut: !guided && (wantsRideOut || (!deal?.hunt && deal?.options.rideOut === true))};
  const challenger = !guided && Object.hasOwn(OPPONENTS, opponent) ? opponent : null;
  if (challenger) options.wizardDeck = OPPONENTS[challenger].deck;
  const entitlement = deckEntitlement();
  if (counts && validateDeck(counts, entitlement).ok) options.cowboyDeck = deckIds(counts, entitlement);
  return {seed, guided, opening: guided ? null : opening, options, opponent: challenger};
}

const engine = {
  ...FABLE_ENGINE,
  createMatch(seed) {
    run++;
    progress = guideProgress();
    roundEvents = [];
    clashHistory = [];
    latestClash = {title: "Latest clash", lines: ["End the turn to view both sides’ attacks."]};
    deal = nextDeal ? {...nextDeal, seed} : freshDeal(seed);
    nextDeal = null;
    if (deal.rideLesson) return createRideOutLesson();
    if (deal.hunt) return createHunt(deal.hunt);
    const options = { ...deal.options };
    return deal.opening
      ? openingMatch(seed, deal.opening.opening, deal.opening.first, options)
      : FABLE_ENGINE.createMatch(seed, options);
  },
  applyAction(state, action) {
    const result = FABLE_ENGINE.applyAction(state, action);
    if (!result.ok) return result;
    if (guided || hints) progress = trackGuide(progress, result.events);
    roundEvents.push(...result.events);
    const log = clashLog(roundEvents);
    if (log) {
      latestClash = log;
      clashHistory.push(log);
      roundEvents = [];
    }
    if (!deal.isDraft && !deal.rideLesson && !deal.hunt && action.side === "cowboy" && ["summon", "spell"].includes(action.type)) {
      profile.record(action.type, {id: `${run}:${result.state.revision}`});
    }
    return result;
  },
};
// Result-screen line and primary button for the Wraith arc (Fable 5.2 first-session brief §2-3).
function resultExtras(displayed, hunted, boss) {
  const reward = CARDS["cowboy-captured-wraith-1"];
  if (deal.hunt && boss.id === "lantern-wraith" && displayed.result.reason === "bounty-captured") {
    if (wraithFinishedRun === run) {
      return {
        resultNote: `${reward.name} joins your collection: ${tributeCost(reward.stars) ? `${tributeCost(reward.stars)} tribute` : "free to summon"}, ${reward.attack} attack, ${reward.health} orbs.`,
        resultGo: {label: "Duel with the Wraith Posse", start: startPosse},
      };
    }
    const next = WRAITH_NOTICE_ORDER.find((id) => !hunted.clearedHunts.includes(id));
    return next ? {resultGo: {label: `Next notice: ${HUNTS_BY_ID.get(next).name}`, start: () => startHunt(next)}} : {};
  }
  if (deal.posse) {
    return displayed.result.outcome === "win" ? {resultNote: "Next on the Wanted board: the Graveyard Dragon."} : {};
  }
  // The first counted result of the profile, any outcome, before any hunt is cleared.
  const saved = profile.get();
  if (!deal.hunt && !deal.isDraft && !deal.rideLesson && saved.stats.matches === 1 && saved.clearedHunts.length === 0) {
    return {resultNote: WRAITH_NOTICE_TEXT, resultGo: {label: "Take the notice", start: () => startHunt(WRAITH_NOTICE_ORDER[0])}};
  }
  return {};
}

const controller = createController({
  engine, renderer, scheduler, pauses, cpuDelay: 0,
  chooseCpuAction(view) {
    // The notice shows the whole enemy formation. Monsters strike at the clash.
    if (deal?.hunt) return FABLE_ENGINE.legalActions(view, "wizard").at(-1);
    return (guided || deal?.posse ? chooseAction : chosenCpu)(view);
  },
  onChange() {
    const displayed = controller.displayed();
    const options = controller.options();
    const status = controller.status();
    if (status === "terminal") {
      if (deal.hunt && displayed.result.reason === "bounty-captured") {
        // Decide once per run, before recording, whether this capture finishes the Wraith's five.
        if (capturedRun !== run) {
          capturedRun = run;
          const before = profile.get();
          const wraith = bossOfHunt(deal.hunt.id);
          wraithFinishedRun = wraith.id === "lantern-wraith" && !before.clearedHunts.includes(deal.hunt.id)
            && clearedFor(before, wraith) === HUNT_GOAL - 1 ? run : null;
        }
        profile.recordBounty(deal.hunt.id, {clean: displayed.sides.cowboy.baseOrbs === deal.hunt.cowboyBase});
      } else if (!deal.hunt && !deal.isDraft && !deal.rideLesson) {
        profile.record("match-complete", {matchId: run, won: displayed.result.outcome === "win"});
      }
    }
    const guide = (guided || hints) && options && displayed && status === "accepting_input"
      ? guideLine({view: displayed, options, progress, opener: guided})
      : null;
    const model = cardModel({
      displayed, options, status, guide, clashLog: latestClash,
      seed: controller.seed(), seedPinned: controller.seedPinned(), message: controller.message(),
      // Each unplayable hand card shows the reason a click on it would give.
      blockedReasons: status === "accepting_input" && displayed ? blockedReasons(displayed) : {},
    });
    // Every completed clash but the latest, newest first (the latest stays in its own summary).
    model.clashHistory = clashHistory.slice(0, -1).reverse();
    model.prompt = model.prompt.replace("glowing card", "highlighted card");
    const lessonChoice = deal?.rideLesson && displayed?.round === 2
      && !displayed.allowances.cowboy.summonUsed && !displayed.allowances.cowboy.castUsed;
    model.bounty = Boolean(deal?.hunt);
    const saved = model.bounty ? profile.get() : null;
    const boss = model.bounty ? bossOfHunt(deal.hunt.id) : null;
    const huntProgress = status === "terminal" && model.bounty
      ? `${clearedFor(saved, boss)} / ${HUNT_GOAL} ${boss.name} hunts cleared.`
        + (rewardEarned(saved, boss) ? ` ${CARDS[`${boss.reward}-1`].name} is ready in Build Deck.` : "")
      : `Defeat the wanted ${CARDS[boss?.card]?.name ?? "Dragon"} while your Base stands.`
        + (deal?.hunt?.markLane !== undefined ? " Watch the marked Wizard lane before the first clash." : "");
    model.openingNote = [
      model.bounty && `${deal.hunt.name}. ${huntProgress}`,
      deal?.opponent && `Opponent: ${OPPONENTS[deal.opponent].name}.`,
      deal?.isDraft && "Trying an unsaved deck.",
      deal?.posse && displayed?.round === 1 && POSSE_NOTE,
      deal?.opening?.opening === "freeOpener" && FREE_OPENER_NOTE,
      displayed?.rideOut?.enabled ? RIDE_OUT_NOTE
        : (model.ride?.available || model.ride?.choosing) && "Summon or Ride this turn. You can cast a spell afterward.",
      lessonChoice && "Hold the lane, ride into the open lane, or tribute the wounded Sheriff for Billy.",
    ].filter(Boolean).join(" ");
    model.clashForecast = status === "accepting_input" ? clashForecast(displayed, options) : null;
    Object.assign(model, status === "terminal" ? resultExtras(displayed, saved, boss) : {});
    resultGo = model.resultGo ?? null;
    model.summonForecasts = status === "accepting_input" ? summonForecasts(displayed, options) : {};
    if (Object.keys(model.summonForecasts).length > 0) {
      model.prompt += " Clash preview assumes the rest of the board stays as shown.";
    }
    model.rideForecasts = status === "accepting_input" ? rideForecasts(displayed, options) : {};
    model.spellForecasts = status === "accepting_input" ? spellForecasts(displayed, options) : {};
    if (Object.keys(model.spellForecasts).length > 0) {
      model.prompt += " Shot preview assumes no Wizard reply before the clash.";
    }
    overlay.render(model);
  },
});

function play(action) {
  const result = action();
  // Zero-delay callbacks still go through the original scheduler and epoch checks.
  scheduler.tick(scheduler.now());
  return result;
}
const input = (event) => play(() => controller.input(event));
function startWithDeal(configuration, start) {
  nextDeal = configuration;
  try {
    return play(start);
  } finally {
    nextDeal = null;
  }
}
function restartCurrent(start) {
  const useCurrentDeal = deal?.isDraft || deal?.rideLesson || deal?.hunt || deal?.options.wizardDeck;
  return useCurrentDeal ? startWithDeal(deal, start) : play(start);
}
// Result screen: the completed match's seed, deck, CPU/opening and guided setting.
function replayDeal() {
  if (controller.status() !== "terminal" || !deal) return;
  guided = deal.guided;
  startWithDeal(deal, () => controller.start(deal.seed));
}
// Result screen: a generated seed and the latest saved deck, outside the guided lesson.
function newDuel() {
  if (controller.status() !== "terminal") return;
  if (deal.hunt) {
    arena.hidden = true;
    menu.show();
    node("menu-wanted").click();
    return;
  }
  guided = false;
  // New duel keeps the finished duel's opponent; after a draft or the posse it is the default.
  startWithDeal(freshDeal(null, deal.opponent), () => controller.start());
}
const overlay = mountCards(match, {
  onCard: (cardId) => input({type: "card", cardId}),
  onSlot: (side, slot) => input({type: "slot", side, slot}),
  onConfirm: () => input({type: "confirm"}),
  onCancel: () => input({type: "cancel"}),
  onSkip: () => input({type: "skip"}),
  onRideOut: () => input({type: "ride-out"}),
  onEndPhase: () => play(() => controller.endPhase()),
  onRestart: () => restartCurrent(() => controller.restart()),
  onReplaySeed: (seed) => {
    if (deal?.hunt) return;
    return deal?.rideLesson ? play(() => controller.start(seed)) : restartCurrent(() => controller.start(seed));
  },
  onReplayDeal: replayDeal,
  onNewDuel: newDuel,
  onResultGo: () => resultGo?.start(),
}, {plain: true});

function tryRideOut() {
  if (!["idle", "terminal"].includes(controller.status())) return;
  guided = false;
  const lesson = {guided, options: {rideOut: true}, rideLesson: true, opening: null};
  if (!startWithDeal(lesson, () => controller.start(RIDE_OUT_LESSON_SEED))) {
    throw new Error("The Ride Out duel could not start.");
  }
  menu.hide();
  arena.hidden = false;
  node("home").focus();
}

function startHunt(id) {
  const hunt = HUNTS_BY_ID.get(id);
  if (!hunt || !["idle", "terminal"].includes(controller.status())) return;
  guided = false;
  if (!startWithDeal({hunt, guided, options: {rideOut: true}}, () => controller.start(hunt.seed))) {
    throw new Error("The hunt could not start.");
  }
  menu.hide();
  arena.hidden = false;
  node("home").focus();
}

function startPosse() {
  if (!["idle", "terminal"].includes(controller.status())) return;
  const entitlement = deckEntitlement();
  // Explicit options: no hunt-wide or ?rideOut=1 setting carries into this standard duel.
  const posse = {seed: POSSE_SEED, guided: false, opening: null, isDraft: true, posse: true,
    options: {rideOut: false, cowboyDeck: deckIds(WRAITH_POSSE, entitlement)}};
  guided = false;
  if (!startWithDeal(posse, () => controller.start(POSSE_SEED))) {
    throw new Error("The Wraith Posse duel could not start.");
  }
  menu.hide();
  arena.hidden = false;
  node("home").focus();
}

const menu = mountTitleMenu(node("title-screen"), {
  profile,
  onTryRideOut: tryRideOut,
  onHunt: startHunt,
  onTryDraft(counts) {
    const entitlement = deckEntitlement();
    if (!["idle", "terminal"].includes(controller.status()) || !validateDeck(counts, entitlement).ok) {
      throw new Error("A deck draft requires a legal deck and no match in progress.");
    }
    guided = false;
    const trial = freshDeal(null);
    trial.isDraft = true;
    trial.options.cowboyDeck = deckIds(counts, entitlement);
    if (!startWithDeal(trial, () => controller.start(params.get("seed") ?? undefined) || controller.start())) {
      throw new Error("The trial duel could not start.");
    }
    menu.hide();
    arena.hidden = false;
    node("home").focus();
  },
  onPlay(startGuided, opponent = null) {
    menu.hide();
    arena.hidden = false;
    if (startGuided || ["idle", "terminal"].includes(controller.status())) {
      guided = startGuided;
      startWithDeal(freshDeal(null, opponent ?? queryOpponent), () => {
        if (!controller.start(guided ? GUIDED_SEED : params.get("seed") ?? undefined)) controller.start();
      });
    }
    node("home").focus();
  },
});
node("home").addEventListener("click", () => {
  arena.hidden = true;
  menu.show({resume: controller.status() !== "terminal"});
});
document.addEventListener("keydown", (event) => {
  if (arena.hidden || event.key !== "Escape" || event.repeat || event.defaultPrevented || event.isComposing) return;
  if (document.querySelector("dialog[open]") || event.target.closest?.("input, textarea, select, [contenteditable]")) return;
  if (!controller.options()?.canCancel) return;
  input({type: "cancel"});
  event.preventDefault();
});
if (params.get("mode") === "ride-out") tryRideOut();
else if (params.get("mode") === "match") node("menu-play").click();
