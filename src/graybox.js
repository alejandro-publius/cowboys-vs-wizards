import {chooseAction, cpuFor} from "./game/cpu.js";
import {deckIds, validateDeck} from "./game/deck-builder.js";
import {BILLY_POSSE, DEADEYE_CONTROL} from "./game/deck-presets.js";
import {GRAYBOX_OPENINGS, openingMatch, parseOpeningParams} from "./game/opening-policy.js";
import {clashForecast} from "./match/clash-forecast.js";
import {clashLog} from "./match/clash-log.js";
import {createController, FABLE_ENGINE} from "./match/controller.js";
import {guideLine, guideProgress, trackGuide} from "./match/guide.js";
import {DEFAULT_PAUSES} from "./match/presenter.js";
import {createScheduler} from "./match/scheduler.js";
import {blockedReasons} from "./match/selection.js";
import {spellForecasts} from "./match/spell-forecast.js";
import {summonForecasts} from "./match/summon-forecast.js";
import {createProfileStore} from "./profile/player-profile.js";
import {cardModel} from "./ui/card-model.js";
import {mountCards} from "./ui/cards.js";
import {mountTitleMenu} from "./ui/title-menu.js";

const node = (id) => document.getElementById(id);
const arena = node("arena");
const match = node("match");
const profile = createProfileStore();
const params = new URLSearchParams(location.search);
// The graybox alone also accepts ?opening=freeOpener (guaranteed free opener).
const opening = parseOpeningParams(params, GRAYBOX_OPENINGS);
const FREE_OPENER_NOTE = "Free-opener test: an opening hand with no free summon swaps its last card for the top free troop in that deck.";
const hints = params.get("guide") === "1";
// How to Play → Start guided duel: starter deck, seed 60, Normal Wizard (docs/evidence/clash-royale-launch-decks.md).
const GUIDED_SEED = "60";
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
// Each match captures its configuration. Replay and draft starts can supply
// a configuration for exactly one call to createMatch.
let deal = null;
let nextDeal = null;

// Read at match creation, so a deck saved mid-match only affects later deals.
function freshDeal(seed) {
  const counts = guided || requestedDeck === "starter" ? null : pinnedPreset?.counts ?? profile.get().deck;
  const options = counts && validateDeck(counts).ok ? {cowboyDeck: deckIds(counts)} : {};
  return {seed, guided, opening: guided ? null : opening, options};
}

const engine = {
  ...FABLE_ENGINE,
  createMatch(seed) {
    run++;
    progress = guideProgress();
    roundEvents = [];
    latestClash = {title: "Latest clash", lines: ["End the turn to view both sides’ attacks."]};
    deal = nextDeal ? {...nextDeal, seed} : freshDeal(seed);
    nextDeal = null;
    const options = deal.options.cowboyDeck ? {cowboyDeck: [...deal.options.cowboyDeck]} : {};
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
      roundEvents = [];
    }
    if (!deal.isDraft && action.side === "cowboy" && ["summon", "spell"].includes(action.type)) {
      profile.record(action.type, {id: `${run}:${result.state.revision}`});
    }
    return result;
  },
};
const controller = createController({
  engine, renderer, scheduler, pauses, cpuDelay: 0,
  chooseCpuAction: (...args) => (guided ? chooseAction : chosenCpu)(...args),
  onChange() {
    const displayed = controller.displayed();
    const options = controller.options();
    const status = controller.status();
    if (status === "terminal" && !deal.isDraft) {
      profile.record("match-complete", {matchId: run, won: displayed.result.outcome === "win"});
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
    model.prompt = model.prompt.replace("glowing card", "highlighted card");
    // Shown for the deal actually being played, so Replay this deal keeps it.
    const openingNote = deal?.opening?.opening === "freeOpener" ? FREE_OPENER_NOTE : "";
    model.openingNote = deal?.isDraft ? `Trying an unsaved deck. ${openingNote}`.trim() : openingNote;
    model.clashForecast = status === "accepting_input" ? clashForecast(displayed, options) : null;
    model.summonForecasts = status === "accepting_input" ? summonForecasts(displayed, options) : {};
    if (Object.keys(model.summonForecasts).length > 0) {
      model.prompt += " Clash preview assumes the rest of the board stays as shown.";
    }
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
  return deal?.isDraft ? startWithDeal(deal, start) : play(start);
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
  guided = false;
  play(() => controller.start());
}
const overlay = mountCards(match, {
  onCard: (cardId) => input({type: "card", cardId}),
  onSlot: (side, slot) => input({type: "slot", side, slot}),
  onConfirm: () => input({type: "confirm"}),
  onCancel: () => input({type: "cancel"}),
  onSkip: () => input({type: "skip"}),
  onEndPhase: () => play(() => controller.endPhase()),
  onRestart: () => restartCurrent(() => controller.restart()),
  onReplaySeed: (seed) => restartCurrent(() => controller.start(seed)),
  onReplayDeal: replayDeal,
  onNewDuel: newDuel,
}, {plain: true});

const menu = mountTitleMenu(node("title-screen"), {
  profile,
  onTryDraft(counts) {
    if (!["idle", "terminal"].includes(controller.status()) || !validateDeck(counts).ok) {
      throw new Error("A deck draft requires a legal deck and no match in progress.");
    }
    guided = false;
    const trial = {guided, opening, options: {cowboyDeck: deckIds(counts)}, isDraft: true};
    if (!startWithDeal(trial, () => controller.start(params.get("seed") ?? undefined) || controller.start())) {
      throw new Error("The trial duel could not start.");
    }
    menu.hide();
    arena.hidden = false;
    node("home").focus();
  },
  onPlay(startGuided) {
    menu.hide();
    arena.hidden = false;
    if (startGuided || ["idle", "terminal"].includes(controller.status())) {
      guided = startGuided;
      play(() => {
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
if (params.get("mode") === "match") node("menu-play").click();
