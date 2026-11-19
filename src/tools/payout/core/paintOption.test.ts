import { describe, expect, it } from "vitest";
import { findPrimedSibling, resolvePaintOption } from "./paintOption";
import type { RawOption, RawVariant } from "./rawOrder";

// Every product, price and cost here is made up.

function sizeAndPaint(size: string, paint: string): RawOption[] {
  return [
    { name: "Size", value: size },
    { name: "Finish", value: paint },
  ];
}

function variant(id: string, size: string, paint: string, priceBani: number): RawVariant {
  return { id, options: sizeAndPaint(size, paint), priceBani, unitCostBani: null };
}

const VARIANTS: RawVariant[] = [
  variant("small-primed", "Small", "Primed & Drybrushed", 8000),
  variant("small-partial", "Small", "Partial Paint Job", 20000),
  variant("small-complete", "Small", "Complete Paint Job", 30000),
  variant("large-primed", "Large", "Primed & Drybrushed", 15000),
  variant("large-complete", "Large", "Complete Paint Job", 50000),
];

describe("resolvePaintOption", () => {
  it("reads the three paint values", () => {
    expect(resolvePaintOption([{ name: "Finish", value: "Primed & Drybrushed" }])).toBe("primed");
    expect(resolvePaintOption([{ name: "Finish", value: "Partial Paint Job" }])).toBe("partial");
    expect(resolvePaintOption([{ name: "Finish", value: "Complete Paint Job" }])).toBe("complete");
  });

  it("matches on the value, whatever the option is called", () => {
    expect(resolvePaintOption([{ name: "Paint level", value: "Complete Paint Job" }])).toBe(
      "complete",
    );
    expect(resolvePaintOption([{ name: "Style", value: "Complete Paint Job" }])).toBe("complete");
  });

  it("ignores case and extra spaces", () => {
    expect(resolvePaintOption([{ name: "Finish", value: "  primed &  DRYBRUSHED " }])).toBe(
      "primed",
    );
  });

  it("finds the paint value among other options", () => {
    expect(resolvePaintOption(sizeAndPaint("Large", "Partial Paint Job"))).toBe("partial");
  });

  it("gives none for a line with no paint option", () => {
    expect(resolvePaintOption([{ name: "Size", value: "Large" }])).toBe("none");
    expect(resolvePaintOption([])).toBe("none");
  });

  it("does not match a value that only holds a paint value", () => {
    expect(resolvePaintOption([{ name: "Finish", value: "Complete Paint Job Deluxe" }])).toBe(
      "none",
    );
  });

  it("is not fooled by an option named like a paint value", () => {
    expect(resolvePaintOption([{ name: "Complete Paint Job", value: "Yes" }])).toBe("none");
  });
});

describe("findPrimedSibling", () => {
  it("finds the primed variant at the same size among two sizes", () => {
    expect(findPrimedSibling(sizeAndPaint("Large", "Complete Paint Job"), VARIANTS)?.id).toBe(
      "large-primed",
    );
    expect(findPrimedSibling(sizeAndPaint("Small", "Partial Paint Job"), VARIANTS)?.id).toBe(
      "small-primed",
    );
  });

  it("gives a primed line its own variant", () => {
    expect(findPrimedSibling(sizeAndPaint("Small", "Primed & Drybrushed"), VARIANTS)?.id).toBe(
      "small-primed",
    );
  });

  it("gives null when the size has no primed variant", () => {
    expect(findPrimedSibling(sizeAndPaint("Medium", "Complete Paint Job"), VARIANTS)).toBeNull();
  });

  it("gives null when the product has no primed variant at all", () => {
    const painted = VARIANTS.filter((candidate) => !candidate.id.endsWith("primed"));
    expect(painted).toHaveLength(3);
    expect(findPrimedSibling(sizeAndPaint("Large", "Complete Paint Job"), painted)).toBeNull();
    expect(findPrimedSibling(sizeAndPaint("Large", "Complete Paint Job"), [])).toBeNull();
  });

  it("finds the sibling of a product whose only option is the paint", () => {
    const onlyPaint: RawVariant[] = [
      {
        id: "primed",
        options: [{ name: "Style", value: "Primed & Drybrushed" }],
        priceBani: 9000,
        unitCostBani: 1000,
      },
      {
        id: "complete",
        options: [{ name: "Style", value: "Complete Paint Job" }],
        priceBani: 40000,
        unitCostBani: null,
      },
    ];
    expect(findPrimedSibling([{ name: "Style", value: "Complete Paint Job" }], onlyPaint)?.id).toBe(
      "primed",
    );
  });

  it("matches the other option values whatever their case and spaces", () => {
    const largeComplete = [
      { name: "size", value: " large " },
      { name: "Finish", value: "Complete Paint Job" },
    ];
    expect(findPrimedSibling(largeComplete, VARIANTS)?.id).toBe("large-primed");
  });

  it("gives null for a line with no paint option", () => {
    expect(findPrimedSibling([{ name: "Size", value: "Small" }], VARIANTS)).toBeNull();
  });
});
