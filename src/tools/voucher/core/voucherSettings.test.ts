import { describe, expect, it } from "vitest";
import {
  defaultVoucherSettings,
  formatLocalDate,
  normalisePrefix,
  pickFontFamily,
} from "./voucherSettings";

describe("defaultVoucherSettings", () => {
  it("starts today and ends 30 days later", () => {
    const settings = defaultVoucherSettings(new Date(2026, 10, 19));
    expect(settings.startDate).toBe("2026-11-19");
    expect(settings.endDate).toBe("2026-12-19");
  });

  it("carries the 30 days over a year end", () => {
    expect(defaultVoucherSettings(new Date(2026, 11, 15)).endDate).toBe("2027-01-14");
  });

  it("counts the 29th of February in a leap year", () => {
    expect(defaultVoucherSettings(new Date(2028, 1, 1)).endDate).toBe("2028-03-02");
  });

  it("holds the values of the old settings panel", () => {
    const settings = defaultVoucherSettings(new Date(2026, 10, 19));
    expect(settings).toMatchObject({
      fontFamily: "Impact",
      fontSizePx: 42,
      letterSpacingPx: 2,
      outlineThicknessPx: 1,
      codeColour: "#4a265a",
      outlineColour: "#ffffff",
      percentage: 10,
      appliesTo: "all",
      usageLimit: 1,
      oncePerCustomer: true,
      prefix: "SUMMER-",
      voucherCount: 100,
      randomLength: 8,
      numbersOnly: false,
    });
  });
});

describe("formatLocalDate", () => {
  it("pads the month and the day", () => {
    expect(formatLocalDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("normalisePrefix", () => {
  it("makes the prefix upper case", () => {
    expect(normalisePrefix("summer-")).toBe("SUMMER-");
  });

  it("keeps at most 20 characters", () => {
    expect(normalisePrefix("abcdefghijklmnopqrstuvwxyz")).toBe("ABCDEFGHIJKLMNOPQRST");
  });
});

describe("pickFontFamily", () => {
  it("keeps the wanted family when it is installed", () => {
    expect(pickFontFamily(["Arial", "Impact"], "Impact")).toBe("Impact");
  });

  it("falls back to the first installed family", () => {
    expect(pickFontFamily(["Arial", "Georgia"], "Impact")).toBe("Arial");
  });

  it("keeps the wanted family when the machine reported none", () => {
    expect(pickFontFamily([], "Impact")).toBe("Impact");
  });
});
