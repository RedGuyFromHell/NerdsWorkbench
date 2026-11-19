import { describe, expect, it } from "vitest";
import { monthFileSchema } from "../storage/monthSchema";
import type { StoredPeople } from "../storage/schemas";
import { planCorrections } from "./corrections";
import { buildMonthView } from "./monthView";
import {
  closeMonth,
  openMonth,
  PAINTED_LINE,
  PAINTER,
  PLAIN_LINE,
  PRINTER,
  TEST_PEOPLE,
  TEST_SETTINGS,
} from "./testMonths";

const JANUARY = closeMonth(openMonth("2031-01", [PLAIN_LINE]));
/** The plain line of January taken back: printer −46.20, company −30.80. */
const TAKEN_BACK = planCorrections(
  [JANUARY],
  [{ month: "2031-01", lineId: "line-plain", state: null }],
);
const FEBRUARY = openMonth("2031-02", [PAINTED_LINE], TAKEN_BACK);

describe("a month that carries a correction", () => {
  const view = buildMonthView(FEBRUARY, TEST_SETTINGS, TEST_PEOPLE);

  it("counts it under the person, in their one total", () => {
    // Printer: 51.84 for the painted line, less 46.20.
    expect(view.people).toEqual([
      {
        personId: PRINTER,
        name: "Printer A",
        print: "51.84",
        paint: "0.00",
        drybrush: "0.00",
        corrections: "−46.20",
        total: "5.64",
      },
      {
        personId: PAINTER,
        name: "Painter B",
        print: "0.00",
        paint: "174.60",
        drybrush: "0.00",
        corrections: "0.00",
        total: "174.60",
      },
    ]);
  });

  it("still adds up: paid = fees + costs + people + company", () => {
    // 300.00 − 100.00 paid; fees 9.00 − 3.00; costs 30.00 − 20.00; people 5.64 + 174.60.
    expect(view).toMatchObject({ paid: "200.00", fees: "6.00", costs: "10.00", company: "3.76" });
    expect(view.companyCorrections).toBe("−30.80");
  });

  it("lists it in the corrections box, with what it takes from whom", () => {
    expect(view.corrections).toEqual([
      {
        id: "2031-01/line-plain",
        title: "#2001 · Marsh Troll",
        text: "Paid in January 2031, refunded in full or cancelled since.",
        people: [{ personId: PRINTER, name: "Printer A", amount: "−46.20" }],
        company: "−30.80",
      },
    ]);
  });

  it("keeps the total of a person who is gone from Settings by now", () => {
    const withoutPrinter: StoredPeople = {
      ...TEST_PEOPLE,
      people: TEST_PEOPLE.people.filter((person) => person.id !== PRINTER),
    };
    const later = buildMonthView(
      openMonth("2031-02", [], TAKEN_BACK),
      TEST_SETTINGS,
      withoutPrinter,
    );
    expect(later.people).toMatchObject([
      { personId: PRINTER, name: "Unknown person", corrections: "−46.20", total: "−46.20" },
    ]);
    expect(later.corrections[0]?.people[0]?.name).toBe("Unknown person");
  });

  it("says a partial refund in its own words", () => {
    const halved = planCorrections(
      [JANUARY],
      [
        {
          month: "2031-01",
          lineId: "line-plain",
          state: { qty: 1, paidBani: 5000, listBani: 5000 },
        },
      ],
    );
    const text = buildMonthView(openMonth("2031-02", [], halved), TEST_SETTINGS, TEST_PEOPLE)
      .corrections[0]?.text;
    expect(text).toBe("Paid in January 2031, partly refunded since.");
  });
});

describe("a month with no correction", () => {
  it("has an empty box and no corrections line for the company", () => {
    const view = buildMonthView(openMonth("2031-02", [PAINTED_LINE]), TEST_SETTINGS, TEST_PEOPLE);
    expect(view.corrections).toEqual([]);
    expect(view.companyCorrections).toBeNull();
    expect(view.closedText).toBeNull();
  });
});

describe("a closed month on screen", () => {
  it("says when it was closed, and shows the corrections locked in it", () => {
    const closed = closeMonth(FEBRUARY);
    const view = buildMonthView(closed, TEST_SETTINGS, TEST_PEOPLE);
    expect(view.status).toBe("closed");
    expect(view.closedText).toBe("28 Feb 2031, 18:00");
    expect(view.corrections).toHaveLength(1);
    expect(view.people[0]).toMatchObject({ corrections: "−46.20", total: "5.64" });
  });
});

describe("the month file schema", () => {
  it("reads an open month with no corrections field", () => {
    const file = openMonth("2031-02", [PLAIN_LINE]);
    expect("corrections" in file).toBe(false);
    expect(monthFileSchema.parse(file)).toEqual(file);
  });

  it("refuses a closed month without its frozen parts", () => {
    const { results: _results, totals: _totals, ...withoutResults } = JANUARY;
    expect(monthFileSchema.safeParse(withoutResults).success).toBe(false);
    const { people: _people, ...withoutPeople } = JANUARY;
    expect(monthFileSchema.safeParse(withoutPeople).success).toBe(false);
  });

  it("refuses a closed month whose results are not one per line", () => {
    expect(monthFileSchema.safeParse({ ...JANUARY, results: [] }).success).toBe(false);
    const renamed = JANUARY.results.map((entry) => ({ ...entry, lineId: "line-other" }));
    expect(monthFileSchema.safeParse({ ...JANUARY, results: renamed }).success).toBe(false);
  });

  it("refuses an amount that is not exact text", () => {
    const [first] = TAKEN_BACK;
    if (first === undefined) throw new Error("No correction to break.");
    const broken = { ...first, amounts: { ...first.amounts, fee: "-2.00" } };
    expect(monthFileSchema.safeParse(openMonth("2031-02", [], [broken])).success).toBe(false);
  });
});
