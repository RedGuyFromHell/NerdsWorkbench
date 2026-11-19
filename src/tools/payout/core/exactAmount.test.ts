import { describe, expect, it } from "vitest";
import {
  add,
  compare,
  divide,
  formatAmount,
  fromBani,
  fromFraction,
  maxOf,
  multiply,
  parseAmount,
  roundToBani,
  subtract,
  ZERO_AMOUNT,
} from "./exactAmount";

describe("fromFraction", () => {
  it("reduces to lowest terms", () => {
    expect(fromFraction(6n, 4n)).toEqual({ numerator: 3n, denominator: 2n });
  });

  it("keeps the sign on the numerator, never on the denominator", () => {
    expect(fromFraction(3n, -6n)).toEqual({ numerator: -1n, denominator: 2n });
    expect(fromFraction(-3n, -6n)).toEqual({ numerator: 1n, denominator: 2n });
  });

  it("writes zero as 0/1 whatever the denominator", () => {
    expect(fromFraction(0n, -7n)).toEqual({ numerator: 0n, denominator: 1n });
  });

  it("throws on a zero denominator", () => {
    expect(() => fromFraction(1n, 0n)).toThrow(/zero denominator/);
  });
});

describe("fromBani", () => {
  it("is the whole number of bani over 1", () => {
    expect(fromBani(62000)).toEqual({ numerator: 62000n, denominator: 1n });
    expect(fromBani(-5)).toEqual({ numerator: -5n, denominator: 1n });
    expect(ZERO_AMOUNT).toEqual({ numerator: 0n, denominator: 1n });
  });

  it("throws on a float, so a float never enters the money path", () => {
    expect(() => fromBani(12.5)).toThrow(/whole number of bani/);
    expect(() => fromBani(Number.NaN)).toThrow(/whole number of bani/);
  });
});

describe("the four operations", () => {
  const third = fromFraction(1n, 3n);
  const half = fromFraction(1n, 2n);

  it("adds", () => {
    expect(add(third, half)).toEqual({ numerator: 5n, denominator: 6n });
  });

  it("adds three thirds to exactly one", () => {
    expect(add(add(third, third), third)).toEqual({ numerator: 1n, denominator: 1n });
  });

  it("subtracts", () => {
    expect(subtract(third, half)).toEqual({ numerator: -1n, denominator: 6n });
  });

  it("multiplies and reduces", () => {
    expect(multiply(fromFraction(2n, 3n), fromFraction(3n, 4n))).toEqual({
      numerator: 1n,
      denominator: 2n,
    });
  });

  it("divides", () => {
    expect(divide(half, third)).toEqual({ numerator: 3n, denominator: 2n });
  });

  it("divides by a negative amount with the sign on the numerator", () => {
    expect(divide(half, fromBani(-2))).toEqual({ numerator: -1n, denominator: 4n });
  });

  it("throws on a division by zero", () => {
    expect(() => divide(half, ZERO_AMOUNT)).toThrow(/zero denominator/);
  });
});

describe("compare and maxOf", () => {
  it("orders amounts with different denominators", () => {
    expect(compare(fromFraction(1n, 3n), fromFraction(1n, 2n))).toBe(-1);
    expect(compare(fromFraction(1n, 2n), fromFraction(1n, 3n))).toBe(1);
    expect(compare(fromFraction(2n, 4n), fromFraction(1n, 2n))).toBe(0);
  });

  it("orders negative amounts", () => {
    expect(compare(fromFraction(-1n, 2n), fromFraction(-1n, 3n))).toBe(-1);
  });

  it("maxOf gives the larger", () => {
    expect(maxOf(fromBani(840), fromBani(2000))).toEqual(fromBani(2000));
    expect(maxOf(fromBani(2400), fromBani(2000))).toEqual(fromBani(2400));
  });
});

describe("roundToBani (half away from zero)", () => {
  it("leaves a whole number alone", () => {
    expect(roundToBani(fromBani(10206))).toBe(10206);
    expect(roundToBani(fromBani(-10206))).toBe(-10206);
  });

  it("rounds a half ban up", () => {
    expect(roundToBani(fromFraction(1n, 2n))).toBe(1);
    expect(roundToBani(fromFraction(25n, 2n))).toBe(13);
  });

  it("rounds a negative half ban away from zero", () => {
    expect(roundToBani(fromFraction(-1n, 2n))).toBe(-1);
    expect(roundToBani(fromFraction(-25n, 2n))).toBe(-13);
  });

  it("rounds just under a half towards zero", () => {
    expect(roundToBani(fromFraction(49n, 100n))).toBe(0);
    expect(roundToBani(fromFraction(-49n, 100n))).toBe(0);
    expect(roundToBani(fromFraction(1249n, 100n))).toBe(12);
  });

  it("rounds just over a half away from zero", () => {
    expect(roundToBani(fromFraction(51n, 100n))).toBe(1);
    expect(roundToBani(fromFraction(-51n, 100n))).toBe(-1);
  });

  it("rounds thirds to the nearest", () => {
    expect(roundToBani(fromFraction(1n, 3n))).toBe(0);
    expect(roundToBani(fromFraction(2n, 3n))).toBe(1);
    expect(roundToBani(fromFraction(-2n, 3n))).toBe(-1);
  });

  it("throws when the result does not fit a safe integer", () => {
    expect(() => roundToBani(fromFraction(10n ** 20n, 1n))).toThrow(/too large/);
  });
});

describe("formatAmount and parseAmount", () => {
  it('writes "n/d"', () => {
    expect(formatAmount(fromFraction(46228n, 5n))).toBe("46228/5");
    expect(formatAmount(fromBani(-770))).toBe("-770/1");
  });

  it("round trips through the string", () => {
    for (const amount of [fromFraction(20000n, 3n), fromBani(0), fromFraction(-1n, 200n)]) {
      expect(parseAmount(formatAmount(amount))).toEqual(amount);
    }
  });

  it("reduces what it parses", () => {
    expect(parseAmount("6/4")).toEqual({ numerator: 3n, denominator: 2n });
  });

  it("throws on anything that is not n/d", () => {
    for (const text of ["", "12", "1/", "/2", "1.5/2", "1/-2", " 1/2", "a/b", "1/2/3"]) {
      expect(() => parseAmount(text)).toThrow(/not an exact amount/);
    }
  });

  it("throws on a zero denominator", () => {
    expect(() => parseAmount("1/0")).toThrow(/zero denominator/);
  });
});
