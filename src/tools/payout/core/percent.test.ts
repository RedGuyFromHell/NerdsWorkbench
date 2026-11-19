import { describe, expect, it } from "vitest";
import { basisPointsToPercent, percentToBasisPoints } from "./percent";

describe("percentToBasisPoints", () => {
  it("reads whole and decimal percents", () => {
    expect(percentToBasisPoints("3")).toBe(300);
    expect(percentToBasisPoints("2.5")).toBe(250);
    expect(percentToBasisPoints("2.05")).toBe(205);
    expect(percentToBasisPoints("0.25")).toBe(25);
    expect(percentToBasisPoints("60")).toBe(6000);
    expect(percentToBasisPoints("0")).toBe(0);
    expect(percentToBasisPoints("100")).toBe(10000);
  });

  it("is exact where a float multiplication is not", () => {
    // 1.15 * 100 is 114.99999999999999 in floating point.
    expect(percentToBasisPoints("1.15")).toBe(115);
    expect(percentToBasisPoints("0.07")).toBe(7);
  });

  it("ignores spaces around the number", () => {
    expect(percentToBasisPoints(" 2.5 ")).toBe(250);
  });

  it("rejects more than 2 decimals", () => {
    expect(percentToBasisPoints("2.505")).toBeNull();
    expect(percentToBasisPoints("2.500")).toBeNull();
  });

  it("rejects what is not a plain number", () => {
    for (const text of ["", " ", "abc", "2.", ".5", "-2", "+2", "3%", "1e2", "2,5", "2.5.1"]) {
      expect(percentToBasisPoints(text)).toBeNull();
    }
  });

  it("rejects more than 100 percent", () => {
    expect(percentToBasisPoints("100.01")).toBeNull();
    expect(percentToBasisPoints("250")).toBeNull();
  });
});

describe("basisPointsToPercent", () => {
  it("writes the shortest percent", () => {
    expect(basisPointsToPercent(300)).toBe("3");
    expect(basisPointsToPercent(250)).toBe("2.5");
    expect(basisPointsToPercent(205)).toBe("2.05");
    expect(basisPointsToPercent(25)).toBe("0.25");
    expect(basisPointsToPercent(7)).toBe("0.07");
    expect(basisPointsToPercent(0)).toBe("0");
    expect(basisPointsToPercent(10000)).toBe("100");
  });

  it("round trips with percentToBasisPoints", () => {
    for (const basisPoints of [0, 1, 10, 115, 999, 6000, 10000]) {
      expect(percentToBasisPoints(basisPointsToPercent(basisPoints))).toBe(basisPoints);
    }
  });
});
