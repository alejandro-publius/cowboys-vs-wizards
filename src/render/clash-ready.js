// Blue pre-attack cue for the match board. During the committed clash pause
// the Presenter calls clashReady(troops, ms) with the tiles of every troop that
// attacks in the coming damage events; each gets a blue ring pulsing on its
// tile for ms. clashReady([], 0), called as the attacks start, ends it.
//
// The pulse runs through board.animate, so board.clear() and scheduler.advance()
// (restart, mode switch) cancel it, and board.clear() removes and disposes its
// meshes in board.effects. The tiles come from board.stage.tiles, so it does not
// depend on which model stands on them.
//
// withClashReady(board) -> the board with clashReady() added.
import * as T from "three";
import {SIDES} from "../game/cards.js";
import {SLOT_COUNT} from "../game/state.js";

const BLUE = 0x4aa8ff;
const GEOMETRY = {
  ring: new T.RingGeometry(.72, 1, 48),
  fill: new T.CircleGeometry(.72, 48),
};

const neon = (opacity) => new T.MeshBasicMaterial({color: BLUE, transparent: true, opacity,
  blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, side: T.DoubleSide});

export function withClashReady(board) {
  if (typeof board?.animate !== "function" || !board.effects || !board.stage?.tiles) {
    throw new TypeError("withClashReady needs a match board");
  }
  let cue = null; // { meshes, ring, fill } of the cue on screen

  function end() {
    if (!cue) return;
    for (const mesh of cue.meshes) mesh.removeFromParent();
    cue.ring.dispose();
    cue.fill.dispose();
    cue = null;
  }

  function clashReady(troops, ms) {
    end();
    if (!troops?.length || !(ms > 0)) return;
    const mine = {meshes: [], ring: neon(0), fill: neon(0)};
    cue = mine;
    const seen = new Set();
    for (const {side, slot} of troops) {
      const index = SIDES.indexOf(side) * SLOT_COUNT + slot;
      const tile = board.stage.tiles[index];
      if (!tile || seen.has(index)) continue;
      seen.add(index);
      const size = new T.Box3().setFromObject(tile.model).getSize(new T.Vector3());
      const radius = .45 * Math.min(size.x, size.z);
      for (const [geometry, material] of [[GEOMETRY.fill, mine.fill], [GEOMETRY.ring, mine.ring]]) {
        const mesh = new T.Mesh(geometry, material);
        mesh.name = "clash-ready";
        mesh.rotation.x = -Math.PI / 2;
        mesh.scale.setScalar(radius);
        mesh.position.set(tile.x, tile.top + .03, tile.z);
        mesh.renderOrder = 2;
        board.effects.add(mesh);
        mine.meshes.push(mesh);
      }
    }
    // Two pulses; the Presenter ends the cue as the attacks start.
    board.animate(ms, (u) => {
      if (cue !== mine) return;
      const wave = .5 - .5 * Math.cos(4 * Math.PI * u);
      mine.ring.opacity = .35 + .55 * wave;
      mine.fill.opacity = .1 + .22 * wave;
    }, () => {
      if (cue === mine) end();
    });
  }

  return {...board, clashReady};
}
