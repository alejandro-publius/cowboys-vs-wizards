// Seeded random numbers for Showdown and Boot Hill Poker: mulberry32 over one uint32 of state.
// Pure: no imports, no module state, and no globals read or written. Each generator owns its own state.
//
//   mulberry32(seed) -> next
//     seed    any finite number, wrapped to a uint32 the way both games do (truncate, then modulo 2^32),
//             so -1 is 4294967295, 2^32 + 5 is 5 and 1.9 is 1.
//     next()  adds 0x6d2b79f5 to the state and returns a float in [0, 1) that is a whole multiple of 2^-32.
//   Any other seed (NaN, Infinity, a string, null, undefined, a boolean, a bigint, an object) throws TypeError.
//   The two games read such seeds differently, so each keeps its own seed parsing and passes in a uint32.
//
export function mulberry32(seed) {
  if (typeof seed !== "number" || !Number.isFinite(seed)) {
    const got = typeof seed === "number" ? String(seed) : seed === null ? "null" : typeof seed;
    throw new TypeError(`mulberry32 seed must be a finite number, got ${got}`);
  }
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
