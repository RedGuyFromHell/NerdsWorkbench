import { describe, expect, it } from "vitest";
import {
  formatBaniText,
  formatTagList,
  parseLineList,
  parseMoneyText,
  parsePercentText,
  parseTagList,
} from "./fieldText";

describe("parsePercentText", () => {
  it("reads whole and decimal percents as basis points", () => {
    expect(parsePercentText("7")).toBe(700);
    expect(parsePercentText("33.33")).toBe(3333);
    expect(parsePercentText(" 0 ")).toBe(0);
    expect(parsePercentText("100")).toBe(10_000);
  });

  it("accepts a comma as the decimal mark, because the keyboard may type one", () => {
    expect(parsePercentText("2,5")).toBe(250);
    expect(parsePercentText("12,25")).toBe(1225);
  });

  it("refuses a comma and a dot together, and a comma that is not one decimal mark", () => {
    expect(parsePercentText("1,000.5")).toBeNull();
    expect(parsePercentText("1,5,5")).toBeNull();
    expect(parsePercentText("1,000")).toBeNull();
  });

  it("refuses text that is not a percent from 0 to 100", () => {
    expect(parsePercentText("")).toBeNull();
    expect(parsePercentText("abc")).toBeNull();
    expect(parsePercentText("-1")).toBeNull();
    expect(parsePercentText("100.01")).toBeNull();
    expect(parsePercentText("101")).toBeNull();
    expect(parsePercentText("3%")).toBeNull();
  });
});

describe("parseMoneyText and formatBaniText", () => {
  it("reads an amount in lei as whole bani, dot or comma", () => {
    expect(parseMoneyText("12")).toBe(1200);
    expect(parseMoneyText("12.5")).toBe(1250);
    expect(parseMoneyText("12,50")).toBe(1250);
    expect(parseMoneyText("0.05")).toBe(5);
    expect(parseMoneyText(" 0 ")).toBe(0);
  });

  it("refuses what is not an amount of at most 2 decimals", () => {
    expect(parseMoneyText("")).toBeNull();
    expect(parseMoneyText("-3")).toBeNull();
    expect(parseMoneyText("1.234")).toBeNull();
    expect(parseMoneyText("1.2.3")).toBeNull();
    expect(parseMoneyText("1,000.00")).toBeNull();
    expect(parseMoneyText("12 lei")).toBeNull();
    expect(parseMoneyText("1234567890")).toBeNull();
  });

  it("writes bani back as the shortest text, with 2 decimals when there are any", () => {
    expect(formatBaniText(1200)).toBe("12");
    expect(formatBaniText(1250)).toBe("12.50");
    expect(formatBaniText(5)).toBe("0.05");
    expect(formatBaniText(0)).toBe("0");
  });

  it("round-trips", () => {
    for (const bani of [0, 1, 99, 100, 1234, 987_654_321]) {
      expect(parseMoneyText(formatBaniText(bani))).toBe(bani);
    }
  });
});

describe("parseTagList", () => {
  it("splits on commas, trims, and lower-cases", () => {
    expect(parseTagList("mini, Figurine ,  STATUE")).toEqual(["mini", "figurine", "statue"]);
  });

  it("drops empty entries and repeats", () => {
    expect(parseTagList(",, mini,,Mini , ,resin,")).toEqual(["mini", "resin"]);
    expect(parseTagList("")).toEqual([]);
    expect(parseTagList("  ,  ")).toEqual([]);
  });

  it("collapses inner spaces so two spellings are one tag", () => {
    expect(parseTagList("big   resin, big resin")).toEqual(["big resin"]);
  });

  it("is undone by formatTagList", () => {
    expect(formatTagList(["mini", "resin"])).toBe("mini, resin");
    expect(parseTagList(formatTagList(["mini", "big resin"]))).toEqual(["mini", "big resin"]);
  });
});

describe("parseLineList", () => {
  it("gives one entry per line, keeping the spelling; a comma inside a title stays", () => {
    expect(parseLineList("Product One, large\n  Product Two  \n")).toEqual([
      "Product One, large",
      "Product Two",
    ]);
  });

  it("drops blank lines and repeats that differ only in case or spacing", () => {
    expect(parseLineList("A b\r\n\r\na  B\nC")).toEqual(["A b", "C"]);
    expect(parseLineList("")).toEqual([]);
  });
});
