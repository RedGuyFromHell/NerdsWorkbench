import { describe, expect, it } from "vitest";
import { planMonthLines } from "./lineFacts";
import { toMonthLines } from "./monthLines";
import type { RawOrder } from "./rawOrder";

// Made-up order: two lines, one of them a pending order's line with a cost from the table.

const ORDER: RawOrder = {
  id: "order-1",
  name: "#2001",
  createdAt: "2031-03-12T09:00:00Z",
  cancelledAt: null,
  financialStatus: "pending",
  taxesIncluded: false,
  hasRefundWithoutLines: true,
  refunds: [],
  lines: [
    {
      id: "line-1",
      productId: "owl",
      productTitle: "Moon Owl",
      productTags: ["mini"],
      variantId: "owl-small",
      variantTitle: "Small",
      options: [{ name: "Size", value: "Small" }],
      quantity: 2,
      originalUnitBani: 4500,
      discountAllocatedBani: 0,
      taxBani: 0,
    },
    {
      id: "line-2",
      productId: "wolf",
      productTitle: "Star Wolf",
      productTags: ["mini"],
      variantId: "wolf",
      variantTitle: "Default",
      options: [],
      quantity: 1,
      originalUnitBani: 10000,
      discountAllocatedBani: 1000,
      taxBani: 0,
    },
  ],
};

const PLAN = planMonthLines(
  [ORDER],
  [
    {
      productId: "owl",
      variants: [
        {
          id: "owl-small",
          options: [{ name: "Size", value: "Small" }],
          priceBani: 4500,
          unitCostBani: 1200,
        },
      ],
    },
    {
      productId: "wolf",
      variants: [{ id: "wolf", options: [], priceBani: 10000, unitCostBani: null }],
    },
  ],
  {
    rule: { includeTags: ["mini"], excludeTags: [], extraProductTitles: [] },
    costTable: [{ productTitle: "Star Wolf", sizeValue: null, unitCostBani: 2200 }],
    timeZone: "UTC",
  },
  "2031-03",
);

describe("toMonthLines", () => {
  it("carries the order, the facts, the tags and the warning of each planned line", () => {
    const lines = toMonthLines(PLAN, [ORDER], () => ({ printedBy: null, paintedBy: null }));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({
      orderId: "order-1",
      orderName: "#2001",
      orderCreatedAt: "2031-03-12T09:00:00Z",
      lineId: "line-1",
      productId: "owl",
      productTitle: "Moon Owl",
      variantTitle: "Small",
      facts: {
        paidBani: 9000,
        listBani: 9000,
        qty: 2,
        paintOption: "none",
        primedUnitBani: null,
        costBani: 2400,
      },
      tags: ["not-paid-yet"],
      orderWarning: "refund-without-lines",
      printedBy: null,
      paintedBy: null,
    });
    expect(lines[1]?.tags).toEqual(["cost-from-table", "not-paid-yet"]);
    expect(lines[1]?.facts.paidBani).toBe(9000);
  });

  it("takes the two choices of each line from the function it is given", () => {
    const lines = toMonthLines(PLAN, [ORDER], (line) => ({
      printedBy: `printer-of-${line.lineId}`,
      paintedBy: null,
    }));
    expect(lines.map((line) => line.printedBy)).toEqual(["printer-of-line-1", "printer-of-line-2"]);
  });

  it("throws when a planned line's order is not among the orders", () => {
    expect(() => toMonthLines(PLAN, [], () => ({ printedBy: null, paintedBy: null }))).toThrow(
      "order-1",
    );
  });
});
