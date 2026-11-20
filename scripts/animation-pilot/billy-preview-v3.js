// Isolated Billy v3 preview: sourced Pistol_Idle_Loop -> sourced Pistol_Shoot -> sourced idle (Quaternius UAL, CC0).
// Uses the production board, board camera (src/render/match-camera.js), closeUp camera, materials and perimeter
// unchanged. The existing procedural attack cue (src/render/cues.js) is NOT used for the shot; it is only called
// inside teardown() to prove its timers are released. Production entry points and defaults are untouched.
//
// Deterministic by design: ?capture=1 stops the animation loop; window.__pilot.advance(ms) moves the page clock,
// both Billys' own mixers, the scheduler and the render by exactly that much. Without it the page plays live.
// Layout: left = existing board camera (both Billys), right = existing closeUp camera on Billy A (zoomed).
import * as T from "three";
import {loadAssets} from "../../src/render/scene.js";
import {arenaModelNames, perimeterModelNames} from "../../src/render/model-assets.js";
import {addPerimeter, loadGroundTexture} from "../../src/render/perimeter.js";
import {createMatchBoard} from "../../src/render/match-board.js";
import {withCues} from "../../src/render/cues.js";
import {createScheduler} from "../../src/match/scheduler.js";
import {grip} from "../../src/render/rig.js";
import {FADE_SECONDS, IDLE_DURATION, SHOOT_DURATION, SHOOT_TIME_SCALE, createBillyMotion} from "./billy-pilot-shoot.js";

const params = new URLSearchParams(location.search);
const capture = params.has("capture");
const W = 1280, H = 720, LEFT = 800;
const SHOOT_AT = {A: 3.5, B: 8.0}, PHASE = {A: 0, B: .8};     // page-clock seconds; Billy B idles 0.8 s out of phase
const TOTAL = 13.5;
const MODEL_ROOT = "./models/";

const state = document.getElementById("state");
const renderer = new T.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.setScissorTest(true);
document.getElementById("stage").append(renderer.domElement);

const source = Object.fromEntries([...arenaModelNames, ...perimeterModelNames].map((name) => [name, {url: `${MODEL_ROOT}${name}.glb`}]));
const [models, corners, ground] = await Promise.all([loadAssets(source, arenaModelNames), loadAssets(source, perimeterModelNames), loadGroundTexture()]);
const scheduler = createScheduler();
const board = await createMatchBoard({models, scheduler});
addPerimeter(board.scene, corners, ground);
const cued = withCues(board);

board.resize(LEFT, H, 0);
const boardCam = board.camera.clone();
board.resize(W - LEFT, H, 0);
board.closeUp("cowboy", 0);
const closeCam = board.camera.clone();
closeCam.zoom = 5.2;
closeCam.updateProjectionMatrix();

let clock = 0;
const log = {frames: [], events: [], errors: []};
window.addEventListener("error", (event) => log.errors.push(String(event.message)));
const motions = new Map();                          // "A"/"B" -> {motion, piece}
const disposedPieces = new WeakSet();
const view = {sides: {
  cowboy: {board: [{cardId: "cowboy-billy-1", health: 3}, null, {cardId: "cowboy-billy-2", health: 3}], baseOrbs: 5},
  wizard: {board: [{cardId: "wizard-wizard-1", health: 3}, null, null], baseOrbs: 5},
}};

function start() {
  scheduler.tick(clock * 1000);
  board.reset(view);
  for (const [name, slot] of [["A", 0], ["B", 2]]) {
    const piece = board.piece("cowboy", slot), motion = createBillyMotion(piece.actor, piece.gun);
    motion.setIdlePhase(PHASE[name]);
    motions.set(name, {motion, piece, fired: false});
    piece.actor.body.onBeforeRender = () => {};     // the page drives each pose in advance(); the board's own idle is not used
    piece.owned.push({dispose: () => {motion.dispose(); disposedPieces.add(piece);}});
  }
  for (const {motion} of motions.values()) motion.update(0);
}

function label() {
  return [...motions].map(([name, {motion}]) => {
    const w = motion.weights(), fading = motion.state === "shoot" && motion.clock - motion.shootAt < FADE_SECONDS || motion.state === "recover";
    if (motion.state === "idle") return `Billy ${name}: IDLE  Quaternius UAL Pistol_Idle_Loop (CC0), retargeted`;
    const clip = `SHOOT  Quaternius UAL Pistol_Shoot (CC0), retargeted, ${SHOOT_TIME_SCALE}x playback`;
    return `Billy ${name}: ${clip}${fading ? `  | crossfade ${FADE_SECONDS} s (idle ${w.idle}, shoot ${w.shoot})` : ""}`;
  }).join("\n");
}

function draw() {
  scheduler.tick(clock * 1000);
  const panes = [[0, LEFT, boardCam], [LEFT, W - LEFT, closeCam]];
  for (const [x, w, cam] of panes) {
    renderer.setViewport(x, 0, w, H);
    renderer.setScissor(x, 0, w, H);
    renderer.render(board.scene, cam);
  }
  state.textContent = label();
  document.getElementById("time").textContent = `t=${clock.toFixed(2)} s`;
  sample();
}

const world = (piece, local) => piece.actor.root.localToWorld(local.clone()).toArray();
function sample() {
  const row = {clock: +clock.toFixed(4), pieces: {}};
  for (const [name, {motion, piece}] of motions) {
    const {actor, gun} = piece, tip = gun.tip.getWorldPosition(new T.Vector3());
    row.pieces[name] = {
      state: motion.state, idleSeconds: motion.idleSeconds, shootSeconds: motion.shootSeconds, weights: motion.weights(),
      soles: motion.soleClearances(), lift: actor.root.position.y,
      rightPalm: world(piece, grip(actor, "right")), leftPalm: world(piece, grip(actor, "left")),
      leftWrist: actor.rig.sides[1].hand.getWorldPosition(new T.Vector3()).toArray(),
      gun: gun.holder.getWorldPosition(new T.Vector3()).toArray(), tip: tip.toArray(),
      gunMinusRightPalm: gun.holder.position.distanceTo(grip(actor, "right")),
    };
  }
  log.frames.push(row);
}

function advance(ms) {
  clock += ms / 1000;
  try {
    for (const [name, entry] of motions) {
      if (!entry.fired && clock >= SHOOT_AT[name]) {entry.fired = true; entry.motion.fire(); log.events.push({clock: +clock.toFixed(4), event: "fire", piece: name});}
      entry.motion.update(ms / 1000);
    }
    draw();
  } catch (error) {log.errors.push(String(error?.stack ?? error)); throw error;}
}

start();
draw();
window.__pilot = {
  advance, board, log, motions, TOTAL, SHOOT_AT, IDLE: IDLE_DURATION, SHOOT: SHOOT_DURATION,
  // Receipt for teardown: mixers' actions after dispose, scheduler timers (pending), pieces.
  teardown() {
    const mixerState = () => [...motions.values()].map(({motion}) => ({disposed: motion.disposed, actions: motion.mixer._actions.length, bindings: motion.mixer._bindings.length}));
    const before = {pieces: board.pieces().length, mixers: mixerState(), pending: scheduler.pending()};
    // The existing cue schedules timers; clearing the board must release them (pending 0 -> n -> 0).
    cued.attack({attacker: {side: "cowboy", slot: 0}, target: {side: "wizard", slot: 0}});
    const withCue = scheduler.pending();
    board.clear();
    const after = {pieces: board.pieces().length, mixers: mixerState(), pending: scheduler.pending()};
    scheduler.tick(scheduler.now() + 3000);
    const afterTick = {pieces: board.pieces().length, pending: scheduler.pending()};
    const stale = {ran: 0};
    scheduler.after(10, () => {stale.ran++;});
    const guarded = scheduler.guard(() => {stale.ran++;});
    const pendingScheduled = scheduler.pending();
    scheduler.advance();
    const pendingAfterAdvance = scheduler.pending();
    scheduler.tick(scheduler.now() + 1000);
    guarded();
    return {before, withCue, after, afterTick, stale: {pendingScheduled, pendingAfterAdvance, ranAfterClear: stale.ran}};
  },
};
document.body.dataset.ready = "1";
if (!capture) {
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(50, now - last); last = now;
    if (clock < TOTAL) advance(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
