import { describe, expect, it } from "vitest";
import { roundHalfToEven } from "./roundHalfToEven";

describe("roundHalfToEven", () => {
  it("sends an exact half to the even neighbour, like Python round", () => {
    expect(roundHalfToEven(0.5)).toBe(0);
    expect(roundHalfToEven(1.5)).toBe(2);
    expect(roundHalfToEven(2.5)).toBe(2);
    expect(roundHalfToEven(3.5)).toBe(4);
  });

  it("sends an exact negative half to the even neighbour", () => {
    expect(roundHalfToEven(-0.5)).toBe(0);
    expect(roundHalfToEven(-1.5)).toBe(-2);
    expect(roundHalfToEven(-2.5)).toBe(-2);
  });

  it("rounds everything that is not a half to the nearest integer", () => {
    expect(roundHalfToEven(2.4)).toBe(2);
    expect(roundHalfToEven(2.6)).toBe(3);
    expect(roundHalfToEven(-2.6)).toBe(-3);
    expect(roundHalfToEven(7)).toBe(7);
  });
});
