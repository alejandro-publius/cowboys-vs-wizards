import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createDuel, loadAssets } from '../src/render/scene.js';
import { CARDS, SIDES } from '../src/game/cards.js';
import { SLOT_COUNT } from '../src/game/state.js';

const tokenColors = {
  Sheriff: [0xda9a62, 0xffcb80],
  'Mounted Billy': [0xb16648, 0xffad6d],
  Skeleton: [0xb5a4c6, 0xddc3f3],
  Dragon: [0x7c4b90, 0xeb8aff],
};

function makeTokens() {
  const base = new THREE.CylinderGeometry(.43, .55, .19, 6);
  const crest = new THREE.OctahedronGeometry(.39);
  return Object.fromEntries(Object.entries(tokenColors).map(([name, [bronze, jewel]]) => {
    const token = new THREE.Group();
    const foot = new THREE.Mesh(base, new THREE.MeshStandardMaterial({color: bronze, metalness: .55, roughness: .34}));
    const stone = new THREE.Mesh(crest, new THREE.MeshStandardMaterial({color: jewel, emissive: jewel, emissiveIntensity: .14, roughness: .3, flatShading: true}));
    foot.position.y = .095;
    stone.position.y = .56;
    stone.scale.y = name === 'Dragon' || name === 'Mounted Billy' ? 1.48 : 1;
    foot.castShadow = stone.castShadow = true;
    token.add(foot, stone);
    return [name, token];
  }));
}

// Stage and the two finished miniatures come from the original attack demo.
// This view uses its own camera and only renders when the board changes.
export async function createBoard(host, source, onLayout, onLost) {
  const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.01;
  let duel;
  try {
    duel = await createDuel(await loadAssets(source));
  } catch (error) {
    renderer.dispose();
    throw error;
  }

  const { scene, stage, billy, wizard } = duel;
  const stageObjects = new Set([stage.board, stage.saloon, stage.gate, ...stage.tiles.map(tile => tile.model)]);
  for (const child of [...scene.children]) {
    if (!stageObjects.has(child) && !child.isLight && child.geometry?.type !== 'PlaneGeometry') child.removeFromParent();
  }
  const pieces = new Map();
  const tokens = makeTokens();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 65);
  camera.position.set(.12, 15.3, 10.6);
  camera.lookAt(.08, .36, .12);
  camera.updateMatrixWorld();
  host.append(renderer.domElement);

  const tileAt = (side, slot) => stage.tiles[(side === 'cowboy' ? 0 : SLOT_COUNT) + slot];
  const draw = () => renderer.render(scene, camera);

  function resize() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const aspect = width / height;
    const halfHeight = Math.max(4.44, 6.3 / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    draw();
    onLayout();
  }

  function point(side, slot, lift = 0) {
    const world = slot === null
      ? (side === 'cowboy' ? stage.saloon : stage.gate).position.clone().add(new THREE.Vector3(0, 1 + lift, 0))
      : new THREE.Vector3(tileAt(side, slot).x, tileAt(side, slot).top + lift, tileAt(side, slot).z);
    const ndc = world.project(camera);
    return {x: (ndc.x + 1) / 2 * host.clientWidth, y: (1 - ndc.y) / 2 * host.clientHeight};
  }

  function update(view) {
    const visible = new Set();
    for (const side of SIDES) {
      view.sides[side].board.forEach((troop, slot) => {
        if (!troop) return;
        visible.add(troop.cardId);
        const {name} = CARDS[troop.cardId];
        if (!pieces.has(troop.cardId)) {
          const piece = name === 'Billy' ? clone(billy.root) : name === 'Wizard' ? clone(wizard.root) : tokens[name].clone(true);
          if (name === 'Billy' || name === 'Wizard') piece.scale.multiplyScalar(.86);
          pieces.set(troop.cardId, piece);
          scene.add(piece);
        }
        const tile = tileAt(side, slot);
        const piece = pieces.get(troop.cardId);
        piece.position.set(tile.x, tile.top, tile.z);
        piece.rotation.set(0, side === 'cowboy' ? Math.PI - .26 : .18, 0);
      });
    }
    for (const [cardId, piece] of pieces) {
      if (!visible.has(cardId)) {
        piece.removeFromParent();
        pieces.delete(cardId);
      }
    }
    draw();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    observer.disconnect();
    renderer.domElement.remove();
    onLost();
  }, { once: true });
  resize();
  return { point, update };
}
