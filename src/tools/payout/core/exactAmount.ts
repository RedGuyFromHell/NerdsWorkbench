// Exact money for the payout maths: a fraction of bani on BigInt, always reduced, never a float.
// WHY: a painted line divides by a price (the discount ratio), so no fixed number of decimals is
// exact. A fraction is, and the one rounding per person per month then starts from the true sum.

/** An amount in bani. The denominator is above zero and the fraction is in lowest terms. */
export interface ExactAmount {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

const AMOUNT_TEXT = /^(-?\d+)\/(\d+)$/;

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let divisor = left < 0n ? -left : left;
  let remainder = right < 0n ? -right : right;
  while (remainder !== 0n) {
    [divisor, remainder] = [remainder, divisor % remainder];
  }
  return divisor;
}

/** Throws on a zero denominator: an amount that cannot exist must never look like a number. */
export function fromFraction(numerator: bigint, denominator: bigint): ExactAmount {
  if (denominator === 0n) throw new Error("An exact amount cannot have a zero denominator.");
  const divisor = greatestCommonDivisor(numerator, denominator);
  const sign = denominator < 0n ? -1n : 1n;
  return {
    numerator: (sign * numerator) / divisor,
    denominator: (sign * denominator) / divisor,
  };
}

/** Throws on anything but a whole, safe number: a float never enters the money path. */
export function fromBani(bani: number): ExactAmount {
  if (!Number.isSafeInteger(bani)) {
    throw new Error(`An amount must be a whole number of bani, got ${bani}.`);
  }
  return { numerator: BigInt(bani), denominator: 1n };
}

export const ZERO_AMOUNT: ExactAmount = fromBani(0);

export function add(left: ExactAmount, right: ExactAmount): ExactAmount {
  return fromFraction(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

export function subtract(left: ExactAmount, right: ExactAmount): ExactAmount {
  return add(left, { numerator: -right.numerator, denominator: right.denominator });
}

export function multiply(left: ExactAmount, right: ExactAmount): ExactAmount {
  return fromFraction(left.numerator * right.numerator, left.denominator * right.denominator);
}

/** Throws on a division by zero. */
export function divide(left: ExactAmount, right: ExactAmount): ExactAmount {
  return fromFraction(left.numerator * right.denominator, left.denominator * right.numerator);
}

/** -1 when left is the smaller, 1 when it is the larger, 0 when they are equal. */
export function compare(left: ExactAmount, right: ExactAmount): -1 | 0 | 1 {
  const difference = left.numerator * right.denominator - right.numerator * left.denominator;
  if (difference === 0n) return 0;
  return difference < 0n ? -1 : 1;
}

export function maxOf(left: ExactAmount, right: ExactAmount): ExactAmount {
  return compare(left, right) >= 0 ? left : right;
}

/** Whole bani, half away from zero: 0.5 gives 1 and -0.5 gives -1. */
export function roundToBani(amount: ExactAmount): number {
  const isNegative = amount.numerator < 0n;
  const magnitude = isNegative ? -amount.numerator : amount.numerator;
  const roundedMagnitude = (2n * magnitude + amount.denominator) / (2n * amount.denominator);
  const bani = Number(isNegative ? -roundedMagnitude : roundedMagnitude);
  if (!Number.isSafeInteger(bani)) throw new Error("The amount is too large to round to bani.");
  return bani;
}

/** The stored form, "n/d". BigInt has no JSON form, so an amount crosses every boundary as this. */
export function formatAmount(amount: ExactAmount): string {
  return `${amount.numerator}/${amount.denominator}`;
}

/** Reads the stored form back. Throws on any other text. */
export function parseAmount(text: string): ExactAmount {
  const match = AMOUNT_TEXT.exec(text);
  if (match?.[1] === undefined || match[2] === undefined) {
    throw new Error(`"${text}" is not an exact amount (expected "n/d").`);
  }
  return fromFraction(BigInt(match[1]), BigInt(match[2]));
}
