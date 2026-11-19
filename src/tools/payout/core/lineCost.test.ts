import { describe, expect, it } from "vitest";
import { resolveUnitCost } from "./lineCost";
import type { CostTableRow } from "./lineCost";
import type { RawVariant } from "./rawOrder";

// Every product and cost here is made up.

const TITLE = "Moon Owl";
const PRIMED = "Primed & Drybrushed";
const COMPLETE = "Complete Paint Job";

function variant(id: string, size: string, paint: string, unitCostBani: number | null): RawVariant {
  return {
    id,
    options: [
      { name: "Size", value: size },
      { name: "Finish", value: paint },
    ],
    priceBani: 10000,
    unitCostBani,
  };
}

function line(variantId: string | null, size: string, paint: string, productTitle = TITLE) {
  return {
    productTitle,
    variantId,
    options: [
      { name: "Size", value: size },
      { name: "Finish", value: paint },
    ],
  };
}

const VARIANTS: RawVariant[] = [
  variant("small-primed", "Small", PRIMED, 1200),
  variant("small-complete", "Small", COMPLETE, 9999),
  variant("large-primed", "Large", PRIMED, 2500),
  variant("large-complete", "Large", COMPLETE, null),
  variant("huge-primed", "Huge", PRIMED, null),
  variant("huge-complete", "Huge", COMPLETE, 7777),
];

const TABLE: CostTableRow[] = [
  { productTitle: TITLE, sizeValue: null, unitCostBani: 3000 },
  { productTitle: TITLE, sizeValue: "Huge", unitCostBani: 4500 },
  { productTitle: "Sun Fox", sizeValue: "Huge", unitCostBani: 100 },
];

describe("resolveUnitCost", () => {
  it("takes the cost of the line's own variant", () => {
    expect(resolveUnitCost(line("small-primed", "Small", PRIMED), VARIANTS, TABLE)).toEqual({
      unitBani: 1200,
      source: "shopify",
    });
  });

  it("takes the cost of the primed sibling for a painted line, not the painted variant's own", () => {
    expect(resolveUnitCost(line("small-complete", "Small", COMPLETE), VARIANTS, TABLE)).toEqual({
      unitBani: 1200,
      source: "shopify",
    });
    expect(resolveUnitCost(line("large-complete", "Large", COMPLETE), VARIANTS, TABLE)).toEqual({
      unitBani: 2500,
      source: "shopify",
    });
  });

  it("keeps a cost of zero from the shop: zero is a cost, null is none", () => {
    const free = [variant("free", "Small", PRIMED, 0)];
    expect(resolveUnitCost(line("free", "Small", PRIMED), free, TABLE)).toEqual({
      unitBani: 0,
      source: "shopify",
    });
  });

  it("falls back to the table row of the size when the shop has no cost", () => {
    expect(resolveUnitCost(line("huge-primed", "Huge", PRIMED), VARIANTS, TABLE)).toEqual({
      unitBani: 4500,
      source: "table",
    });
  });

  it("goes to the table, not to the painted variant's own cost, when the primed sibling has none", () => {
    expect(resolveUnitCost(line("huge-complete", "Huge", COMPLETE), VARIANTS, TABLE)).toEqual({
      unitBani: 4500,
      source: "table",
    });
  });

  it("lets the row with a size win over the row without, whatever their order", () => {
    const reversed = [...TABLE].reverse();
    expect(resolveUnitCost(line("huge-primed", "Huge", PRIMED), VARIANTS, reversed)).toEqual({
      unitBani: 4500,
      source: "table",
    });
  });

  it("falls back to the row without a size when no row has the size of the line", () => {
    const noCost = [variant("tiny-primed", "Tiny", PRIMED, null)];
    expect(resolveUnitCost(line("tiny-primed", "Tiny", PRIMED), noCost, TABLE)).toEqual({
      unitBani: 3000,
      source: "table",
    });
  });

  it("uses the table when the variant is gone from the shop", () => {
    expect(resolveUnitCost(line(null, "Tiny", "No Paint"), [], TABLE)).toEqual({
      unitBani: 3000,
      source: "table",
    });
    expect(resolveUnitCost(line("deleted", "Tiny", "No Paint"), VARIANTS, TABLE)).toEqual({
      unitBani: 3000,
      source: "table",
    });
  });

  it("matches the table by title and size whatever the case and the spaces", () => {
    const table: CostTableRow[] = [
      { productTitle: " moon OWL ", sizeValue: " huge", unitCostBani: 4500 },
    ];
    expect(resolveUnitCost(line(null, "Huge", "No Paint"), [], table)).toEqual({
      unitBani: 4500,
      source: "table",
    });
  });

  it("does not use a row of another product", () => {
    expect(resolveUnitCost(line(null, "Huge", "No Paint", "Star Wolf"), [], TABLE)).toBeNull();
  });

  it("does not use a row of another size when the product has no row without a size", () => {
    const table: CostTableRow[] = [{ productTitle: TITLE, sizeValue: "Huge", unitCostBani: 4500 }];
    expect(resolveUnitCost(line(null, "Tiny", "No Paint"), [], table)).toBeNull();
  });

  it("gives null when neither the shop nor the table has a cost", () => {
    expect(resolveUnitCost(line("huge-primed", "Huge", PRIMED), VARIANTS, [])).toBeNull();
  });
});
