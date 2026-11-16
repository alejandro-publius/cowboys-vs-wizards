// Match controller for Orb Duel: the only holder of full Engine state. It
// sequences human input (Cowboy), CPU turns (Wizard) and Presenter playback.
// No DOM, no rendering and no real timers: every timer and CPU request goes
// through the injected epoch scheduler, and the Presenter it builds drives the
// injected renderer.
//
// createController(...) returns:
//   start(seed?)    undefined: generate a seed. A safe integer, as a number or
//                   a string of digits with an optional minus: pin it. Anything
//                   else sets message() and returns false, leaving the match as is.
//   restart()       start() with the pinned seed, or with a newly generated one
//   leave()         mode switch away: cancel everything, clear the renderer, status idle
//   input(click)    a selection input (see selection.js); ignored unless accepting_input
//   endPhase(), submit(action)   { ok: false, reason: "busy" } unless accepting_input
//   status(), view() (the Player_View), displayed(), selection(), options(),
//   seed(), seedPinned(), message(), busy() (the Presenter is playing)
//
// status():
//   idle             before start() and after leave()
//   accepting_input  the Cowboy's phase with playback drained; the only status that takes input
//   submitting       a human action is with the Engine (synchronous)
//   playing          the Presenter is playing an accepted action's events
//   cpu_turn         the Wizard's phase with playback drained; a CPU request is queued
//   terminal         the match has a result and playback has drained
//   error            a development error; message() says what happened
//
// Cancellation: start(), restart() and leave() advance the scheduler epoch,
// which drops every pending timer, frame, impact callback and CPU request,
// then clear the Presenter, which calls renderer.clear(). The CPU step also
// checks the epoch itself: a restart with the same seed is back at revision 0
// with no recorded actionIds, so the Engine's stale check alone would accept
// an action meant for the old match.
import { createMatch } from "../game/state.js";
import { applyAction } from "../game/actions.js";
import { legalActions } from "../game/legal.js";
import { publicState } from "../game/view.js";
import { chooseAction } from "../game/cpu.js";
import { createPresenter } from "./presenter.js";
import { emptySelection, selectionOptions, selectionStep } from "./selection.js";

const HUMAN = "cowboy";
const CPU = "wizard";
const SEED_MESSAGE = "Seed must be a whole number.";

// Engine rejection reasons as short messages for the player.
const REJECTIONS = {
  "match-over": "The match is over.",
  "invalid-action": "That move is not valid.",
  "duplicate-action": "That move was already played.",
  stale: "The board has changed. Choose again.",
  "wrong-side": "It is not your phase.",
  "summon-used": "You have already summoned this round.",
  "summon-after-spell": "A spell was cast this round, and summons must come first.",
  "card-not-in-hand": "That card is not in your hand.",
  "not-a-troop": "That card is not a troop.",
  "invalid-tribute": "Those troops cannot be sacrificed.",
  unpaid: "Not enough tribute troops.",
  overpaid: "Too many tribute troops.",
  "invalid-slot": "Slot is invalid.",
  "slot-occupied": "That tile is occupied.",
  "cast-used": "You have already cast a spell this round.",
  "not-a-spell": "That card is not a spell.",
  "invalid-target": "That target is not valid.",
  "invalid-destination": "That destination is not valid.",
};
const readable = (reason) => REJECTIONS[reason] ?? `The move was refused (${reason}).`;

// A supplied seed: a safe integer, given as a number or as a string of digits
// with an optional leading minus. Returns null for anything else.
function parseSeed(seed) {
  if (typeof seed === "string" && !/^-?\d+$/.test(seed)) return null;
  if (typeof seed !== "string" && typeof seed !== "number") return null;
  const value = Number(seed);
  return Number.isSafeInteger(value) ? value : null;
}

const FABLE_ENGINE = Object.freeze({ createMatch, applyAction, legalActions, publicState });
const randomUint32 = () => crypto.getRandomValues(new Uint32Array(1))[0];

export function createController({
  engine = FABLE_ENGINE,
  chooseCpuAction = chooseAction,
  scheduler,
  renderer,
  pauses,
  randomSeed = randomUint32,
  cpuDelay = 600,
  onChange,
} = {}) {
  if (!scheduler || !renderer) throw new TypeError("createController needs a scheduler and a renderer");
  if (!Number.isFinite(cpuDelay) || cpuDelay < 0) {
    throw new RangeError(`cpuDelay must be a finite number >= 0, got ${cpuDelay}`);
  }

  let state = null; // full Engine state; it never leaves this module
  let status = "idle";
  let selection = emptySelection;
  let message = null;
  let seed = null;
  let seedPinned = false;
  let actionCount = 0; // reset per match, so actionIds are unique within a match

  const notify = () => onChange?.();
  const newActionId = () => `action-${++actionCount}`;
  const view = () => (state === null ? null : engine.publicState(state, HUMAN));

  function fail(text) {
    status = "error";
    message = text;
  }

  // Runs a step that calls injected code; a throw becomes a development error.
  function guarded(step) {
    try {
      return step();
    } catch (error) {
      fail(`Development error: ${error.message}`);
      return undefined;
    }
  }

  const presenter = createPresenter({
    scheduler,
    renderer,
    pauses,
    onChange: () => notify(),
    onDrain() {
      if (status !== "playing") return;
      decideNext();
      notify();
    },
    onError(error) {
      fail(error.message);
      notify();
    },
  });

  // After start() or a drain: the result, the human's phase, or a CPU request.
  function decideNext() {
    if (state.result) {
      status = "terminal";
    } else if (state.activeSide === HUMAN) {
      status = "accepting_input";
    } else {
      status = "cpu_turn";
      const epoch = scheduler.epoch();
      scheduler.after(cpuDelay, () => {
        if (scheduler.epoch() === epoch && status === "cpu_turn") cpuStep(epoch);
      });
    }
  }

  // A copy of `action` with an actionId unique within the match, unless it has one.
  function stamped(action) {
    if (action === null || typeof action !== "object") return action;
    const copy = structuredClone(action);
    if (copy.actionId === undefined) copy.actionId = newActionId();
    return copy;
  }

  // Applies one action for `side`. A human rejection returns to
  // accepting_input with a readable reason; a CPU rejection is a development error.
  function commit(action, side) {
    const result = engine.applyAction(state, stamped(action));
    if (!result.ok) {
      if (side === CPU) {
        fail(`Development error: the Engine rejected the CPU action (${result.reason}).`);
      } else {
        status = "accepting_input";
        message = readable(result.reason);
      }
      return { ok: false, reason: result.reason };
    }
    const from = view();
    state = result.state;
    selection = emptySelection;
    message = null;
    status = "playing"; // before enqueue, because a synchronous drain may change it
    presenter.enqueue({ from, to: view(), events: result.events });
    return { ok: true };
  }

  // One CPU action, chosen from the Wizard's public view only.
  function cpuStep(epoch) {
    guarded(() => {
      const action = chooseCpuAction(engine.publicState(state, CPU));
      // The CPU call may have restarted or left the match.
      if (scheduler.epoch() !== epoch || status !== "cpu_turn") return;
      if (action == null) return fail("Development error: the CPU chose no action during its own phase.");
      commit(action, CPU);
    });
    notify();
  }

  // `given` undefined: generate a seed. Otherwise pin it, after validation.
  function start(given) {
    const pinned = given !== undefined;
    const value = pinned ? parseSeed(given) : null;
    if (pinned && value === null) {
      message = SEED_MESSAGE;
      notify();
      return false;
    }
    scheduler.advance(); // drops every pending timer, frame, impact callback and CPU request
    presenter.clear(); // renderer.clear(): no troop, orb or result display survives
    selection = emptySelection;
    message = null;
    seedPinned = pinned;
    state = null;
    const started = guarded(() => {
      seed = pinned ? value : randomSeed();
      state = engine.createMatch(seed);
      actionCount = 0;
      status = "playing"; // the queue is empty; the next status is decided below
      const epoch = scheduler.epoch();
      presenter.reset(view());
      // A listener called during reset() may already have restarted or left.
      if (scheduler.epoch() === epoch) decideNext();
      return true;
    });
    notify();
    return started === true;
  }

  function leave() {
    scheduler.advance();
    presenter.clear();
    status = "idle";
    selection = emptySelection;
    message = null;
    notify();
  }

  function submit(action) {
    if (status !== "accepting_input") return { ok: false, reason: "busy" };
    status = "submitting";
    const outcome = guarded(() => commit(action, HUMAN)) ?? { ok: false, reason: "error" };
    notify();
    return outcome;
  }

  // A hand, slot, skip, confirm or cancel click.
  function input(event) {
    if (status !== "accepting_input") return;
    const step = selectionStep(selection, event, view(), { accepting: true, newActionId });
    selection = step.selection;
    message = step.message ?? null;
    if (step.action) submit(step.action);
    else notify();
  }

  function endPhase() {
    if (status !== "accepting_input") return { ok: false, reason: "busy" };
    selection = emptySelection;
    return submit(engine.legalActions(state, HUMAN).find((action) => action.type === "end-phase"));
  }

  return {
    start,
    restart: () => start(seedPinned ? seed : undefined),
    leave,
    input,
    endPhase,
    submit,
    status: () => status,
    view,
    displayed: () => presenter.displayed(),
    selection: () => selection,
    // Options for the current selection; act on them only while accepting_input.
    options: () => (state === null ? null : selectionOptions(selection, view())),
    seed: () => seed,
    seedPinned: () => seedPinned,
    message: () => message,
    busy: () => presenter.busy(),
  };
}
