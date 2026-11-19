// Rounds an exact half to the even neighbour, so 2.5 gives 2 and 3.5 gives 4. JavaScript's
// Math.round sends every half up, which would shift a pixel or a percentage by one.

export function roundHalfToEven(value: number): number {
  const lower = Math.floor(value);
  const fraction = value - lower;
  if (fraction < 0.5) return lower;
  if (fraction > 0.5) return lower + 1;
  return lower % 2 === 0 ? lower : lower + 1;
}
