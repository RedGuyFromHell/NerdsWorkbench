import { describe, expect, it } from "vitest";
import { readAmounts, readResult, storeTotals } from "../storage/amountCodec";
import { monthFileSchema } from "../storage/monthSchema";
import type { Correction } from "../storage/monthSchema";
import type { PayoutSettings, StoredPeople } from "../storage/schemas";
import { describeBlocker, planClose } from "./closeMonth";
import type { CloseInput, ClosePlan } from "./closeMonth";
import { buildMonthView } from "./monthView";
import { sumMonth } from "./monthTotals";
import { calculateLine } from "./payoutMath";
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

const CLOSED_AT = "2031-02-03T09:00:00Z";

function plan(overrides: Partial<CloseInput>): ClosePlan {
  return planClose({
    file: openMonth("2031-01", [PLAIN_LINE, PAINTED_LINE]),
    settings: TEST_SETTINGS,
    people: TEST_PEOPLE,
    months: [],
    closedAt: CLOSED_AT,
    ...overrides,
  });
}

function closedOf(result: ClosePlan) {
  if (result.kind === "refused") throw new Error("The month was refused.");
  return result.closed;
}

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

describe("what keeps a month open", () => {
  it("refuses while a line is blocked", () => {
    const noCost = testLine({
      lineId: "line-no-cost",
      facts: { ...PLAIN_LINE.facts, costBani: null },
    });
    expect(plan({ file: openMonth("2031-01", [PLAIN_LINE, noCost]) })).toEqual({
      kind: "refused",
      blockers: [{ kind: "blocked-lines", count: 1 }],
    });
  });

  it("refuses while a menu is empty", () => {
    const noPrinter = testLine({ lineId: "line-no-printer", printedBy: null });
    const noPainter = { ...PAINTED_LINE, paintedBy: null };
    expect(plan({ file: openMonth("2031-01", [PLAIN_LINE, noPrinter, noPainter]) })).toEqual({
      kind: "refused",
      blockers: [{ kind: "needs-choice", count: 2 }],
    });
  });

  it("refuses a choice that points at a person removed from Settings", () => {
    const people: StoredPeople = {
      ...TEST_PEOPLE,
      people: TEST_PEOPLE.people.filter((person) => person.id !== PAINTER),
    };
    expect(plan({ people })).toEqual({
      kind: "refused",
      blockers: [{ kind: "needs-choice", count: 1 }],
    });
  });

  it("refuses while an older month is open or was never loaded", () => {
    const result = plan({
      file: openMonth("2031-03", [PLAIN_LINE]),
      months: [
        { month: "2030-12", status: "closed" },
        { month: "2031-01", status: "open" },
        { month: "2031-02", status: "not-loaded" },
        { month: "2031-03", status: "open" },
        { month: "2031-04", status: "open" },
      ],
    });
    expect(result).toEqual({
      kind: "refused",
      blockers: [
        { kind: "older-month-open", month: "2031-01" },
        { kind: "older-month-open", month: "2031-02" },
      ],
    });
  });

  it("closes when only newer months are open", () => {
    const result = plan({
      months: [
        { month: "2030-12", status: "closed" },
        { month: "2031-01", status: "open" },
        { month: "2031-02", status: "open" },
      ],
    });
    expect(result.kind).toBe("ready");
  });

  it("refuses a month that is already closed", () => {
    const closed = closeMonth(openMonth("2031-01", [PLAIN_LINE]));
    expect(plan({ file: closed })).toEqual({
      kind: "refused",
      blockers: [{ kind: "already-closed" }],
    });
  });

  it("lists every reason at once", () => {
    const noCost = testLine({
      lineId: "line-no-cost",
      facts: { ...PLAIN_LINE.facts, costBani: null },
    });
    const result = plan({
      file: openMonth("2031-02", [noCost, testLine({ lineId: "line-2", printedBy: null })]),
      months: [{ month: "2031-01", status: "open" }],
    });
    expect(result).toEqual({
      kind: "refused",
      blockers: [
        { kind: "older-month-open", month: "2031-01" },
        { kind: "blocked-lines", count: 1 },
        { kind: "needs-choice", count: 1 },
      ],
    });
  });

  it("says each reason in a sentence", () => {
    const titleOf = (month: string) => `month ${month}`;
    expect(describeBlocker({ kind: "blocked-lines", count: 2 }, titleOf)).toBe(
      "2 lines are blocked: the maths cannot work them out yet.",
    );
    expect(describeBlocker({ kind: "needs-choice", count: 1 }, titleOf)).toBe(
      "1 line needs a person chosen for Printed by or Painted by.",
    );
    expect(describeBlocker({ kind: "older-month-open", month: "2031-01" }, titleOf)).toBe(
      "month 2031-01 is not closed. Months close oldest first.",
    );
  });
});

describe("the closed file", () => {
  const closed = closedOf(plan({}));

  it("is a valid closed month file", () => {
    expect(monthFileSchema.parse(closed)).toEqual(closed);
    expect(closed.status).toBe("closed");
    expect(closed.closedAt).toBe(CLOSED_AT);
  });

  it("keeps the inputs and the choices of every line", () => {
    expect(closed.lines).toEqual([PLAIN_LINE, PAINTED_LINE]);
  });

  it("holds the result of every line, amounts as exact text", () => {
    expect(closed.results.map((entry) => entry.lineId)).toEqual(["line-plain", "line-painted"]);
    expect(closed.results[0]?.result).toMatchObject({
      paidBani: 10000,
      costBani: 2000,
      fee: "300/1",
      shares: [{ personId: PRINTER, part: "print", amount: "4620/1" }],
      company: "3080/1",
    });
    expect(closed.results[1]?.result).toMatchObject({
      paidBani: 30000,
      costBani: 3000,
      fee: "900/1",
      shares: [
        { personId: PRINTER, part: "print", amount: "5184/1" },
        { personId: PAINTER, part: "paint", amount: "17460/1" },
      ],
      company: "3456/1",
    });
    expect(closed.results[1]?.result.steps.paintPrice).toBe("18000/1");
  });

  it("holds the totals: the people, the fees, the costs and the company are the money paid", () => {
    expect(closed.totals).toEqual({
      people: [
        {
          personId: PRINTER,
          print: "9804/1",
          paint: "0/1",
          drybrush: "0/1",
          corrections: "0/1",
          totalBani: 9804,
        },
        {
          personId: PAINTER,
          print: "0/1",
          paint: "17460/1",
          drybrush: "0/1",
          corrections: "0/1",
          totalBani: 17460,
        },
      ],
      paidBani: 40000,
      feesBani: 1200,
      costsBani: 5000,
      companyBani: 6536,
    });
  });

  it("freezes the settings and the people as used", () => {
    expect(closed.settings).toEqual({
      rates: TEST_SETTINGS.rates,
      rule: TEST_SETTINGS.rule,
      costTable: TEST_SETTINGS.costTable,
    });
    expect(closed.people).toEqual(TEST_PEOPLE.people);
    expect(closed.people).not.toBe(TEST_PEOPLE.people);
    expect(closed.settings.rates).not.toBe(TEST_SETTINGS.rates);
  });

  it("locks the corrections the open month carried, and counts them in the totals", () => {
    const withCorrection = closedOf(
      plan({ file: openMonth("2031-01", [PLAIN_LINE, PAINTED_LINE], [REMOVAL]) }),
    );
    expect(withCorrection.corrections).toEqual([REMOVAL]);
    expect(withCorrection.totals.people[0]).toEqual({
      personId: PRINTER,
      print: "9804/1",
      paint: "0/1",
      drybrush: "0/1",
      corrections: "-4620/1",
      totalBani: 5184,
    });
    // 300.00 paid, less fees 9.00, costs 30.00, printer 51.84, painter 174.60.
    expect(withCorrection.totals).toMatchObject({
      paidBani: 30000,
      feesBani: 900,
      costsBani: 3000,
      companyBani: 3456,
    });
  });

  it("closes an empty month", () => {
    const empty = closedOf(plan({ file: openMonth("2031-01", []) }));
    expect(empty.results).toEqual([]);
    expect(empty.totals).toEqual({
      people: [],
      paidBani: 0,
      feesBani: 0,
      costsBani: 0,
      companyBani: 0,
    });
  });
});

describe("a closed month is never worked out again", () => {
  const closed = closedOf(plan({}));
  const laterSettings: PayoutSettings = {
    ...TEST_SETTINGS,
    rates: { feeBp: 900, splitBp: 1000, drybrushBp: 0, drybrushMinBani: 0 },
  };
  const laterPeople: StoredPeople = {
    version: 1,
    // The printer is renamed and no longer paid; everyone else is removed.
    people: TEST_PEOPLE.people
      .filter((person) => person.id === PRINTER)
      .map((person) => ({ ...person, name: "Someone Else", getsPaid: false })),
  };

  it("shows the same money and the same names after Settings and the people change", () => {
    const before = buildMonthView(closed, TEST_SETTINGS, TEST_PEOPLE);
    const after = buildMonthView(closed, laterSettings, laterPeople);
    expect(after).toEqual(before);
    expect(after.people).toMatchObject([
      { name: "Printer A", total: "98.04" },
      { name: "Painter B", total: "174.60" },
    ]);
    expect(after.company).toBe("65.36");
    expect(after.orders[1]?.lines[0]).toMatchObject({
      fee: "9.00",
      company: "34.56",
      printedByName: "Printer A",
      paintedByName: "Painter B",
    });
  });

  it("shows the stored results, not a new calculation", () => {
    const tampered = structuredClone(closed);
    const first = tampered.results[0];
    if (first === undefined) throw new Error("The closed month has no result.");
    first.result.company = "1/1";
    expect(buildMonthView(tampered, TEST_SETTINGS, TEST_PEOPLE).orders[0]?.lines[0]?.company).toBe(
      "0.01",
    );
  });

  it("gives the same totals when worked out again from its own snapshot", () => {
    const results = closed.lines.map((line) =>
      calculateLine(
        { ...line.facts, printedBy: line.printedBy, paintedBy: line.paintedBy },
        closed.settings.rates,
        closed.people,
      ),
    );
    expect(results).toEqual(closed.results.map((entry) => readResult(entry.result)));
    const again = sumMonth(
      results,
      closed.corrections.map((correction) => readAmounts(correction.amounts)),
    );
    expect(storeTotals(again)).toEqual(closed.totals);
  });
});
