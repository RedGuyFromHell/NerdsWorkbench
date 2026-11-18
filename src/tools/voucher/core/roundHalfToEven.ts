// Python's `round()` for floats: an exact half goes to the even neighbour, so 2.5 gives 2.
// JavaScript's Math.round sends every half up, which would move a pixel the old app did not.

export function roundHalfToEven(value: number): number {
  const lower = Math.floor(value);
  const fraction = value - lower;
  if (fraction < 0.5) return lower;
  if (fraction > 0.5) return lower + 1;
  return lower % 2 === 0 ? lower : lower + 1;
}
