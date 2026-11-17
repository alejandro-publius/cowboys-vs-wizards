// Isolated Billy sourced-idle preview. Uses the production board, board camera (src/render/match-camera.js),
// closeUp camera, materials, perimeter and attack cue (src/render/cues.js) unchanged. Only this page
// plays the retargeted Quaternius idle on Billy. Production entry points and defaults are untouched.
//
// Deterministic by design: ?capture=1 stops the animation loop; window.__pilot.advance(ms) moves the
// page clock, scheduler and render by exactly that much. Without it the page plays live in real time.
// Layout: left = existing board camera, right = existing closeUp camera on Billy A (zoomed).
import * as T from "three";
import {loadAssets} from "../../src/render/scene.js";
import {arenaModelNames, perimeterModelNames} from "../../src/render/model-assets.js";
import {addPerimeter, loadGroundTexture} from "../../src/render/perimeter.js";
import {createMatchBoard} from "../../src/render/match-board.js";
import {withCues} from "../../src/render/cues.js";
import {createScheduler} from "../../src/match/scheduler.js";
import {BILLY_IDLE_DURATION, createBillyIdle} from "./billy-pilot-idle.js";

const params = new URLSearchParams(location.search);
const capture = params.has("capture");
const W = 1280, H = 720, LEFT = 800;
const ATTACK_AT = 5.0, SECOND_PHASE = .8;       // seconds on the page clock; Billy B idles 0.8 s out of phase
const TOTAL = 12.5;
const MODEL_ROOT = "./models/";

const hud = document.getElementById("hud"), state = document.getElementById("state");
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

// Board camera, then the existing closeUp camera on Billy A, each with its own pane aspect.
board.resize(LEFT, H, 0);
const boardCam = board.camera.clone();
board.resize(W - LEFT, H, 0);
board.closeUp("cowboy", 0);
const closeCam = board.camera.clone();
closeCam.zoom = 5.2;
closeCam.updateProjectionMatrix();

let clock = 0;                                    // page clock, seconds
const log = {frames: [], events: [], errors: []};
window.addEventListener("error", (event) => log.errors.push(String(event.message)));
const idles = new Map();                          // piece -> {idle, start}
const view = {sides: {
  cowboy: {board: [{cardId: "cowboy-billy-1", health: 3}, null, {cardId: "cowboy-billy-2", health: 3}], baseOrbs: 5},
  wizard: {board: [{cardId: "wizard-wizard-1", health: 3}, null, null], baseOrbs: 5},
}};

function start() {
  scheduler.tick(clock * 1000);
  board.reset(view);
  [[0, 0], [2, SECOND_PHASE]].forEach(([slot, phase]) => {
    const piece = board.piece("cowboy", slot), idle = createBillyIdle(piece.actor);
    const entry = {idle, origin: clock - phase, piece, lastClock: null};
    idles.set(piece, entry);
    // Same pattern as match-board idles(): runs when the body renders, skips while a cue poses it.
    piece.actor.body.onBeforeRender = () => {
      if (disposedPieces.has(piece) || entry.lastClock === clock) return;
      entry.lastClock = clock;
      if (piece.acting) {
        entry.wasActing = true;
        idle.fadeOut(clock);
      } else {
        // The idle restarts from its first frame when a cue ends, blending in from the rest pose.
        if (entry.wasActing) {entry.wasActing = false; entry.origin = clock; log.events.push({clock, event: "idle-resume", piece: slot});}
        idle.play(clock - entry.origin);
      }
    };
    piece.owned.push({dispose: () => {idle.dispose(); disposedPieces.add(piece);}});
  });
}
const disposedPieces = new WeakSet();

function attackNow() {
  const entry = idles.get(board.piece("cowboy", 0));
  entry.idle.beginAttack(clock);
  const times = cued.attack({attacker: {side: "cowboy", slot: 0}, target: {side: "wizard", slot: 0}});
  entry.attackEnd = clock + times.end / 1000;
  log.events.push({clock, event: "attack", ...times});
  return times;
}

function label() {
  const entry = [...idles.values()][0];
  const attacking = entry?.piece.acting;
  const since = entry && !attacking && entry.attackEnd ? clock - entry.attackEnd : null;
  if (attacking) return `ATTACK  existing procedural cue (src/render/cues.js), not sourced motion`;
  const blending = since !== null && since < .2 ? "  | blend-in .18 s" : "";
  return `IDLE  Quaternius UAL Pistol_Idle_Loop (CC0), retargeted${blending}`;
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
  hud.dataset.clock = clock.toFixed(2);
  document.getElementById("time").textContent = `t=${clock.toFixed(2)} s`;
  sample();
}

// Per-frame samples for the receipt: ankles/wrists in world space, idle clocks, bone sanity.
const ankleOf = (piece, i) => piece.actor.rig.sides[i].foot.getWorldPosition(new T.Vector3());
const wristOf = (piece, i) => piece.actor.rig.sides[i].hand.getWorldPosition(new T.Vector3());
function sample() {
  const row = {clock: +clock.toFixed(4), pieces: {}};
  for (const [name, slot] of [["A", 0], ["B", 2]]) {
    const piece = board.piece("cowboy", slot);
    if (!piece) continue;
    const entry = idles.get(piece), pos = [0, 1].flatMap((i) => [ankleOf(piece, i).toArray(), wristOf(piece, i).toArray()]);
    row.pieces[name] = {acting: piece.acting, idlePlaying: entry.idle.playing, idleSeconds: entry.idle.seconds, p: pos.flat(), yaw: piece.actor.root.rotation.y, lift: piece.actor.root.position.y};
  }
  log.frames.push(row);
}

async function advance(ms) {
  clock += ms / 1000;
  try {
    if (!attacked && clock >= ATTACK_AT) {attacked = true; scheduler.tick(clock * 1000); attackNow();}
    draw();
  } catch (error) {log.errors.push(String(error?.stack ?? error)); throw error;}
}
let attacked = false;

start();
draw();
window.__pilot = {
  advance, board, log, idles, TOTAL, ATTACK_AT, IDLE: BILLY_IDLE_DURATION,
  // Clear the board, check what was released, and replay from clock 0 on the same page.
  teardown() {
    const before = {pieces: board.pieces().length, mixers: [...idles.values()].map((e) => e.idle.disposed)};
    board.clear();
    const after = {pieces: board.pieces().length, disposed: [...idles.values()].map((e) => e.idle.disposed), pending: scheduler.epoch()};
    return {before, after};
  },
  restart() {
    board.clear(); idles.clear(); clock = 0; attacked = false; log.frames.length = 0; log.events.length = 0;
    start(); draw();
  },
};
document.body.dataset.ready = "1";
if (!capture) {
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(50, now - last); last = now;
    if (clock < TOTAL) advance(dt); else window.__pilot.restart();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
void hud;
