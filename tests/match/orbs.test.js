// Procedural orbs (src/render/orbs.js) and the Orb Duel match board
// (src/render/match-board.js) in Node: three.js with the real GLBs from
// scripts/load-local.mjs and no WebGL. Each board runs on the real epoch
// scheduler with a fake clock; run() ticks it in 16 ms frames.
import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { localModels } from "../../scripts/load-local.mjs";
import { createDuel } from "../../src/render/scene.js";
import { CARDS, SIDES } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { publicState } from "../../src/game/view.js";
import { chooseAction } from "../../src/game/cpu.js";
import { createScheduler } from "../../src/match/scheduler.js";
import { createController } from "../../src/match/controller.js";
import { MAX_ORBS, createBaseOrbs, createTroopOrbs } from "../../src/render/orbs.js";
import { CUES, createMatchBoard, tileIndex } from "../../src/render/match-board.js";

const models = await localModels();

const idOf = (name, copy = 1) => Object.values(CARDS).filter((card) => card.name === name)[copy - 1].id;
const troop = (name, health, copy = 1) => ({ cardId: idOf(name, copy), health });
const shownOrbs = (row) => row.children.filter((orb) => orb.userData.orb && orb.visible).length;
const showing = (node) => {
  for (let each = node; each; each = each.parent) if (!each.visible) return false;
  return true;
};
const assetsIn = (root) => {
  const found = new Set();
  root.traverse((node) => node.isMesh && found.add(node.geometry.userData.asset));
  return found;
};
const piecesInScene = (board) => {
  let count = 0;
  board.scene.traverse((node) => node.userData.piece && (count += 1));
  return count;
};
const xyz = (vector) => vector.toArray().map((n) => Number(n.toFixed(9)));

// A Player_View from seed 0 with the given boards and Base orbs.
function viewWith(cowboy, wizard, baseOrbs = { cowboy: 5, wizard: 5 }) {
  const view = publicState(createMatch(0), "cowboy");
  view.sides.cowboy.board = cowboy;
  view.sides.wizard.board = wizard;
  for (const side of SIDES) view.sides[side].baseOrbs = baseOrbs[side];
  return view;
}
const FULL = () => viewWith(
  [troop("Sheriff", 3), troop("Billy", 4), troop("Mounted Billy", 5)],
  [troop("Skeleton", 3), troop("Wizard", 4), troop("Dragon", 5)],
);

async function setup() {
  const scheduler = createScheduler();
  scheduler.tick(0);
  const board = await createMatchBoard({ models, scheduler });
  return { board, scheduler };
}

function run(scheduler, until, frame = 16) {
  while (scheduler.now() < until) scheduler.tick(Math.min(until, scheduler.now() + frame));
}

test("orb rows show exactly n orbs for n = 0 to 5, for troops and Bases", async () => {
  const stand = new T.Mesh(new T.BoxGeometry(1, 2, 1));
  stand.position.y = 1;
  const rows = [createTroopOrbs("cowboy"), createTroopOrbs("wizard"), createBaseOrbs("cowboy", stand), createBaseOrbs("wizard", stand)];
  for (const row of rows) {
    for (let n = 0; n <= MAX_ORBS; n++) {
      row.set(n);
      assert.equal(shownOrbs(row.group), n);
      assert.equal(row.count(), n);
    }
    for (const bad of [-1, 6, 1.5, Number.NaN]) assert.throws(() => row.set(bad), RangeError);
  }
  assert.equal(rows[0].group.children[0].geometry, rows[1].group.children[0].geometry, "troop rows share one geometry");
  assert.ok(rows[2].group.position.y > 2, "the Base row sits above its structure");

  const { board } = await setup();
  board.reset(FULL());
  for (let n = 0; n <= MAX_ORBS; n++) {
    for (const side of SIDES) {
      board.setTroopOrbs(side, 1, n);
      board.setBaseOrbs(side, n);
      assert.equal(shownOrbs(board.piece(side, 1).orbs.group), n, `${side} troop orbs`);
      assert.equal(shownOrbs(board.bases[side].group), n, `${side} Base orbs`);
    }
  }
  assert.ok(board.bases.cowboy.group.position.distanceTo(new T.Box3().setFromObject(board.stage.saloon).getCenter(new T.Vector3())) < 2);
  assert.ok(board.bases.wizard.group.position.distanceTo(new T.Box3().setFromObject(board.stage.gate).getCenter(new T.Vector3())) < 2);
});

test("Cowboy slot i stands on stage.tiles[i] and Wizard slot i on stage.tiles[3 + i]; the stage is the demo's", async () => {
  const { board } = await setup();
  assert.deepEqual(SIDES.flatMap((side) => [0, 1, 2].map((slot) => tileIndex(side, slot))), [0, 1, 2, 3, 4, 5]);
  board.reset(FULL());
  for (const side of SIDES) {
    for (const slot of [0, 1, 2]) {
      const tile = board.stage.tiles[side === "cowboy" ? slot : 3 + slot];
      assert.equal(tile.faction, side);
      assert.deepEqual(xyz(board.piece(side, slot).root.position), xyz(new T.Vector3(tile.x, tile.top, tile.z)), `${side} ${slot}`);
    }
  }
  const duel = await createDuel(models);
  const tiles = (stage) => stage.tiles.map(({ faction, x, z, top }) => ({ faction, x, z, top }));
  assert.deepEqual(tiles(board.stage), tiles(duel.stage));
  assert.equal(duel.camera.isPerspectiveCamera, true, "exchange camera stays independent");
  assert.equal(board.camera.isOrthographicCamera, true, "match restores the playtest view");
  for (const [width,height] of [[1440,666],[390,646]]) {
    board.resize(width,height);
    for (const tile of board.stage.tiles) {
      const p = new T.Vector3(tile.x,tile.top,tile.z).project(board.camera);
      assert.ok(Math.abs(p.x)<1 && Math.abs(p.y)<1, "every lane stays in view after resize");
    }
  }
});

test("Characters use their own models, the static troops are real meshes, and Skeleton is a labelled token", async () => {
  const { board } = await setup();
  board.reset(FULL());
  for (const [side, kind] of [["cowboy", "billy"], ["wizard", "wizard"]]) {
    const piece = board.piece(side, 1);
    const skinned = [];
    piece.root.traverse((node) => node.isSkinnedMesh && skinned.push(node));
    assert.equal(piece.kind, kind);
    assert.equal(piece.temporary, false);
    assert.equal(skinned.length, 1);
    assert.equal(skinned[0], piece.actor.body);
    assert.equal(skinned[0].geometry.userData.asset, kind);
  }
  const billy = board.piece("cowboy", 1);
  assert.equal(billy.actor.root.rotation.y, Math.PI, "Billy faces the Wizards");
  assert.ok(assetsIn(billy.root).has("revolver"));
  assert.ok(billy.gun.holder.position.distanceTo(billy.holster) < 1e-12, "the revolver is holstered");
  const wizard = board.piece("wizard", 1);
  assert.equal(wizard.staff.holder.parent, wizard.actor.rig.sides[1].hand, "the staff is in the Wizard's hand");

  // The Sheriff has its own model; tests/match/sheriff.test.js covers it.
  for (const [side, slot, name] of [["wizard", 0, "Skeleton"]]) {
    const piece = board.piece(side, slot);
    let skinned = 0;
    piece.root.traverse((node) => node.isSkinnedMesh && (skinned += 1));
    const used = assetsIn(piece.root);
    assert.equal(piece.kind, "token", name);
    assert.equal(piece.temporary, true, name);
    assert.equal(piece.token.userData.temporary, true, name);
    assert.equal(piece.root.getObjectByName("label"), undefined, "placeholder has no debug label");
    assert.equal(skinned, 0, name);
    assert.ok(!used.has("billy") && !used.has("wizard"), `${name} uses ${[...used]}`);
  }

  const mounted = board.piece("cowboy", 2);
  mounted.root.updateWorldMatrix(true, true);
  const mountedBox = new T.Box3().setFromObject(mounted.body.children[0]);
  const mountedSize = mountedBox.getSize(new T.Vector3());
  let mountedSkinned = 0;
  mounted.root.traverse((node) => node.isSkinnedMesh && (mountedSkinned += 1));
  assert.equal(mounted.kind, "mounted-billy");
  assert.equal(mounted.temporary, false);
  assert.equal(mounted.token, null, "no temporary token");
  assert.equal(mountedSkinned, 0, "Mounted Billy is a static mesh");
  assert.deepEqual([...assetsIn(mounted.body.children[0])], ["mounted-billy"]);
  assert.ok(Math.abs(mountedSize.y - 1.7) < 0.01, `Mounted Billy height ${mountedSize.y}`);
  assert.ok(Math.max(mountedSize.x, mountedSize.z) <= 2.05 + 1e-6, "Mounted Billy footprint is at most 2.05");
  assert.ok(Math.abs(mountedBox.min.y - mounted.root.position.y) < 1e-6, "hooves sit on the tile");
  assert.equal(mounted.owned.length, 0, "Mounted Billy's shared geometry and materials are not disposed");
  assert.equal(shownOrbs(mounted.orbs.group), 5, "five health orbs are shown");
  assert.ok(mounted.orbs.group.position.y >= mountedSize.y, "the orbs sit above the model");
  assert.ok(mountedBox.max.y <= mounted.orbs.group.position.y + mounted.root.position.y);
  const mountedFront = new T.Vector3(0, 0, 1).applyQuaternion(mounted.body.children[0].getWorldQuaternion(new T.Quaternion()));
  assert.ok(mountedFront.z < -0.99, "the horse faces -Z toward the Wizards");

  const dragon = board.piece("wizard", 2);
  dragon.root.updateWorldMatrix(true, true);
  const dragonBox = new T.Box3().setFromObject(dragon.body.children[0]);
  const dragonSize = dragonBox.getSize(new T.Vector3());
  let dragonSkinned = 0;
  dragon.root.traverse((node) => node.isSkinnedMesh && (dragonSkinned += 1));
  assert.equal(dragon.kind, "dragon");
  assert.equal(dragon.temporary, false);
  assert.equal(dragon.token, null);
  assert.equal(dragonSkinned, 0, "the Dragon is a static mesh");
  assert.ok(assetsIn(dragon.root).has("dragon"));
  assert.ok(Math.max(dragonSize.x, dragonSize.z) <= 2.1 + 1e-6, "Dragon footprint is at most 2.1");
  assert.ok(Math.abs(dragonBox.min.y - dragon.root.position.y) < 1e-6, "Dragon sits on its tile");
  assert.equal(dragon.owned.length, 0, "the Dragon's shared geometry and materials are not disposed");
  assert.ok(dragon.height > board.piece("wizard", 0).height, "Dragon is larger than Skeleton");

});

test("reset builds exactly the view's troops and orbs; clear() leaves no piece, orb or effect", async () => {
  const { board, scheduler } = await setup();
  const view = viewWith([troop("Sheriff", 2), null, troop("Billy", 4)], [troop("Skeleton", 1), troop("Dragon", 5), null], { cowboy: 3, wizard: 4 });
  for (const round of [1, 2]) {
    board.reset(view);
    for (const side of SIDES) {
      view.sides[side].board.forEach((expected, slot) => {
        const piece = board.piece(side, slot);
        if (!expected) return assert.equal(piece, null, `${side} ${slot}`);
        assert.equal(piece.cardId, expected.cardId);
        assert.equal(shownOrbs(piece.orbs.group), expected.health);
      });
      assert.equal(shownOrbs(board.bases[side].group), view.sides[side].baseOrbs);
    }
    assert.equal(piecesInScene(board), 4, `reset ${round}`);
    assert.equal(board.pieces().length, 4);
  }

  // Clear in the middle of every kind of cue.
  board.highlight({ cowboy: [1], wizard: [2] });
  board.summon({ side: "cowboy", slot: 1, cardId: idOf("Sheriff", 2), health: 3 });
  board.attack({ attacker: { side: "cowboy", slot: 0, cardId: idOf("Sheriff") }, target: { kind: "troop", side: "wizard", slot: 0, cardId: idOf("Skeleton") } });
  board.spell({ spell: "Deadeye", cardId: idOf("Deadeye"), caster: "cowboy", target: { side: "wizard", slot: 1, cardId: idOf("Dragon") } });
  board.remove({ side: "cowboy", slot: 2 });
  board.move({ side: "wizard", from: 1, to: 2 });
  run(scheduler, 450);
  assert.ok(board.effects.children.length > 0, "effects were running");
  board.clear();
  const leftovers = (match) => {
    const found = [];
    board.scene.traverse((node) => match(node) && found.push(node.name));
    return found;
  };
  for (let check = 0; check < 2; check++) {
    assert.equal(piecesInScene(board), 0);
    assert.deepEqual(board.pieces(), []);
    assert.deepEqual(leftovers((node) => node.userData.orb && showing(node)), [], "orbs");
    assert.deepEqual(leftovers((node) => node.name.includes("tile-glow") && node.visible), [], "highlights");
    assert.equal(board.effects.children.length, 0, "effects");
    assert.equal(scheduler.pending(), 0, "scheduled cues");
    run(scheduler, scheduler.now() + 2000); // nothing comes back later
  }
});

test("pick at a projected tile centre or a standing piece returns that side and slot", async () => {
  const { board } = await setup();
  const at = (point) => {
    const ndc = point.clone().project(board.camera);
    return board.pick(ndc.x, ndc.y);
  };
  board.stage.tiles.forEach((tile, index) => {
    assert.deepEqual(at(new T.Vector3(tile.x, tile.top, tile.z)), { side: tile.faction, slot: index % 3 });
  });
  board.reset(FULL());
  for (const piece of board.pieces()) {
    const middle = piece.root.position.clone().setY(piece.root.position.y + piece.height * .6);
    assert.deepEqual(at(middle), { side: piece.side, slot: piece.slot }, piece.name);
  }
  assert.equal(board.pick(-.98, .95), null, "nothing to pick in the corner");
});

test("at each cue's end a summoned piece stands on its tile, a removed piece is gone and a moved piece is on its destination", async () => {
  const { board, scheduler } = await setup();
  board.reset(viewWith([troop("Sheriff", 3), null, troop("Billy", 2)], [troop("Skeleton", 3), null, null]));
  const tilePoint = (side, slot) => {
    const tile = board.stage.tiles[tileIndex(side, slot)];
    return xyz(new T.Vector3(tile.x, tile.top, tile.z));
  };

  let start = scheduler.now();
  const summoned = board.summon({ side: "cowboy", slot: 1, cardId: idOf("Billy", 2), health: 4 });
  assert.deepEqual(summoned, { impact: 350, end: 600 });
  const piece = board.piece("cowboy", 1);
  run(scheduler, start + 100);
  assert.ok(piece.body.scale.x < 1, "still scaling in");
  run(scheduler, start + summoned.end);
  assert.deepEqual(xyz(piece.root.position), tilePoint("cowboy", 1));
  assert.deepEqual(xyz(piece.body.scale), [1, 1, 1]);
  assert.deepEqual(xyz(piece.body.position), [0, 0, 0]);
  assert.ok(showing(piece.root) && piece.root.parent);
  assert.equal(shownOrbs(piece.orbs.group), 0, "orbs wait for the Presenter's impact");

  start = scheduler.now();
  const leaving = board.piece("cowboy", 2);
  const removed = board.remove({ side: "cowboy", slot: 2 });
  assert.deepEqual(removed, { end: 500 });
  assert.equal(board.piece("cowboy", 2), null, "the slot is free at once");
  run(scheduler, start + removed.end - 16);
  assert.ok(leaving.root.parent, "still sinking");
  run(scheduler, start + removed.end);
  assert.equal(leaving.root.parent, null);
  assert.ok(!board.pieces().includes(leaving));
  assert.equal(piecesInScene(board), 3);

  start = scheduler.now();
  const mover = board.piece("wizard", 0);
  const moved = board.move({ side: "wizard", from: 0, to: 1 });
  assert.deepEqual(moved, { end: 700 });
  run(scheduler, start + moved.end / 2);
  assert.ok(mover.root.position.y > board.stage.tiles[3].top + .5, "arcs over the board");
  run(scheduler, start + moved.end);
  assert.deepEqual(xyz(mover.root.position), tilePoint("wizard", 1));
  assert.equal(board.piece("wizard", 1), mover);
  assert.equal(board.piece("wizard", 0), null);
  assert.equal(mover.orbs.group.parent.parent, mover.root, "the orbs travel with the model");

  start = scheduler.now();
  const attacker = board.piece("cowboy", 0);
  const attacked = board.attack({ attacker: { side: "cowboy", slot: 0, cardId: attacker.cardId }, target: { kind: "base", side: "wizard" } });
  assert.deepEqual(attacked, { impact: 400, end: 800 });
  run(scheduler, start + attacked.impact);
  assert.ok(attacker.body.position.length() > .5, "lunges toward the Gateway");
  assert.equal(board.effects.children.length, 1, "a flash at impact");
  run(scheduler, start + attacked.end);
  assert.deepEqual(xyz(attacker.body.position), [0, 0, 0]);

  start = scheduler.now();
  const cast = board.spell({ spell: "Deadeye", cardId: idOf("Deadeye"), caster: "cowboy", target: { side: "wizard", slot: 1, cardId: mover.cardId } });
  assert.deepEqual(cast, { impact: 400, end: 700 });
  run(scheduler, start + cast.impact);
  assert.equal(board.effects.children.length, 1);
  run(scheduler, start + cast.end);
  assert.equal(board.effects.children.length, 0);
  assert.equal(scheduler.pending(), 0);
  assert.deepEqual(CUES, { summon: summoned, attack: attacked, spell: cast, remove: removed, move: moved });
});

test("scheduler.advance() in the middle of the cues stops all motion", async () => {
  const { board, scheduler } = await setup();
  board.reset(viewWith([troop("Sheriff", 3), null, troop("Billy", 4)], [troop("Skeleton", 3), troop("Wizard", 4), null]));
  board.summon({ side: "cowboy", slot: 1, cardId: idOf("Mounted Billy"), health: 5 });
  board.attack({ attacker: { side: "wizard", slot: 0, cardId: idOf("Skeleton") }, target: { kind: "troop", side: "cowboy", slot: 0, cardId: idOf("Sheriff") } });
  board.spell({ spell: "Singularity", cardId: idOf("Singularity"), caster: "wizard", target: { side: "cowboy", slot: 0, cardId: idOf("Sheriff") } });
  board.remove({ side: "cowboy", slot: 2 });
  board.move({ side: "wizard", from: 1, to: 2 });
  run(scheduler, 300);
  const snapshot = () => {
    const state = [];
    board.scene.traverse((node) => state.push([node.uuid, node.visible, ...node.position.toArray(), ...node.scale.toArray(),
      ...node.quaternion.toArray(), [node.material].flat().map((material) => material?.opacity ?? null)]));
    return JSON.stringify(state);
  };
  const frozen = snapshot();
  scheduler.advance();
  assert.equal(scheduler.pending(), 0);
  run(scheduler, 3000);
  assert.equal(snapshot(), frozen);
  board.clear();
  assert.equal(piecesInScene(board), 0);
});

test("the controller and Presenter play seeds 0-4 to a result on the real board, which matches the displayed view", async () => {
  for (const seed of [0, 1, 2, 3, 4]) {
    const scheduler = createScheduler();
    scheduler.tick(0);
    const board = await createMatchBoard({ models, scheduler });
    const controller = createController({ scheduler, renderer: board });
    const matches = () => {
      const shown = controller.displayed();
      for (const side of SIDES) {
        assert.equal(shownOrbs(board.bases[side].group), shown.sides[side].baseOrbs, `seed ${seed}: ${side} Base orbs`);
        shown.sides[side].board.forEach((expected, slot) => {
          const piece = board.piece(side, slot);
          if (!expected) return assert.equal(piece, null, `seed ${seed}: ${side} ${slot}`);
          assert.equal(piece.cardId, expected.cardId, `seed ${seed}: ${side} ${slot}`);
          assert.equal(shownOrbs(piece.orbs.group), expected.health, `seed ${seed}: ${side} ${slot} orbs`);
        });
      }
      assert.equal(board.pieces().length, SIDES.reduce((n, side) => n + shown.sides[side].board.filter(Boolean).length, 0));
    };
    assert.equal(controller.start(seed), true);
    for (let ticks = 0; controller.status() !== "terminal"; ticks++) {
      assert.notEqual(controller.status(), "error", `seed ${seed}: ${controller.message()}`);
      assert.ok(ticks < 20000, `seed ${seed}: no result`);
      if (controller.status() === "accepting_input") {
        matches();
        assert.equal(controller.submit(chooseAction(controller.view())).ok, true);
        continue;
      }
      scheduler.tick(scheduler.now() + 50);
    }
    matches();
    assert.equal(scheduler.pending(), 0, `seed ${seed}: cues still pending at the end`);
  }
});
