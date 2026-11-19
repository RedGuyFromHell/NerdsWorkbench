import { describe, expect, it } from "vitest";
import type { Correction, MonthLine } from "../storage/monthSchema";
import { formatLei } from "./formatLei";
import { buildMonthView } from "./monthView";
import { buildStatement, statementId } from "./statement";
import type { Statement } from "./statement";
import {
  closeMonth,
  openMonth,
  PAINTED_LINE,
  PAINTER,
  PLAIN_LINE,
  PRINTER,
  TEST_PEOPLE,
  TEST_SETTINGS,
  testLine,
} from "./testMonths";

/**
 * One piece, primed, paid 70.00, cost 18.00, ordered before the other lines.
 * Drybrush max(8.40, 10.00) = 10.00 (the minimum). Profit 39.90, printer 23.94.
 */
const PRIMED_LINE = testLine({
  orderId: "order-3",
  orderName: "#2003",
  orderCreatedAt: "2031-01-05T10:00:00Z",
  lineId: "line-primed",
  productTitle: "Cave Bat",
  variantTitle: "Primed",
  facts: {
    paidBani: 7000,
    listBani: 7000,
    qty: 1,
    paintOption: "primed",
    primedUnitBani: 7000,
    costBani: 1800,
  },
  paintedBy: PAINTER,
});

/** The plain line of an earlier month, taken back in full. */
const REMOVAL: Correction = {
  sourceMonth: "2030-12",
  lineId: "line-old",
  orderName: "#1990",
  productTitle: "Marsh Troll",
  variantTitle: "",
  reason: "removed",
  amounts: {
    paidBani: -10000,
    costBani: -2000,
    fee: "-300/1",
    shares: [{ personId: PRINTER, part: "print", amount: "-4620/1" }],
    company: "-3080/1",
  },
};

const JANUARY = closeMonth(
  openMonth("2031-01", [PLAIN_LINE, PAINTED_LINE, PRIMED_LINE], [REMOVAL]),
);

function statementOf(personId: string, paidOn: string | null = null): Statement {
  return buildStatement(JANUARY, personId, paidOn);
}

/** The printer's statement of a month that holds only these lines. */
function statementOfLines(lines: MonthLine[]): Statement {
  return buildStatement(closeMonth(openMonth("2031-01", lines)), PRINTER, null);
}

/** A line with no paint and no discount, paid as given, with a cost of 0. */
function plainLine(id: string, paidBani: number): MonthLine {
  return testLine({
    lineId: `line-${id}`,
    orderId: `order-${id}`,
    orderName: `#${id}`,
    facts: {
      paidBani,
      listBani: paidBani,
      qty: 1,
      paintOption: "none",
      primedUnitBani: null,
      costBani: 0,
    },
  });
}

function sum(numbers: readonly number[]): number {
  return numbers.reduce((total, value) => total + value, 0);
}

describe("the total and the parts", () => {
  it("gives the printer the month's total, to the ban", () => {
    const statement = statementOf(PRINTER);
    // 46.20 + 51.84 + 23.94 - 46.20
    expect(statement.totalBani).toBe(7578);
    expect(statement.parts).toEqual([
      { label: "Print profit share (60%)", bani: 12198 },
      { label: "Painting", bani: 0 },
      { label: "Drybrush", bani: 0 },
      { label: "Corrections from earlier months", bani: -4620 },
    ]);
  });

  it("gives the painter the paint and the drybrush", () => {
    const statement = statementOf(PAINTER);
    expect(statement.totalBani).toBe(18460);
    expect(statement.parts.map((part) => part.bani)).toEqual([0, 17460, 1000, 0]);
  });

  it("is the total the month screen shows for that person", () => {
    const view = buildMonthView(JANUARY, TEST_SETTINGS, TEST_PEOPLE);
    expect(view.people).toHaveLength(2);
    for (const person of view.people) {
      expect(formatLei(statementOf(person.personId).totalBani)).toBe(person.total);
    }
  });

  it("adds a rounding part when the rounded parts miss the total by a ban", () => {
    // One person prints and paints: print 58.22328 and paint 0.194, total 58.41728 = 58.42,
    // but the two parts round to 58.22 + 0.19 = 58.41.
    const both = testLine({
      lineId: "line-round",
      facts: {
        paidBani: 10024,
        listBani: 10024,
        qty: 1,
        paintOption: "complete",
        primedUnitBani: 10004,
        costBani: 0,
      },
      printedBy: PRINTER,
      paintedBy: PRINTER,
    });
    const statement = statementOfLines([both]);
    expect(statement.totalBani).toBe(5842);
    expect(statement.parts).toEqual([
      { label: "Print profit share (60%)", bani: 5822 },
      { label: "Painting", bani: 19 },
      { label: "Drybrush", bani: 0 },
      { label: "Corrections from earlier months", bani: 0 },
      { label: "Rounding", bani: 1 },
    ]);
  });

  it("always adds up: the parts and the lines both give the total", () => {
    for (const personId of [PRINTER, PAINTER]) {
      const statement = statementOf(personId);
      expect(sum(statement.parts.map((part) => part.bani))).toBe(statement.totalBani);
      expect(sum(statement.lines.map((line) => line.bani))).toBe(statement.totalBani);
    }
  });

  it("refuses a person who has no part in the month", () => {
    expect(() => statementOf("nobody")).toThrow(/nobody/);
  });
});

describe("the line list", () => {
  it("lists the person's shares in order date order, then the corrections", () => {
    expect(statementOf(PRINTER).lines).toEqual([
      { order: "#2003", item: "Cave Bat · Primed", qty: 1, work: "Print", bani: 2394 },
      { order: "#2001", item: "Marsh Troll", qty: 2, work: "Print", bani: 4620 },
      {
        order: "#2002",
        item: "Stone Golem · Large / Complete Paint Job",
        qty: 1,
        work: "Print",
        bani: 5184,
      },
      {
        order: "#1990",
        item: "Marsh Troll (paid in December 2030, refunded in full or cancelled since)",
        qty: null,
        work: "Correction",
        bani: -4620,
      },
    ]);
  });

  it("marks the minimum drybrush and keeps the painter's rows apart", () => {
    expect(statementOf(PAINTER).lines).toEqual([
      { order: "#2003", item: "Cave Bat · Primed", qty: 1, work: "Drybrush (min.)", bani: 1000 },
      {
        order: "#2002",
        item: "Stone Golem · Large / Complete Paint Job",
        qty: 1,
        work: "Paint",
        bani: 17460,
      },
    ]);
  });

  it("closes the list with a rounding row when the rounded rows miss the total", () => {
    // Two lines of 58.20582 each for the printer: rows 58.21 + 58.21, but the total is 116.41.
    const statement = statementOfLines([plainLine("3001", 10001), plainLine("3002", 10001)]);
    expect(statement.totalBani).toBe(11641);
    expect(statement.lines.map((line) => line.bani)).toEqual([5821, 5821, -1]);
    expect(statement.lines[2]).toMatchObject({ work: "Rounding", item: "Rounding", qty: null });
  });

  it("puts two orders of the same moment in order name order", () => {
    // Listed the other way round in the file: the later name comes first.
    const statement = statementOfLines([plainLine("3002", 10000), plainLine("3001", 10000)]);
    expect(statement.lines.map((line) => line.order)).toEqual(["#3001", "#3002"]);
  });

  it("says a partly refunded correction in its own words", () => {
    const reduced: Correction = { ...REMOVAL, reason: "reduced" };
    const month = closeMonth(openMonth("2031-01", [PLAIN_LINE], [reduced]));
    const row = buildStatement(month, PRINTER, null).lines.at(-1);
    expect(row?.item).toBe("Marsh Troll (paid in December 2030, partly refunded since)");
  });

  it("leaves out a share of exactly nothing", () => {
    // Paid 120.00 for a painted piece whose primed price is 120.00: the paint part is 0.
    const nothingToPaint = testLine({
      lineId: "line-no-paint",
      facts: {
        paidBani: 12000,
        listBani: 12000,
        qty: 1,
        paintOption: "complete",
        primedUnitBani: 12000,
        costBani: 3000,
      },
      paintedBy: PAINTER,
    });
    const month = closeMonth(openMonth("2031-01", [nothingToPaint, PRIMED_LINE]));
    const rows = buildStatement(month, PAINTER, null).lines;
    expect(rows.map((row) => row.work)).toEqual(["Drybrush (min.)"]);
  });

  it("leaves out a person's part of a line that pays them nothing", () => {
    const month = closeMonth(openMonth("2031-01", [PLAIN_LINE, PRIMED_LINE]));
    const rows = buildStatement(month, PAINTER, null).lines;
    expect(rows.map((row) => row.work)).toEqual(["Drybrush (min.)"]);
  });
});

describe("the rules paragraph", () => {
  it("is written from the closed month's own rates", () => {
    const { rules } = statementOf(PRINTER);
    expect(rules).toContain("a 3% payment fee");
    expect(rules).toContain("60% of that profit");
    expect(rules).toContain("12% of the price, at least 10.00 lei per piece");
  });

  it("carries the snapshot, not the rates of any other month", () => {
    const snapshot = {
      ...TEST_SETTINGS,
      rates: { feeBp: 350, splitBp: 7250, drybrushBp: 1250, drybrushMinBani: 2000 },
    };
    const month = closeMonth(openMonth("2031-01", [PLAIN_LINE]), snapshot);
    const { rules } = buildStatement(month, PRINTER, null);
    expect(rules).toContain("a 3.5% payment fee");
    expect(rules).toContain("72.5% of that profit");
    expect(rules).toContain("12.5% of the price, at least 20.00 lei per piece");
    expect(rules).not.toContain("a 3% payment fee");
  });
});

describe("the statement id", () => {
  it("is the month and the first 6 characters of the person id, in capitals", () => {
    expect(statementId("2031-01", "printer-a")).toBe("PAY-2031-01-PRINTE");
    expect(statementId("2031-01", "3f9a1c2e-7b44-4c1d-9a52-0d1c5e7f8a90")).toBe(
      "PAY-2031-01-3F9A1C",
    );
  });

  it("skips characters that are not letters or digits", () => {
    expect(statementId("2031-02", "a-b c")).toBe("PAY-2031-02-ABC");
  });

  it("is the same on a second export", () => {
    expect(statementOf(PRINTER).id).toBe("PAY-2031-01-PRINTE");
    expect(statementOf(PRINTER, "2031-02-05").id).toBe("PAY-2031-01-PRINTE");
  });
});

describe("the head and the foot", () => {
  it("names the person and the month, and when it was closed", () => {
    const statement = statementOf(PRINTER);
    expect(statement.personName).toBe("Printer A");
    expect(statement.monthTitle).toBe("January 2031");
    expect(statement.closedText).toBe("28 Jan 2031, 18:00");
  });

  it("shows a person removed from the locked people as unknown, not dropped", () => {
    const people = JANUARY.people.filter((person) => person.id !== PRINTER);
    expect(buildStatement({ ...JANUARY, people }, PRINTER, null).personName).toBe("Unknown person");
  });

  it("carries the paid day, or none", () => {
    expect(statementOf(PRINTER).paidOn).toBeNull();
    expect(statementOf(PRINTER, "2031-02-05").paidOn).toBe("2031-02-05");
  });
});
