import { describe, expect, it } from "vitest";
import { formatLei } from "./formatLei";

describe("formatLei", () => {
  it("always shows two decimals", () => {
    expect(formatLei(62000)).toBe("620.00");
    expect(formatLei(1250)).toBe("12.50");
    expect(formatLei(0)).toBe("0.00");
  });

  it("keeps a leading zero under one leu", () => {
    expect(formatLei(5)).toBe("0.05");
    expect(formatLei(99)).toBe("0.99");
  });

  it("groups thousands with a comma", () => {
    expect(formatLei(100000)).toBe("1,000.00");
    expect(formatLei(123456789)).toBe("1,234,567.89");
    expect(formatLei(99900)).toBe("999.00");
  });

  it("writes a negative amount with a minus sign", () => {
    expect(formatLei(-3409)).toBe("−34.09");
    expect(formatLei(-5)).toBe("−0.05");
    expect(formatLei(-123456)).toBe("−1,234.56");
  });

  it("refuses an amount that is not whole bani", () => {
    expect(() => formatLei(1.5)).toThrow("whole number of bani");
  });
});
