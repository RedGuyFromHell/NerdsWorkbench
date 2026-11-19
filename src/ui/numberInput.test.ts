import { describe, expect, it } from "vitest";
import { clampedNumber, inRangeNumber, settledNumber } from "./numberInput";

describe("inRangeNumber", () => {
  it("gives the number when the text is inside the range, ends included", () => {
    expect(inRangeNumber("0.5", 0.2, 10)).toBe(0.5);
    expect(inRangeNumber("0.2", 0.2, 10)).toBe(0.2);
    expect(inRangeNumber("10", 0.2, 10)).toBe(10);
  });

  it("gives null for a number outside the range, so typing '0' on the way to '0.5' reports nothing", () => {
    expect(inRangeNumber("0", 0.2, 10)).toBeNull();
    expect(inRangeNumber("11", 0.2, 10)).toBeNull();
  });

  it("gives null for text that is not a number yet", () => {
    expect(inRangeNumber("", 0, 10)).toBeNull();
    expect(inRangeNumber("  ", 0, 10)).toBeNull();
    expect(inRangeNumber("-", -5, 10)).toBeNull();
    expect(inRangeNumber("abc", 0, 10)).toBeNull();
  });
});

describe("inRangeNumber: decimal comma", () => {
  it("reads a comma as the decimal separator", () => {
    expect(inRangeNumber("12,5", 0, 100)).toBe(12.5);
    expect(inRangeNumber("0,5", 0.2, 10)).toBe(0.5);
    expect(inRangeNumber("12,", 0, 100)).toBe(12);
  });

  it("gives null when a comma could be a thousands separator", () => {
    expect(inRangeNumber("1,234.5", 0, 10000)).toBeNull();
    expect(inRangeNumber("1,2,3", 0, 10000)).toBeNull();
  });
});

describe("inRangeNumber: rounding", () => {
  it("rounds to a whole number when asked for no decimals", () => {
    expect(inRangeNumber("12.4", 1, 100, 0)).toBe(12);
    expect(inRangeNumber("12.5", 1, 100, 0)).toBe(13);
    expect(inRangeNumber("7,6", 1, 100, 0)).toBe(8);
  });

  it("rounds to the decimals asked for", () => {
    expect(inRangeNumber("12.346", 1, 100, 2)).toBe(12.35);
    expect(inRangeNumber("12.5", 1, 100, 2)).toBe(12.5);
  });

  it("checks the range after rounding", () => {
    expect(inRangeNumber("0.4", 1, 100, 0)).toBeNull();
    expect(inRangeNumber("0.6", 1, 100, 0)).toBe(1);
    expect(inRangeNumber("100.4", 1, 100, 0)).toBe(100);
    expect(inRangeNumber("100.6", 1, 100, 0)).toBeNull();
  });
});

describe("settledNumber", () => {
  const PERCENTAGE = { min: 1, max: 100, decimals: 2 };

  // WARNING: this is money. "1000" typed for 10 % must never settle on the maximum, 100 %.
  it("goes back to the last valid value when the text is outside the range, never to the nearest end", () => {
    expect(settledNumber("1000", 10, PERCENTAGE)).toBe(10);
    expect(settledNumber("0", 10, PERCENTAGE)).toBe(10);
  });

  it("goes back to the last valid value when the text is not a number", () => {
    expect(settledNumber("", 10, PERCENTAGE)).toBe(10);
    expect(settledNumber("abc", 10, PERCENTAGE)).toBe(10);
  });

  it("keeps a number inside the range, rounded", () => {
    expect(settledNumber("25", 10, PERCENTAGE)).toBe(25);
    expect(settledNumber("12,346", 10, PERCENTAGE)).toBe(12.35);
    expect(settledNumber("7.6", 3, { min: 1, max: 100, decimals: 0 })).toBe(8);
  });
});

describe("clampedNumber", () => {
  it("clamps a number outside the range to the nearest end", () => {
    expect(clampedNumber("0", 0.2, 10)).toBe(0.2);
    expect(clampedNumber("99", 0.2, 10)).toBe(10);
    expect(clampedNumber("4.5", 0.2, 10)).toBe(4.5);
  });

  it("gives null for text that is not a number", () => {
    expect(clampedNumber("", 0, 10)).toBeNull();
    expect(clampedNumber("-", -5, 10)).toBeNull();
  });
});
