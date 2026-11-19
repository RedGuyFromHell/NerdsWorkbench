import { describe, expect, it } from "vitest";
import { fromBani } from "./exactAmount";
import { planMonthLines } from "./lineFacts";
import type { LineFactsSettings, MonthLinesPlan, PlannedLine } from "./lineFacts";
import { calculateLine } from "./payoutMath";
import type {
  FinancialStatus,
  ProductVariants,
  RawLine,
  RawOrder,
  RawRefundLine,
} from "./rawOrder";

// Every order, product, price and cost here is made up. Money is in bani: 620.00 is 62000.

const MONTH = "2031-03";
const IN_MONTH = "2031-03-15T10:00:00Z";
const PRIMED = "Primed & Drybrushed";
const COMPLETE = "Complete Paint Job";

const SETTINGS: LineFactsSettings = {
  rule: {
    includeTags: ["mini", "figurine", "statue", "resin"],
    excludeTags: ["filament", "dice"],
    extraProductTitles: ["Custom Size Add-on"],
  },
  costTable: [{ productTitle: "Star Wolf", sizeValue: null, unitCostBani: 2200 }],
  timeZone: "UTC",
};

/** Moon Owl: two sizes, primed and complete. Star Wolf: no paint option and no cost in the shop. */
const PRODUCT_VARIANTS: ProductVariants[] = [
  {
    productId: "moon-owl",
    variants: [
      owlVariant("owl-small-primed", "Small", PRIMED, 7000, 1700),
      owlVariant("owl-small-complete", "Small", COMPLETE, 40000, 5555),
      owlVariant("owl-large-primed", "Large", PRIMED, 23000, 5300),
      owlVariant("owl-large-complete", "Large", COMPLETE, 60000, null),
    ],
  },
  {
    productId: "star-wolf",
    variants: [{ id: "wolf", options: [], priceBani: 10000, unitCostBani: null }],
  },
];

function owlVariant(
  id: string,
  size: string,
  paint: string,
  priceBani: number,
  unitCostBani: number | null,
) {
  return {
    id,
    options: [
      { name: "Size", value: size },
      { name: "Finish", value: paint },
    ],
    priceBani,
    unitCostBani,
  };
}

/** One small primed Moon Owl at 70.00, no discount, no tax. */
function primedOwlLine(overrides: Partial<RawLine> = {}): RawLine {
  return {
    id: "line-1",
    productId: "moon-owl",
    productTitle: "Moon Owl",
    productTags: ["mini"],
    variantId: "owl-small-primed",
    variantTitle: `Small / ${PRIMED}`,
    options: [
      { name: "Size", value: "Small" },
      { name: "Finish", value: PRIMED },
    ],
    quantity: 1,
    originalUnitBani: 7000,
    discountAllocatedBani: 0,
    taxBani: 0,
    ...overrides,
  };
}

/** One large complete Moon Owl at 620.00. Its primed sibling sells at 230.00 and costs 53.00. */
function paintedOwlLine(overrides: Partial<RawLine> = {}): RawLine {
  return primedOwlLine({
    variantId: "owl-large-complete",
    variantTitle: `Large / ${COMPLETE}`,
    options: [
      { name: "Size", value: "Large" },
      { name: "Finish", value: COMPLETE },
    ],
    originalUnitBani: 62000,
    ...overrides,
  });
}

function wolfLine(overrides: Partial<RawLine> = {}): RawLine {
  return primedOwlLine({
    productId: "star-wolf",
    productTitle: "Star Wolf",
    productTags: ["resin"],
    variantId: "wolf",
    variantTitle: "Default",
    options: [],
    originalUnitBani: 10000,
    ...overrides,
  });
}

function order(overrides: Partial<RawOrder> = {}): RawOrder {
  return {
    id: "order-1",
    name: "#9001",
    createdAt: IN_MONTH,
    cancelledAt: null,
    financialStatus: "paid",
    taxesIncluded: false,
    lines: [primedOwlLine()],
    refunds: [],
    hasRefundWithoutLines: false,
    ...overrides,
  };
}

function refund(overrides: Partial<RawRefundLine> = {}): RawRefundLine {
  return {
    lineId: "line-1",
    quantity: 0,
    subtotalBani: 0,
    createdAt: "2031-03-20T10:00:00Z",
    ...overrides,
  };
}

function plan(orders: RawOrder[], settings = SETTINGS): MonthLinesPlan {
  return planMonthLines(orders, PRODUCT_VARIANTS, settings, MONTH);
}

function onlyLine(monthPlan: MonthLinesPlan): PlannedLine {
  expect(monthPlan.lines).toHaveLength(1);
  const line = monthPlan.lines[0];
  if (line === undefined) throw new Error("The plan has no line.");
  return line;
}

const NOTHING_LEFT_OUT = {
  "other-month": 0,
  cancelled: 0,
  voided: 0,
  expired: 0,
  refunded: 0,
  "not-payout-line": 0,
  "no-units-left": 0,
};

describe("planMonthLines: the facts of a line", () => {
  it("gives a plain primed line its facts and names where it came from", () => {
    const monthPlan = plan([order()]);
    expect(onlyLine(monthPlan)).toEqual({
      orderId: "order-1",
      orderName: "#9001",
      lineId: "line-1",
      productId: "moon-owl",
      productTitle: "Moon Owl",
      variantTitle: `Small / ${PRIMED}`,
      facts: {
        paidBani: 7000,
        listBani: 7000,
        qty: 1,
        paintOption: "primed",
        primedUnitBani: 7000,
        costBani: 1700,
      },
      tags: [],
      orderWarning: null,
    });
    expect(monthPlan.leftOut).toEqual(NOTHING_LEFT_OUT);
  });

  it("gives a painted line the current price and the cost of its primed sibling at the same size", () => {
    const { facts } = onlyLine(plan([order({ lines: [paintedOwlLine()] })]));
    expect(facts).toEqual({
      paidBani: 62000,
      listBani: 62000,
      qty: 1,
      paintOption: "complete",
      primedUnitBani: 23000,
      costBani: 5300,
    });
  });

  it("feeds the maths: the spec's painted figurine pays the printer 102.06 and the painter 378.30", () => {
    const { facts } = onlyLine(plan([order({ lines: [paintedOwlLine()] })]));
    const lineResult = calculateLine(
      { ...facts, printedBy: "printer-a", paintedBy: "painter-b" },
      { feeBp: 300, splitBp: 6000, drybrushBp: 1200, drybrushMinBani: 2000 },
      [
        { id: "printer-a", getsPaid: true },
        { id: "painter-b", getsPaid: true },
      ],
    );
    if (lineResult.status !== "ok") throw new Error("The line is blocked.");
    expect(lineResult.shares).toEqual([
      { personId: "printer-a", part: "print", amount: fromBani(10206) },
      { personId: "painter-b", part: "paint", amount: fromBani(37830) },
    ]);
  });

  it("gives a line with no paint option no primed price", () => {
    const { facts } = onlyLine(plan([order({ lines: [wolfLine()] })]));
    expect(facts.paintOption).toBe("none");
    expect(facts.primedUnitBani).toBeNull();
  });

  it("leaves the primed price empty when the size has no primed variant", () => {
    const line = paintedOwlLine({
      variantId: null,
      options: [
        { name: "Size", value: "Medium" },
        { name: "Finish", value: COMPLETE },
      ],
    });
    const { facts } = onlyLine(plan([order({ lines: [line] })]));
    expect(facts.paintOption).toBe("complete");
    expect(facts.primedUnitBani).toBeNull();
    expect(facts.costBani).toBeNull();
  });

  it("leaves the primed price and the cost empty when the shop no longer has the product", () => {
    const line = paintedOwlLine({ productId: "gone", productTitle: "Gone Bear" });
    const { facts, tags } = onlyLine(plan([order({ lines: [line] })]));
    expect(facts.primedUnitBani).toBeNull();
    expect(facts.costBani).toBeNull();
    expect(tags).toEqual([]);
  });

  it("multiplies the cost per piece by the quantity", () => {
    const { facts } = onlyLine(plan([order({ lines: [primedOwlLine({ quantity: 3 })] })]));
    expect(facts.qty).toBe(3);
    expect(facts.costBani).toBe(5100);
    expect(facts.listBani).toBe(21000);
    expect(facts.paidBani).toBe(21000);
  });

  it("takes the cost from the table and tags the line when the shop has none", () => {
    const { facts, tags } = onlyLine(plan([order({ lines: [wolfLine({ quantity: 2 })] })]));
    expect(facts.costBani).toBe(4400);
    expect(tags).toEqual(["cost-from-table"]);
  });

  it("leaves the cost empty, with no tag, when neither the shop nor the table has one", () => {
    const { facts, tags } = onlyLine(
      plan([order({ lines: [wolfLine()] })], { ...SETTINGS, costTable: [] }),
    );
    expect(facts.costBani).toBeNull();
    expect(tags).toEqual([]);
  });

  it("keeps the lines in the order of the orders and of their lines", () => {
    const first = order({ lines: [primedOwlLine({ id: "a" }), wolfLine({ id: "b" })] });
    const second = order({ id: "order-2", lines: [paintedOwlLine({ id: "c" })] });
    const monthPlan = plan([first, second]);
    expect(monthPlan.lines.map((line) => `${line.orderId}:${line.lineId}`)).toEqual([
      "order-1:a",
      "order-1:b",
      "order-2:c",
    ]);
  });
});

describe("planMonthLines: the money paid", () => {
  it("takes every discount off the money paid, and none off the list price", () => {
    const line = primedOwlLine({ quantity: 2, discountAllocatedBani: 1400 });
    const { facts } = onlyLine(plan([order({ lines: [line] })]));
    expect(facts.paidBani).toBe(12600);
    expect(facts.listBani).toBe(14000);
  });

  it("takes the tax out when the prices of the order include it", () => {
    const line = primedOwlLine({ originalUnitBani: 11900, taxBani: 1900 });
    const { facts } = onlyLine(plan([order({ taxesIncluded: true, lines: [line] })]));
    expect(facts.paidBani).toBe(10000);
    expect(facts.listBani).toBe(11900);
  });

  it("leaves the price alone when the tax is on top of it", () => {
    const line = primedOwlLine({ originalUnitBani: 11900, taxBani: 2261 });
    const { facts } = onlyLine(plan([order({ taxesIncluded: false, lines: [line] })]));
    expect(facts.paidBani).toBe(11900);
    expect(facts.listBani).toBe(11900);
  });

  it("takes the discount and the included tax off together", () => {
    const line = primedOwlLine({
      quantity: 2,
      originalUnitBani: 11900,
      discountAllocatedBani: 2380,
      taxBani: 3420,
    });
    const { facts } = onlyLine(plan([order({ taxesIncluded: true, lines: [line] })]));
    expect(facts.paidBani).toBe(18000);
  });
});

describe("planMonthLines: refunds", () => {
  it("drops the quantity, the money paid, the list price and the cost when one of three pieces is refunded", () => {
    const line = primedOwlLine({ quantity: 3, discountAllocatedBani: 2100 });
    const refunds = [refund({ quantity: 1, subtotalBani: 6300 })];
    const { facts } = onlyLine(plan([order({ lines: [line], refunds })]));
    expect(facts).toEqual({
      paidBani: 12600,
      listBani: 14000,
      qty: 2,
      paintOption: "primed",
      primedUnitBani: 7000,
      costBani: 3400,
    });
  });

  it("drops only the money paid for a refund of money on a line", () => {
    const refunds = [refund({ quantity: 0, subtotalBani: 2000 })];
    const { facts } = onlyLine(plan([order({ refunds })]));
    expect(facts.paidBani).toBe(5000);
    expect(facts.qty).toBe(1);
    expect(facts.listBani).toBe(7000);
    expect(facts.costBani).toBe(1700);
  });

  it("adds up several refunds of one line", () => {
    const line = primedOwlLine({ quantity: 4 });
    const refunds = [
      refund({ quantity: 1, subtotalBani: 7000 }),
      refund({ quantity: 2, subtotalBani: 14000 }),
      refund({ quantity: 0, subtotalBani: 500 }),
    ];
    const { facts } = onlyLine(plan([order({ lines: [line], refunds })]));
    expect(facts.qty).toBe(1);
    expect(facts.paidBani).toBe(6500);
  });

  it("does not let the refund of one line touch another", () => {
    const lines = [
      primedOwlLine({ id: "kept" }),
      wolfLine({ id: "refunded-in-part", quantity: 2 }),
    ];
    const refunds = [refund({ lineId: "refunded-in-part", quantity: 1, subtotalBani: 10000 })];
    const monthPlan = plan([order({ lines, refunds })]);
    expect(
      monthPlan.lines.map((line) => [line.lineId, line.facts.qty, line.facts.paidBani]),
    ).toEqual([
      ["kept", 1, 7000],
      ["refunded-in-part", 1, 10000],
    ]);
  });

  it("does not let a refund of another order with the same line id touch the line", () => {
    const refunded = order({ id: "order-2", refunds: [refund({ subtotalBani: 2000 })] });
    const monthPlan = plan([order(), refunded]);
    expect(monthPlan.lines.map((line) => line.facts.paidBani)).toEqual([7000, 5000]);
  });

  it("leaves out a line with no piece left, counts it, and keeps the other lines of the order", () => {
    const lines = [primedOwlLine({ id: "gone", quantity: 2 }), wolfLine({ id: "kept" })];
    const refunds = [refund({ lineId: "gone", quantity: 2, subtotalBani: 14000 })];
    const monthPlan = plan([order({ financialStatus: "partially-refunded", lines, refunds })]);
    expect(onlyLine(monthPlan).lineId).toBe("kept");
    expect(monthPlan.leftOut).toEqual({ ...NOTHING_LEFT_OUT, "no-units-left": 1 });
  });

  it("warns on every line of an order with a refund not tied to a line, and keeps their amounts", () => {
    const lines = [primedOwlLine({ id: "a" }), wolfLine({ id: "b" })];
    const warned = order({ lines, hasRefundWithoutLines: true });
    const clean = order({ id: "order-2" });
    const monthPlan = plan([warned, clean]);
    expect(
      monthPlan.lines.map((line) => [line.lineId, line.orderWarning, line.facts.paidBani]),
    ).toEqual([
      ["a", "refund-without-lines", 7000],
      ["b", "refund-without-lines", 10000],
      ["line-1", null, 7000],
    ]);
  });

  it("throws when more pieces are refunded than were ordered", () => {
    const refunds = [refund({ quantity: 2, subtotalBani: 14000 })];
    expect(() => plan([order({ refunds })])).toThrow(/#9001/);
  });
});

describe("planMonthLines: which orders and lines count", () => {
  it("leaves out a fully refunded order and counts it", () => {
    const monthPlan = plan([order({ financialStatus: "refunded" }), order({ id: "order-2" })]);
    expect(onlyLine(monthPlan).orderId).toBe("order-2");
    expect(monthPlan.leftOut).toEqual({ ...NOTHING_LEFT_OUT, refunded: 1 });
  });

  it("leaves out an expired order, which took no money, and counts it", () => {
    const monthPlan = plan([order({ financialStatus: "expired" })]);
    expect(monthPlan.lines).toEqual([]);
    expect(monthPlan.leftOut).toEqual({ ...NOTHING_LEFT_OUT, expired: 1 });
  });

  it("leaves out a voided order and counts it", () => {
    const monthPlan = plan([order({ financialStatus: "voided" })]);
    expect(monthPlan.lines).toEqual([]);
    expect(monthPlan.leftOut).toEqual({ ...NOTHING_LEFT_OUT, voided: 1 });
  });

  it("leaves out a cancelled order and counts it, whatever its payment says", () => {
    const monthPlan = plan([order({ cancelledAt: "2031-03-16T08:00:00Z" })]);
    expect(monthPlan.lines).toEqual([]);
    expect(monthPlan.leftOut).toEqual({ ...NOTHING_LEFT_OUT, cancelled: 1 });
  });

  it("counts an order once, by its lines or by one reason", () => {
    const lines = [primedOwlLine({ id: "a" }), wolfLine({ id: "b" })];
    const monthPlan = plan([order({ financialStatus: "voided", lines })]);
    expect(monthPlan.leftOut).toEqual({ ...NOTHING_LEFT_OUT, voided: 1 });
  });

  it.each<FinancialStatus>(["pending", "authorized", "partially-paid"])(
    "keeps a %s order and tags its lines not paid yet",
    (financialStatus) => {
      const { tags, facts } = onlyLine(plan([order({ financialStatus })]));
      expect(tags).toEqual(["not-paid-yet"]);
      expect(facts.paidBani).toBe(7000);
    },
  );

  it.each<FinancialStatus>(["paid", "partially-refunded"])(
    "does not tag a %s order",
    (financialStatus) => {
      expect(onlyLine(plan([order({ financialStatus })])).tags).toEqual([]);
    },
  );

  it("carries both tags on a line that has both", () => {
    const pending = order({ financialStatus: "pending", lines: [wolfLine()] });
    expect(onlyLine(plan([pending])).tags).toEqual(["cost-from-table", "not-paid-yet"]);
  });

  it("leaves out a line the rule does not count, and counts it", () => {
    const lines = [
      primedOwlLine({ id: "kept" }),
      wolfLine({ id: "dice", productTitle: "Bone Dice", productTags: ["dice"] }),
      wolfLine({ id: "mat", productTitle: "Felt Mat", productTags: [] }),
    ];
    const monthPlan = plan([order({ lines })]);
    expect(onlyLine(monthPlan).lineId).toBe("kept");
    expect(monthPlan.leftOut).toEqual({ ...NOTHING_LEFT_OUT, "not-payout-line": 2 });
  });

  it("keeps an extra product picked by title, though it has no tag and no product in the shop", () => {
    const line = wolfLine({
      productId: null,
      productTitle: "Custom Size Add-on",
      productTags: [],
      variantId: null,
    });
    const planned = onlyLine(plan([order({ lines: [line] })]));
    expect(planned.productId).toBeNull();
    expect(planned.facts.costBani).toBeNull();
  });

  it("uses the rule of the settings it is given", () => {
    const settings = { ...SETTINGS, rule: { ...SETTINGS.rule, includeTags: ["statue"] } };
    const monthPlan = plan([order()], settings);
    expect(monthPlan.lines).toEqual([]);
    expect(monthPlan.leftOut).toEqual({ ...NOTHING_LEFT_OUT, "not-payout-line": 1 });
  });
});

describe("planMonthLines: the month of an order", () => {
  const lastMinutesOfMarch = order({ id: "late", createdAt: "2031-03-31T23:30:00Z" });
  const firstMinutesOfMarch = order({ id: "early", createdAt: "2031-03-01T00:30:00Z" });

  it("keeps both edges of the month for a store on UTC", () => {
    const monthPlan = plan([firstMinutesOfMarch, lastMinutesOfMarch]);
    expect(monthPlan.lines.map((line) => line.orderId)).toEqual(["early", "late"]);
  });

  it("moves the late order to the next month for a store ahead of UTC", () => {
    const monthPlan = plan([firstMinutesOfMarch, lastMinutesOfMarch], {
      ...SETTINGS,
      timeZone: "Asia/Tokyo",
    });
    expect(monthPlan.lines.map((line) => line.orderId)).toEqual(["early"]);
    expect(monthPlan.leftOut).toEqual({ ...NOTHING_LEFT_OUT, "other-month": 1 });
  });

  it("moves the early order to the month before for a store behind UTC", () => {
    const monthPlan = plan([firstMinutesOfMarch, lastMinutesOfMarch], {
      ...SETTINGS,
      timeZone: "America/New_York",
    });
    expect(monthPlan.lines.map((line) => line.orderId)).toEqual(["late"]);
    expect(monthPlan.leftOut).toEqual({ ...NOTHING_LEFT_OUT, "other-month": 1 });
  });

  it("counts an order of another month as that, even when it is cancelled too", () => {
    const cancelledInApril = order({
      createdAt: "2031-04-02T10:00:00Z",
      cancelledAt: "2031-04-03T10:00:00Z",
    });
    expect(plan([cancelledInApril]).leftOut).toEqual({ ...NOTHING_LEFT_OUT, "other-month": 1 });
  });

  it("gives an empty plan for no orders", () => {
    expect(plan([])).toEqual({ lines: [], leftOut: NOTHING_LEFT_OUT });
  });
});
