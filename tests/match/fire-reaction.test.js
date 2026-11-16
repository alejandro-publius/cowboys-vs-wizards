import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {reactToFire} from "../../src/render/fire-reaction.js";

function scene() {
  const body = new T.Object3D();
  body.rotation.set(.03, .14, .02);
  body.scale.set(1, 1, 1);
  const piece = {side: "cowboy", slot: 0, kind: "skeleton", body, acting: false};
  let occupant = piece;
  const tasks = [];
  const board = {
    piece(side, slot) { return side === "cowboy" && slot === 0 ? occupant : null; },
    animate(duration, update, done) { tasks.push({duration, update, done}); },
  };
  return {piece, body, tasks, board, remove() { occupant = null; }};
}

const near = (actual, expected, what) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${what}: ${actual} != ${expected}`);

test("Firebolt reaction starts at impact, changes the target, recovers to rest", () => {
  const {piece, body, board, tasks} = scene();
  const rest = {yaw: body.rotation.y, roll: body.rotation.z, scaleY: body.scale.y};
  reactToFire(board, piece, 1020, 1100);
  assert.equal(tasks.length, 1);
  const [{duration, update, done}] = tasks;
  assert.equal(duration, 2120);
  update(0, 1099);
  assert.equal(piece.acting, false, "reaction must not start before spell impact");
  near(body.rotation.y, rest.yaw, "unhit yaw");
  near(body.scale.y, rest.scaleY, "unhit scale");

  update(.56, 1570); // delayed reaction is underway
  assert.equal(piece.acting, true);
  assert.notEqual(body.rotation.y, rest.yaw, "static character looks toward its feet");
  assert.ok(body.scale.y < rest.scaleY, "static character visibly recoils");

  update(1, 2120);
  done();
  assert.equal(piece.acting, false);
  near(body.rotation.y, rest.yaw, "recovered yaw");
  near(body.rotation.z, rest.roll, "recovered roll");
  near(body.scale.y, rest.scaleY, "recovered scale");
});

test("Firebolt reaction does not begin for a target removed before impact", () => {
  const {piece, body, board, tasks, remove} = scene();
  const before = body.rotation.clone();
  reactToFire(board, piece, 850, 500);
  remove();
  const [{update, done}] = tasks;
  update(.8, 1000);
  done();
  assert.equal(piece.acting, false);
  near(body.rotation.y, before.y, "removed target yaw");
});
