import { describe, expect, it } from "vitest";
import {
  ALPHANUMERIC_POOL,
  generateCodes,
  generateCryptoIndex,
  NUMERIC_POOL,
  type RandomIndex,
} from "./codeGen";

const AMBIGUOUS_CHARACTERS = new Set("0O1Il");

// A small seeded generator (mulberry32), so every run draws the same codes.
function seededIndex(seed: number): RandomIndex {
  let state = seed;
  return (poolSize) => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return Math.floor((((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296) * poolSize);
  };
}

// Plays back a fixed list of draws, then repeats it.
function scriptedIndex(draws: readonly number[]): RandomIndex {
  let next = 0;
  return () => {
    const draw = draws[next % draws.length];
    next += 1;
    if (draw === undefined) throw new Error("scriptedIndex needs at least one draw");
    return draw;
  };
}

describe("generateCodes", () => {
  it("starts every code with the prefix", () => {
    const codes = generateCodes({ prefix: "SUMMER-", length: 6, count: 50 }, seededIndex(1));

    expect(codes.every((code) => code.startsWith("SUMMER-"))).toBe(true);
  });

  it("gives the suffix the requested length", () => {
    const codes = generateCodes({ prefix: "VIP", length: 8, count: 50 }, seededIndex(2));

    expect(codes.every((code) => code.length === "VIP".length + 8)).toBe(true);
  });

  it("gives the suffix alone when the prefix is empty", () => {
    const codes = generateCodes({ prefix: "", length: 5, count: 20 }, seededIndex(3));

    expect(codes.every((code) => code.length === 5)).toBe(true);
  });

  it("returns exactly count codes", () => {
    expect(generateCodes({ prefix: "A", length: 6, count: 37 }, seededIndex(4))).toHaveLength(37);
  });

  it("returns no codes for a count of zero", () => {
    expect(generateCodes({ prefix: "A", length: 6, count: 0 }, seededIndex(5))).toEqual([]);
  });

  it("keeps the codes unique when the pool is tight", () => {
    // 1000 possible suffixes for 100 codes (the 10x minimum).
    const codes = generateCodes(
      { prefix: "N", length: 3, count: 100, numbersOnly: true },
      seededIndex(6),
    );

    expect(new Set(codes).size).toBe(100);
  });

  it("skips a code the random source repeats", () => {
    // Draws 0,0,0 twice then 1,1,1: the second "000" is a repeat and must be dropped.
    const codes = generateCodes(
      { prefix: "", length: 3, count: 2, numbersOnly: true },
      scriptedIndex([0, 0, 0, 0, 0, 0, 1, 1, 1]),
    );

    expect(codes).toEqual(["000", "111"]);
  });

  it("builds the default suffix from letters and digits without ambiguous characters", () => {
    const codes = generateCodes({ prefix: "", length: 12, count: 200 }, seededIndex(7));

    const used = new Set(codes.join(""));
    expect([...used].some((character) => AMBIGUOUS_CHARACTERS.has(character))).toBe(false);
    expect([...used].every((character) => ALPHANUMERIC_POOL.includes(character))).toBe(true);
  });

  it("can reach every character of the default pool, and only those", () => {
    // Walks the pool index by index: 32 draws give the whole alphabet in order.
    let next = 0;
    const walk: RandomIndex = () => next++;

    const codes = generateCodes({ prefix: "", length: 32, count: 1 }, walk);

    expect(codes).toEqual(["ABCDEFGHJKLMNPQRSTUVWXYZ23456789"]);
  });

  it("builds a numbers-only suffix from digits", () => {
    const codes = generateCodes(
      { prefix: "PRE", length: 6, count: 50, numbersOnly: true },
      seededIndex(8),
    );

    expect(codes.every((code) => /^\d{6}$/.test(code.slice("PRE".length)))).toBe(true);
  });

  it("keeps a prefix that has letters in numbers-only mode", () => {
    const codes = generateCodes(
      { prefix: "ABC", length: 6, count: 5, numbersOnly: true },
      seededIndex(9),
    );

    expect(codes.every((code) => code.startsWith("ABC"))).toBe(true);
  });

  it("accepts a pool exactly ten times the count", () => {
    // 10 digits ** 1 = 10 possible values, 1 code * 10 = 10: the boundary passes.
    const codes = generateCodes(
      { prefix: "", length: 1, count: 1, numbersOnly: true },
      seededIndex(10),
    );

    expect(codes).toHaveLength(1);
  });

  it("refuses a pool just under ten times the count", () => {
    // 10 possible values for 2 codes needs 20.
    expect(() =>
      generateCodes({ prefix: "", length: 1, count: 2, numbersOnly: true }, seededIndex(11)),
    ).toThrow("Pool too small");
  });

  it("refuses one code over the ten times rule and accepts the count at it", () => {
    // 100 possible values: 11 codes need 110 (refused), 10 codes need exactly 100 (accepted).
    expect(() =>
      generateCodes({ prefix: "", length: 2, count: 11, numbersOnly: true }, seededIndex(16)),
    ).toThrow("Pool too small");
    expect(
      generateCodes({ prefix: "", length: 2, count: 10, numbersOnly: true }, seededIndex(17)),
    ).toHaveLength(10);
  });

  it("cannot make a code from a zero-length suffix", () => {
    expect(() => generateCodes({ prefix: "A", length: 0, count: 1 }, seededIndex(12))).toThrow(
      "Pool too small",
    );
  });

  it("checks the pool size against the chosen alphabet", () => {
    // Letters and digits: 32 ** 1 = 32 < 40, refused. Digits at length 2: 100 >= 40, fine.
    expect(() => generateCodes({ prefix: "", length: 1, count: 4 }, seededIndex(13))).toThrow(
      "Pool too small",
    );
    expect(
      generateCodes({ prefix: "", length: 2, count: 4, numbersOnly: true }, seededIndex(14)),
    ).toHaveLength(4);
  });

  it("says how many values the pool holds when it refuses", () => {
    expect(() => generateCodes({ prefix: "", length: 1, count: 4 }, seededIndex(15))).toThrow(
      "Pool too small: 32^1 = 32 possible values for 4 codes. Increase random character count.",
    );
  });
});

describe("generateCryptoIndex", () => {
  it("returns whole numbers inside the pool for both pool sizes", () => {
    for (const pool of [ALPHANUMERIC_POOL, NUMERIC_POOL]) {
      for (let draw = 0; draw < 500; draw += 1) {
        const index = generateCryptoIndex(pool.length);
        expect(Number.isInteger(index)).toBe(true);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(pool.length);
      }
    }
  });

  it("is what generateCodes uses when no source is given", () => {
    const codes = generateCodes({ prefix: "X-", length: 8, count: 5 });

    expect(codes).toHaveLength(5);
    expect(codes.every((code) => /^X-[A-Z2-9]{8}$/.test(code))).toBe(true);
  });
});
