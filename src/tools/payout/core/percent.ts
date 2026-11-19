// Percent fields of Settings › Payout. A rate is stored as whole basis points (3% is 300), so the
// maths never multiplies by a float. The text is read digit by digit for the same reason.

const BASIS_POINTS_PER_PERCENT = 100;
const MAX_BASIS_POINTS = 100 * BASIS_POINTS_PER_PERCENT;

/** A plain number with at most 2 decimals: "2", "2.5", "2.05". No sign, no exponent. */
const PERCENT_TEXT = /^(\d+)(?:\.(\d{1,2}))?$/;

/** Basis points of a typed percent, or null when the text is not a percent from 0 to 100 with at most 2 decimals. */
export function percentToBasisPoints(text: string): number | null {
  const match = PERCENT_TEXT.exec(text.trim());
  if (match?.[1] === undefined) return null;
  const hundredths = (match[2] ?? "").padEnd(2, "0");
  const basisPoints = Number(match[1]) * BASIS_POINTS_PER_PERCENT + Number(hundredths);
  return basisPoints <= MAX_BASIS_POINTS ? basisPoints : null;
}

/** The shortest percent text for the field: 200 gives "2", 250 gives "2.5", 205 gives "2.05". */
export function basisPointsToPercent(basisPoints: number): string {
  const whole = Math.floor(basisPoints / BASIS_POINTS_PER_PERCENT);
  const hundredths = basisPoints % BASIS_POINTS_PER_PERCENT;
  if (hundredths === 0) return String(whole);
  return `${whole}.${String(hundredths).padStart(2, "0").replace(/0$/, "")}`;
}
