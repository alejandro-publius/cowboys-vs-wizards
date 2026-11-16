// Procedural health orbs for Orb Duel (no orb assets). A row holds up to
// MAX_ORBS small emissive spheres; set(n) shows exactly the first n, centred.
// Rows of one size share one geometry and each faction shares one material,
// so nothing here needs disposing. Orb meshes carry userData.orb = true.
import * as T from "three";

export const MAX_ORBS = 5;

// The emissive part keeps the orbs readable under the board's warm key light.
const MATERIALS = {
  cowboy: new T.MeshStandardMaterial({color: 0xffd08a, emissive: 0xf0953a, emissiveIntensity: 1.25, roughness: .3}),
  wizard: new T.MeshStandardMaterial({color: 0xe8c4ff, emissive: 0xa35ff2, emissiveIntensity: 1.35, roughness: .3}),
};
const SIZES = {
  troop: {geometry: new T.SphereGeometry(.075, 16, 12), gap: .21},
  base: {geometry: new T.SphereGeometry(.12, 20, 14), gap: .32},
};

function orbRow(side, size) {
  const material = MATERIALS[side];
  if (!material) throw new TypeError(`unknown side "${side}"`);
  const {geometry, gap} = SIZES[size];
  const group = new T.Group();
  group.name = `${side}-${size}-orbs`;
  const orbs = Array.from({length: MAX_ORBS}, (_, i) => {
    const orb = new T.Mesh(geometry, material);
    orb.name = `orb-${i}`;
    orb.userData.orb = true;
    orb.visible = false;
    group.add(orb);
    return orb;
  });
  let shown = 0;
  return {
    group,
    count: () => shown,
    set(n) {
      if (!Number.isInteger(n) || n < 0 || n > MAX_ORBS) {
        throw new RangeError(`orb count must be an integer from 0 to ${MAX_ORBS}, got ${n}`);
      }
      shown = n;
      orbs.forEach((orb, i) => {
        orb.visible = i < n;
        orb.position.set((i - (n - 1) / 2) * gap, 0, 0);
      });
    },
  };
}

// A troop's row. The caller places row.group above the piece.
export const createTroopOrbs = (side) => orbRow(side, "troop");

// A Base's row, placed above its structure (the Saloon or the Gateway).
export function createBaseOrbs(side, structure) {
  const row = orbRow(side, "base");
  const box = new T.Box3().setFromObject(structure);
  const center = box.getCenter(new T.Vector3());
  row.group.position.set(center.x, box.max.y + .32, center.z);
  return row;
}
