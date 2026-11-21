export const SIDES = ["cowboy", "wizard"];
export const COLORS = {
  cowboy: { metal: 0x985d43, tile: 0xa27855, line: 0xe9b775, dark: 0x624334, orb: 0xffb85e },
  wizard: { metal: 0x55657a, tile: 0x516879, line: 0xb5c9ca, dark: 0x374b5d, orb: 0x8be3da },
};
const ZONES = {
  base: [12.6, 0, -0.4],
  deck: [10.0, 0, 4.72],
  discard: [13.13, 0, 4.72],
  trap: [8.72, 0, -3.28],
};
const CENTER = { location: [0, 0, 0.35], row: [5.14, 0, -0.22] };
export function zone(side, at, slot = 0) {
  if (at === "location") return CENTER.location;
  const direction = side === "cowboy" ? -1 : 1;
  if (at === "troop") return [direction * 5.13, 0, -3.35 + slot * 3.15];
  const [x, y, z] = ZONES[at] ?? CENTER.row;
  return [direction * x, y, z + (at === "trap" ? slot * 2.12 : 0)];
}
