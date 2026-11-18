import { describe, expect, it } from "vitest";
import { clampedNumber, inRangeNumber } from "./numberInput";

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
