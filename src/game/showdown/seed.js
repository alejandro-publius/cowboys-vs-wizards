// Showdown deals and exported Wizard episodes both use an unsigned 32-bit seed.
export const isDealSeed = (value) => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;

export function parseDealSeed(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  const seed = Number(text);
  return isDealSeed(seed) ? seed : null;
}
