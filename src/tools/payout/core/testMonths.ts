// Made-up months for the tests of closing, corrections and the lock. Only test files import this.
// Every person, product and amount is invented: the repo is public.
import type { ClosedMonthFile, Correction, MonthLine, OpenMonthFile } from "../storage/monthSchema";
import type { PayoutSettings, StoredPeople } from "../storage/schemas";
import { planClose } from "./closeMonth";

export const PRINTER = "printer-a";
export const PAINTER = "painter-b";
export const FARM = "farm-c";

/** Fee 3%, the printer gets 60% of the print profit, drybrush 12% with a minimum of 10.00 a piece. */
export const TEST_SETTINGS: PayoutSettings = {
  version: 1,
  rates: { feeBp: 300, splitBp: 6000, drybrushBp: 1200, drybrushMinBani: 1000 },
  rule: { includeTags: ["mini"], excludeTags: [], extraProductTitles: [] },
  costTable: [],
  firstMonth: "2031-01",
};

export const TEST_PEOPLE: StoredPeople = {
  version: 1,
  people: [
    { id: PRINTER, name: "Printer A", prints: true, paints: false, getsPaid: true, defaultFor: [] },
    { id: PAINTER, name: "Painter B", prints: false, paints: true, getsPaid: true, defaultFor: [] },
    { id: FARM, name: "Farm C", prints: true, paints: false, getsPaid: false, defaultFor: [] },
  ],
};

export function testLine(overrides: Partial<MonthLine>): MonthLine {
  return {
    orderId: "order-1",
    orderName: "#2001",
    orderCreatedAt: "2031-01-10T10:00:00Z",
    lineId: "line-plain",
    productId: "product-1",
    productTitle: "Marsh Troll",
    variantTitle: "",
    facts: {
      paidBani: 10000,
      listBani: 10000,
      qty: 2,
      paintOption: "none",
      primedUnitBani: null,
      costBani: 2000,
    },
    tags: [],
    orderWarning: null,
    printedBy: PRINTER,
    paintedBy: null,
    ...overrides,
  };
}

/**
 * Two pieces, no paint, paid 100.00, cost 20.00.
 * Fee 3.00, profit 77.00, printer 46.20, company 30.80.
 */
export const PLAIN_LINE = testLine({});

/**
 * One piece, complete paint, paid 300.00 with no discount, primed price 120.00, cost 30.00.
 * Print part 120.00: fee 3.60, profit 86.40, printer 51.84, company 34.56.
 * Paint part 180.00: fee 5.40, painter 174.60.
 */
export const PAINTED_LINE = testLine({
  orderId: "order-2",
  orderName: "#2002",
  orderCreatedAt: "2031-01-12T10:00:00Z",
  lineId: "line-painted",
  productId: "product-2",
  productTitle: "Stone Golem",
  variantTitle: "Large / Complete Paint Job",
  facts: {
    paidBani: 30000,
    listBani: 30000,
    qty: 1,
    paintOption: "complete",
    primedUnitBani: 12000,
    costBani: 3000,
  },
  paintedBy: PAINTER,
});

export function openMonth(
  month: string,
  lines: MonthLine[],
  corrections?: Correction[],
): OpenMonthFile {
  return {
    version: 1,
    month,
    status: "open",
    timeZone: "UTC",
    loadedAt: `${month}-28T12:00:00Z`,
    lines,
    ...(corrections === undefined ? {} : { corrections }),
  };
}

/** The month closed with the test settings and people. Throws if it may not close. */
export function closeMonth(
  file: OpenMonthFile,
  settings: PayoutSettings = TEST_SETTINGS,
  people: StoredPeople = TEST_PEOPLE,
): ClosedMonthFile {
  const plan = planClose({
    file,
    settings,
    people,
    months: [],
    closedAt: `${file.month}-28T18:00:00Z`,
  });
  if (plan.kind === "refused") {
    throw new Error(`The test month may not close: ${JSON.stringify(plan.blockers)}`);
  }
  return plan.closed;
}
