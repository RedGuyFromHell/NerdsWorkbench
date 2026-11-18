// Unique discount codes: prefix plus a random suffix. The random source is a parameter so a test
// can replay the draws; production uses the system's secure generator.

// Left out on purpose: 0, O, 1, I and l, which look alike on a printed voucher.
export const ALPHANUMERIC_POOL = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const NUMERIC_POOL = "0123456789";

// The pool must hold this many times more suffixes than codes, or finding a new one gets slow.
const POOL_HEADROOM = 10;
const UINT32_RANGE = 2 ** 32;

/** Returns a whole number from 0 up to, not including, `poolSize`. */
export type RandomIndex = (poolSize: number) => number;

export interface CodeGenOptions {
  prefix: string;
  length: number;
  count: number;
  numbersOnly?: boolean;
}

export function generateCryptoIndex(poolSize: number): number {
  // WHY: a plain `% poolSize` favours the low indexes when the pool does not divide 2^32
  // (10 digits do not), so draws above the largest whole multiple are thrown away.
  const largestMultiple = UINT32_RANGE - (UINT32_RANGE % poolSize);
  const draw = new Uint32Array(1);
  do {
    crypto.getRandomValues(draw);
  } while ((draw[0] ?? 0) >= largestMultiple);
  return (draw[0] ?? 0) % poolSize;
}

export function generateCodes(
  options: CodeGenOptions,
  randomIndex: RandomIndex = generateCryptoIndex,
): string[] {
  const { prefix, length, count, numbersOnly = false } = options;
  const pool = numbersOnly ? NUMERIC_POOL : ALPHANUMERIC_POOL;
  const possibleSuffixes = pool.length ** length;
  if (possibleSuffixes < count * POOL_HEADROOM) {
    throw new Error(
      `Pool too small: ${pool.length}^${length} = ${possibleSuffixes} possible values for ` +
        `${count} codes. Increase random character count.`,
    );
  }

  const codes = new Set<string>();
  while (codes.size < count) {
    let suffix = "";
    for (let position = 0; position < length; position += 1) {
      suffix += pool.charAt(randomIndex(pool.length));
    }
    codes.add(`${prefix}${suffix}`);
  }
  return [...codes];
}
