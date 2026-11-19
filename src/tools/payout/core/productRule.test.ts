import { describe, expect, it } from "vitest";
import { isPayoutLine } from "./productRule";
import type { ProductRule } from "./productRule";

// Every product here is made up.

const RULE: ProductRule = {
  includeTags: ["mini", "figurine", "statue", "resin"],
  excludeTags: ["filament", "dice"],
  extraProductTitles: ["Custom Size Add-on"],
};

function line(productTitle: string, productTags: string[]) {
  return { productTitle, productTags };
}

describe("isPayoutLine", () => {
  it.each(["mini", "figurine", "statue", "resin"])("counts a product tagged %s", (tag) => {
    expect(isPayoutLine(line("Moon Owl", ["new", tag]), RULE)).toBe(true);
  });

  it.each(["filament", "dice"])("leaves out a product tagged %s, whatever else it has", (tag) => {
    expect(isPayoutLine(line("Moon Owl", ["mini", tag]), RULE)).toBe(false);
  });

  it("leaves out a product with none of the include tags", () => {
    expect(isPayoutLine(line("Felt Mat", ["accessory"]), RULE)).toBe(false);
    expect(isPayoutLine(line("Felt Mat", []), RULE)).toBe(false);
  });

  it("compares tags in lower case, on both sides", () => {
    expect(isPayoutLine(line("Moon Owl", ["Mini"]), RULE)).toBe(true);
    expect(isPayoutLine(line("Moon Owl", ["mini", " DICE "]), RULE)).toBe(false);
    expect(isPayoutLine(line("Moon Owl", ["resin"]), { ...RULE, includeTags: ["RESIN"] })).toBe(
      true,
    );
  });

  it("does not match a tag that only holds an include tag", () => {
    expect(isPayoutLine(line("Felt Mat", ["minimal"]), RULE)).toBe(false);
  });

  it("counts an extra product by its title, with no tag at all", () => {
    expect(isPayoutLine(line("Custom Size Add-on", []), RULE)).toBe(true);
  });

  it("counts an extra product even when it has an exclude tag", () => {
    expect(isPayoutLine(line("Custom Size Add-on", ["dice"]), RULE)).toBe(true);
  });

  it("matches an extra product whatever the case and the spaces around the title", () => {
    expect(isPayoutLine(line("  custom size ADD-ON ", []), RULE)).toBe(true);
  });

  it("does not count a product whose title only starts like an extra product", () => {
    expect(isPayoutLine(line("Custom Size Add-on Deluxe", []), RULE)).toBe(false);
  });

  it("counts nothing with an empty rule", () => {
    const emptyRule: ProductRule = { includeTags: [], excludeTags: [], extraProductTitles: [] };
    expect(isPayoutLine(line("Moon Owl", ["mini"]), emptyRule)).toBe(false);
  });
});
