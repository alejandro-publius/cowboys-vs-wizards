// Deterministic generator for the boundary property tests. Local on purpose:
// it shares nothing with the engine's own shuffle generator.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a over the joined parts, so every (base seed, property, case index) has its own stream.
export function hashSeed(...parts) {
  let h = 0x811c9dc5;
  for (const char of parts.join("|")) h = Math.imul(h ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return h >>> 0;
}

const parsed = process.env.BOUNDARY_SEED === undefined ? 0xb0da : Number(process.env.BOUNDARY_SEED);
if (!Number.isInteger(parsed)) throw new TypeError("BOUNDARY_SEED must be an integer");
// Recorded base seed. Override with BOUNDARY_SEED=<integer> to explore other streams.
export const BASE_SEED = parsed;

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    int: (n) => Math.floor(next() * n),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle(items) {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

export const caseRng = (property, index, base = BASE_SEED) => makeRng(hashSeed(base, property, index));
