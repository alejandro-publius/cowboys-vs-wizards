import {cpuFor} from "./game/cpu.js";
import {deckIds, validateDeck} from "./game/deck-builder.js";
import {openingMatch, parseOpeningParams} from "./game/opening-policy.js";
import {clashLog} from "./match/clash-log.js";
import {createController, FABLE_ENGINE} from "./match/controller.js";
import {guideLine, guideProgress, trackGuide} from "./match/guide.js";
import {DEFAULT_PAUSES} from "./match/presenter.js";
import {createScheduler} from "./match/scheduler.js";
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
const opening = parseOpeningParams(params);
const hints = params.get("guide") === "1";
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

const engine = {
  ...FABLE_ENGINE,
  createMatch(seed) {
    run++;
    progress = guideProgress();
    roundEvents = [];
    latestClash = {title: "Latest clash", lines: ["End the turn to view both sides’ attacks."]};
    const counts = guided || params.get("deck") === "starter" ? null : profile.get().deck;
    const options = counts && validateDeck(counts).ok ? {cowboyDeck: deckIds(counts)} : {};
    return opening && !guided
      ? openingMatch(seed, opening.opening, opening.first, options)
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
    if (action.side === "cowboy" && ["summon", "spell"].includes(action.type)) {
      profile.record(action.type, {id: `${run}:${result.state.revision}`});
    }
    return result;
  },
};
const controller = createController({
  engine, renderer, scheduler, pauses, cpuDelay: 0,
  chooseCpuAction: cpuFor(params.get("cpu")),
  onChange() {
    const displayed = controller.displayed();
    const options = controller.options();
    const status = controller.status();
    if (status === "terminal") {
      profile.record("match-complete", {matchId: run, won: displayed.result.outcome === "win"});
    }
    const guide = (guided || hints) && options && displayed && status === "accepting_input"
      ? guideLine({view: displayed, options, progress})
      : null;
    const model = cardModel({
      displayed, options, status, guide, clashLog: latestClash,
      seed: controller.seed(), seedPinned: controller.seedPinned(), message: controller.message(),
    });
    model.prompt = model.prompt.replace("glowing card", "highlighted card");
    model.summonForecasts = status === "accepting_input" ? summonForecasts(displayed, options) : {};
    if (Object.keys(model.summonForecasts).length > 0) {
      model.prompt += " Clash preview assumes the rest of the board stays as shown.";
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
const overlay = mountCards(match, {
  onCard: (cardId) => input({type: "card", cardId}),
  onSlot: (side, slot) => input({type: "slot", side, slot}),
  onConfirm: () => input({type: "confirm"}),
  onCancel: () => input({type: "cancel"}),
  onSkip: () => input({type: "skip"}),
  onEndPhase: () => play(() => controller.endPhase()),
  onRestart: () => play(() => controller.restart()),
  onReplaySeed: (seed) => play(() => controller.start(seed)),
}, {plain: true});

const menu = mountTitleMenu(node("title-screen"), {
  profile,
  onPlay(startGuided) {
    menu.hide();
    arena.hidden = false;
    if (startGuided || ["idle", "terminal"].includes(controller.status())) {
      guided = startGuided;
      play(() => {
        if (!controller.start(guided ? "0" : params.get("seed") ?? undefined)) controller.start();
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
