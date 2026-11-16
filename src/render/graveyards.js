// Orb Duel graveyards: one small black-hole recess per side on the board,
// outside the three lanes, after the physical graveyards in the Master Duel
// references. The Cowboy graveyard sits right of the Cowboy row (the near
// side) and the Wizard graveyard left of the Wizard row, the same diagonal
// as the player and opponent graveyards there. Neither overlaps a tile, the
// Saloon or the Gateway.
//
// A graveyard reacts only when the Presenter's displayed discard list for its
// side grows: discards(displayed) compares each side's list length with the
// last length it saw. A tribute, a defeat and a cast spell all reach the
// discard that way, at the moment the Presenter copies it. Each new card gets
// one absorption cue: a small card in the side's colour flies from its source,
// spirals into the recess and sinks, the rim line flares and a ring closes in.
// The source is the tile of a troop the renderer removed for that side
// (remove() records it), or the side's board edge for a spell from the hand.
//
// reset(view) takes the view's discard lengths as the baseline, so a restart
// or a seed replay never counts the starting discard as new cards. clear()
// (restart, mode switch) disarms discards() until the next reset(). Both drop
// the recorded sources and return the recess and rim to rest. The cue runs
// through board.animate and board.at, so board.clear() and scheduler.advance()
// cancel it, and board.clear() removes and disposes its meshes in
// board.effects. The recess and rim are added to board.scene and stay.
// Nothing here changes the Presenter's timing: remove() returns the wrapped
// board's cue times unchanged.
//
// withGraveyards(board) -> the board with reset(), clear() and remove()
// wrapped and discards(displayed) added.
import * as T from "three";
import {SIDES} from "../game/cards.js";
import {surface, v} from "./scene.js";
import {tileIndex} from "./match-board.js";

// Board positions, in the board's world units (setBoard): the tiles span
// x from -3.30 to 4.33 in rows at z 2.32 (Cowboy) and -2.34 (Wizard); the
// board edge is at x = +-5.83. The Saloon stands at (-4.49, 2.42) and the
// Gateway at (5.03, -2.83), so these spots are clear of both.
const SPOTS = {cowboy: {x: 5.08, z: 2.32, edge: 1}, wizard: {x: -4.55, z: -2.34, edge: -1}};
const RADIUS = .42;
const RIM = 0x7f8cff; // a restrained blue-violet between the clash-ready blue and the spell violet
const CARD = {cowboy: 0xd9a86a, wizard: 0xb48cf0};

const CUE_MS = 760; // one card's absorption
const STAGGER = 110; // between cards entering the same discard together
const ARRIVE = .55; // fraction of the cue at which the card reaches the hover point

const ease = (from, to, value) => T.MathUtils.smoothstep(value, from, to);
const pulse = (t, from, peak, to) => ease(from, peak, t) * (1 - ease(peak, to, t));

// Shared by every cue and never disposed; a cue owns only its materials.
const GEOMETRY = {
  recess: new T.CircleGeometry(RADIUS, 48),
  lip: new T.TorusGeometry(RADIUS, .045, 10, 56),
  line: new T.TorusGeometry(RADIUS * .93, .011, 6, 56),
  card: new T.PlaneGeometry(.24, .34),
  ring: new T.TorusGeometry(1, .018, 6, 48),
};

// The recess: near black at the centre, a dim violet wall toward the lip,
// a thin rim light on the lip and spiral streaks that show while it glows.
function recessMaterial() {
  return new T.ShaderMaterial({
    uniforms: {glow: {value: 0}, turn: {value: 0}, rim: {value: new T.Color(RIM)}},
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false,
    vertexShader: "varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "uniform float glow,turn;uniform vec3 rim;varying vec2 p;void main(){" +
      "float r=length(p),a=atan(p.y,p.x);float lip=smoothstep(.5,.97,r);" +
      "vec3 c=mix(vec3(.004,.003,.012),vec3(.07,.055,.105),lip*lip);" +
      "float d=(r-.9)*14.;c+=rim*exp(-d*d)*(.16+.8*glow);" +
      "float swirl=pow(max(0.,sin(a*3.+r*11.-turn*6.)),6.)*smoothstep(.06,.3,r)*(1.-smoothstep(.25,.86,r));" +
      "c+=rim*swirl*glow*.65;gl_FragColor=vec4(c,1.);}",
  });
}

function buildGraveyard(scene, stage, side) {
  const {x, z} = SPOTS[side];
  const top = surface(stage.board, x, z);
  const group = new T.Group();
  group.name = `${side}-graveyard`;
  group.position.set(x, top, z);
  const recess = new T.Mesh(GEOMETRY.recess, recessMaterial());
  recess.name = "graveyard-recess";
  recess.rotation.x = -Math.PI / 2;
  recess.position.y = .012;
  recess.receiveShadow = true;
  const lip = new T.Mesh(GEOMETRY.lip, new T.MeshStandardMaterial({color: 0x2a2233, roughness: .5, metalness: .55,
    emissive: 0x1b1f4a, emissiveIntensity: .35}));
  lip.name = "graveyard-lip";
  lip.rotation.x = -Math.PI / 2;
  lip.position.y = .025;
  lip.castShadow = true;
  lip.receiveShadow = true;
  const line = new T.Mesh(GEOMETRY.line, new T.MeshBasicMaterial({color: RIM, transparent: true, opacity: .45,
    blending: T.AdditiveBlending, depthWrite: false, toneMapped: false}));
  line.name = "graveyard-rim";
  line.rotation.x = -Math.PI / 2;
  line.position.y = .05;
  group.add(recess, lip, line);
  scene.add(group);
  const center = v(x, top + .02, z);
  return {recess, line, center, flares: new Map()};
}

// The strongest flare of the cues playing on a graveyard, or rest.
function applyFlare(grave) {
  const glow = Math.max(0, ...grave.flares.values());
  grave.recess.material.uniforms.glow.value = glow;
  grave.line.material.opacity = .45 + .55 * glow;
  grave.line.scale.setScalar(1 + .06 * glow);
}

function rest(grave) {
  grave.flares.clear();
  grave.recess.material.uniforms.turn.value = 0;
  applyFlare(grave);
}

export function withGraveyards(board) {
  if (typeof board?.animate !== "function" || typeof board.at !== "function" || !board.effects || !board.stage?.tiles) {
    throw new TypeError("withGraveyards needs a match board");
  }
  const graves = Object.fromEntries(SIDES.map((side) => [side, buildGraveyard(board.scene, board.stage, side)]));
  const known = Object.fromEntries(SIDES.map((side) => [side, 0])); // discard lengths already shown
  const sources = Object.fromEntries(SIDES.map((side) => [side, []])); // removed tiles not yet discarded
  let armed = false;
  let cues = 0;

  // Where a spell card leaves from: the side's board edge, in front of its graveyard.
  function handPoint(side) {
    const {x, edge} = SPOTS[side];
    return v(x - .9 * edge, graves[side].center.y + .6, 3.6 * edge);
  }

  function forget() {
    for (const side of SIDES) {
      sources[side].length = 0;
      rest(graves[side]);
    }
  }

  // One card from `from` into the side's graveyard.
  function absorb(side, from) {
    const grave = graves[side], id = ++cues;
    const card = new T.Mesh(GEOMETRY.card, new T.MeshBasicMaterial({color: CARD[side], transparent: true, opacity: .95,
      side: T.DoubleSide, depthWrite: false, toneMapped: false}));
    card.name = "graveyard-card";
    const ring = new T.Mesh(GEOMETRY.ring, new T.MeshBasicMaterial({color: RIM, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, toneMapped: false}));
    ring.name = "graveyard-ring";
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(grave.center).setY(grave.center.y + .04);
    ring.visible = false;
    card.position.copy(from);
    board.effects.add(card, ring);
    const hover = grave.center.clone().setY(grave.center.y + .35);
    const control = from.clone().lerp(hover, .5).setY(Math.max(from.y, hover.y) + .8);
    const flat = new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2, 0, 0));
    const facing = new T.Quaternion(), spin = new T.Quaternion();
    const a = v(), b = v();
    board.animate(CUE_MS, (u, elapsed) => {
      if (u < ARRIVE) {
        // A quadratic arc from the source to the hover point above the recess.
        const s = ease(0, 1, u / ARRIVE);
        a.lerpVectors(from, control, s);
        b.lerpVectors(control, hover, s);
        card.position.lerpVectors(a, b, s);
        card.quaternion.copy(board.camera.quaternion);
        card.scale.setScalar(1 - .2 * s);
        card.material.opacity = .95;
      } else {
        // A shrinking spiral that sinks below the lip, where the recess hides it.
        const s = (u - ARRIVE) / (1 - ARRIVE);
        const angle = s * 2.5 * Math.PI, radius = RADIUS * .55 * (1 - s);
        card.position.set(hover.x + radius * Math.cos(angle), hover.y - .42 * ease(0, 1, s), hover.z + radius * Math.sin(angle));
        facing.copy(board.camera.quaternion).slerp(flat, ease(0, .6, s));
        card.quaternion.copy(facing).multiply(spin.setFromAxisAngle(v(0, 0, 1), angle));
        card.scale.setScalar(Math.max(.001, .8 * (1 - .85 * s)));
        card.material.opacity = .95 * (1 - ease(.55, 1, s));
      }
      card.visible = u < 1;
      const since = (u - .7) / .3;
      ring.visible = since >= 0 && since < 1;
      if (ring.visible) {
        ring.scale.setScalar(RADIUS * (1.25 - .95 * ease(0, 1, since)));
        ring.material.opacity = .75 * (1 - since);
      }
      grave.flares.set(id, pulse(u, .45, .8, 1));
      grave.recess.material.uniforms.turn.value = elapsed / 1000;
      applyFlare(grave);
    }, () => {
      grave.flares.delete(id);
      applyFlare(grave);
      for (const mesh of [card, ring]) {
        mesh.removeFromParent();
        mesh.material.dispose();
      }
    });
  }

  // Call with the Presenter's displayed Player_View after each change.
  function discards(displayed) {
    if (!armed || !displayed?.sides) return;
    for (const side of SIDES) {
      const length = displayed.sides[side]?.discard?.length ?? 0;
      const added = length - known[side];
      known[side] = length;
      if (added <= 0) continue; // a removal still sinking keeps its source
      const from = sources[side].splice(0, added);
      for (let i = 0; i < added; i++) {
        const point = from[i] ?? handPoint(side);
        if (i === 0) absorb(side, point);
        else board.at(i * STAGGER, () => absorb(side, point));
      }
    }
  }

  function remove(spec) {
    if (armed) {
      const tile = board.stage.tiles[tileIndex(spec.side, spec.slot)];
      sources[spec.side]?.push(v(tile.x, tile.top + .45, tile.z));
    }
    return board.remove(spec);
  }

  function reset(view) {
    board.reset(view); // the board's own clear() cancels and disposes any cue
    forget();
    for (const side of SIDES) known[side] = view.sides[side].discard?.length ?? 0;
    armed = true;
  }

  function clear() {
    board.clear();
    forget();
    armed = false;
  }

  return {...board, reset, clear, remove, discards};
}
