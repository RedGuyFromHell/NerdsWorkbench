import { describe, expect, it } from "vitest";
import { fromBani, fromFraction, ZERO_AMOUNT } from "./exactAmount";
import type { ExactAmount } from "./exactAmount";
import { sumMonth } from "./monthTotals";
import { calculateLine } from "./payoutMath";
import type {
  LineAmounts,
  LineInput,
  LineResult,
  MonthTotals,
  OkLineResult,
  PayoutRates,
  Person,
  Share,
} from "./types";

// Every number here is made up. Money is in bani: 620.00 is 62000.

const RATES: PayoutRates = { feeBp: 300, splitBp: 6000, drybrushBp: 1200, drybrushMinBani: 2000 };

const PRINTER = "printer-a";
const PAINTER = "painter-b";

const PEOPLE: Person[] = [
  { id: PRINTER, getsPaid: true },
  { id: PAINTER, getsPaid: true },
];

const PAINTED_FIGURINE: LineInput = {
  paidBani: 62000,
  listBani: 62000,
  qty: 1,
  paintOption: "complete",
  primedUnitBani: 23000,
  costBani: 5300,
  printedBy: PRINTER,
  paintedBy: PAINTER,
};

const PRIMED_BUST: LineInput = {
  paidBani: 7000,
  listBani: 7000,
  qty: 1,
  paintOption: "primed",
  primedUnitBani: 7000,
  costBani: 2200,
  printedBy: PRINTER,
  paintedBy: PAINTER,
};

const BLOCKED_LINE: LineResult = { status: "blocked", reason: "no-cost" };

const NO_STEPS: OkLineResult["steps"] = {
  printPrice: ZERO_AMOUNT,
  printFee: ZERO_AMOUNT,
  drybrush: ZERO_AMOUNT,
  profit: ZERO_AMOUNT,
  printer: ZERO_AMOUNT,
  companyPrint: ZERO_AMOUNT,
  paintPrice: ZERO_AMOUNT,
  paintFee: ZERO_AMOUNT,
  painter: ZERO_AMOUNT,
};

/** A line with hand-written amounts, for the rounding cases a real line does not hit on demand. */
function madeLine(amounts: Partial<LineAmounts>): OkLineResult {
  return {
    status: "ok",
    paidBani: 0,
    costBani: 0,
    fee: ZERO_AMOUNT,
    shares: [],
    company: ZERO_AMOUNT,
    tags: [],
    steps: NO_STEPS,
    ...amounts,
  };
}

function printShare(personId: string, amount: ExactAmount): Share {
  return { personId, part: "print", amount };
}

/** What section 3.4 of the spec promises: everything adds up to the money paid, to the ban. */
function expectAddsUpToPaid(totals: MonthTotals): void {
  const peopleBani = totals.people.reduce((sum, person) => sum + person.totalBani, 0);
  expect(peopleBani + totals.companyBani + totals.feesBani + totals.costsBani).toBe(
    totals.paidBani,
  );
}

describe("sumMonth: a month of whole lines", () => {
  it("sums the spec's two worked examples per person and for the company", () => {
    const totals = sumMonth(
      [calculateLine(PAINTED_FIGURINE, RATES, PEOPLE), calculateLine(PRIMED_BUST, RATES, PEOPLE)],
      [],
    );
    expect(totals).toEqual({
      people: [
        {
          personId: PRINTER,
          print: fromBani(11760),
          paint: ZERO_AMOUNT,
          drybrush: ZERO_AMOUNT,
          corrections: ZERO_AMOUNT,
          totalBani: 11760,
        },
        {
          personId: PAINTER,
          print: ZERO_AMOUNT,
          paint: fromBani(37830),
          drybrush: fromBani(2000),
          corrections: ZERO_AMOUNT,
          totalBani: 39830,
        },
      ],
      paidBani: 69000,
      feesBani: 2070,
      costsBani: 7500,
      companyBani: 7840,
      blockedLines: 0,
    });
    expectAddsUpToPaid(totals);
  });

  it("an empty month is all zeros", () => {
    expect(sumMonth([], [])).toEqual({
      people: [],
      paidBani: 0,
      feesBani: 0,
      costsBani: 0,
      companyBani: 0,
      blockedLines: 0,
    });
  });

  it("lists people in the order they first appear", () => {
    const totals = sumMonth(
      [
        madeLine({ shares: [printShare("second", fromBani(1))] }),
        madeLine({ shares: [printShare("first", fromBani(1)), printShare("second", fromBani(1))] }),
      ],
      [],
    );
    expect(totals.people.map((person) => person.personId)).toEqual(["second", "first"]);
  });

  it("leaves blocked lines out of every total and counts them", () => {
    const totals = sumMonth(
      [BLOCKED_LINE, calculateLine(PRIMED_BUST, RATES, PEOPLE), BLOCKED_LINE],
      [],
    );
    expect(totals.blockedLines).toBe(2);
    expect(totals.paidBani).toBe(7000);
    expect(totals.companyBani).toBe(1036);
    expectAddsUpToPaid(totals);
  });
});

describe("sumMonth: rounding", () => {
  it("rounds a half ban up", () => {
    const half = fromFraction(1n, 2n);
    const totals = sumMonth(
      [madeLine({ paidBani: 1, shares: [printShare(PRINTER, half)], company: half })],
      [],
    );
    expect(totals.people[0]?.totalBani).toBe(1);
    expect(totals.companyBani).toBe(0);
    expectAddsUpToPaid(totals);
  });

  it("rounds a negative half ban away from zero", () => {
    const minusHalf = fromFraction(-1n, 2n);
    const totals = sumMonth(
      [madeLine({ costBani: 1, shares: [printShare(PRINTER, minusHalf)], company: minusHalf })],
      [],
    );
    expect(totals.people[0]?.totalBani).toBe(-1);
    expect(totals.companyBani).toBe(0);
    expectAddsUpToPaid(totals);
  });

  it("rounds the person's month total once: three thirds of a ban are one ban", () => {
    const third = fromFraction(1n, 3n);
    const thirdLine = madeLine({
      paidBani: 1,
      shares: [printShare(PRINTER, third)],
      company: fromFraction(2n, 3n),
    });
    const totals = sumMonth([thirdLine, thirdLine, thirdLine], []);
    expect(totals.people[0]?.print).toEqual(fromBani(1));
    expect(totals.people[0]?.totalBani).toBe(1);
    expect(totals.companyBani).toBe(2);
    expectAddsUpToPaid(totals);
  });

  it("rounds the total, not each part: print, paint and drybrush of 0.4 ban give 1", () => {
    const fourTenths = fromFraction(2n, 5n);
    const totals = sumMonth(
      [
        madeLine({
          paidBani: 2,
          shares: [
            { personId: PAINTER, part: "print", amount: fourTenths },
            { personId: PAINTER, part: "paint", amount: fourTenths },
            { personId: PAINTER, part: "drybrush", amount: fourTenths },
          ],
          company: fromFraction(4n, 5n),
        }),
      ],
      [],
    );
    expect(totals.people).toEqual([
      {
        personId: PAINTER,
        print: fourTenths,
        paint: fourTenths,
        drybrush: fourTenths,
        corrections: ZERO_AMOUNT,
        totalBani: 1,
      },
    ]);
    expect(totals.companyBani).toBe(1);
  });

  it("rounds the fees once for the month: three half bani are 2, not 3", () => {
    const half = fromFraction(1n, 2n);
    const feeLine = madeLine({ paidBani: 1, fee: half, company: half });
    const totals = sumMonth([feeLine, feeLine, feeLine], []);
    expect(totals.feesBani).toBe(2);
    expect(totals.companyBani).toBe(1);
    expectAddsUpToPaid(totals);
  });

  it("a month of lines with fractions of a ban still adds up to the money paid", () => {
    const twoThirdsDiscount: LineInput = {
      ...PAINTED_FIGURINE,
      paidBani: 20000,
      listBani: 30000,
      primedUnitBani: 10000,
      costBani: 1000,
    };
    const fifthOff: LineInput = { ...PAINTED_FIGURINE, paidBani: 49600 };
    const totals = sumMonth(
      [twoThirdsDiscount, fifthOff, PRIMED_BUST].map((input) =>
        calculateLine(input, RATES, PEOPLE),
      ),
      [],
    );
    expect(totals.people.map((person) => [person.personId, person.totalBani])).toEqual([
      [PRINTER, 12363],
      [PAINTER, 45197],
    ]);
    expect(totals.paidBani).toBe(76600);
    expect(totals.feesBani).toBe(2298);
    expect(totals.costsBani).toBe(8500);
    expect(totals.companyBani).toBe(8242);
    expectAddsUpToPaid(totals);
  });
});

describe("sumMonth: corrections", () => {
  /** The painted figurine of a closed month, refunded in full: every amount of the line, reversed. */
  const FIGURINE_REFUND: LineAmounts = {
    paidBani: -62000,
    costBani: -5300,
    fee: fromBani(-1860),
    shares: [
      { personId: PRINTER, part: "print", amount: fromBani(-10206) },
      { personId: PAINTER, part: "paint", amount: fromBani(-37830) },
    ],
    company: fromBani(-6804),
  };

  it("takes a full refund off each person and off the company", () => {
    const totals = sumMonth([calculateLine(PRIMED_BUST, RATES, PEOPLE)], [FIGURINE_REFUND]);
    expect(totals).toEqual({
      people: [
        {
          personId: PRINTER,
          print: fromBani(1554),
          paint: ZERO_AMOUNT,
          drybrush: ZERO_AMOUNT,
          corrections: fromBani(-10206),
          totalBani: -8652,
        },
        {
          personId: PAINTER,
          print: ZERO_AMOUNT,
          paint: ZERO_AMOUNT,
          drybrush: fromBani(2000),
          corrections: fromBani(-37830),
          totalBani: -35830,
        },
      ],
      paidBani: -55000,
      feesBani: -1650,
      costsBani: -3100,
      companyBani: -5768,
      blockedLines: 0,
    });
    expectAddsUpToPaid(totals);
  });

  it("a line and its full refund in one month cancel out to zero", () => {
    const totals = sumMonth([calculateLine(PAINTED_FIGURINE, RATES, PEOPLE)], [FIGURINE_REFUND]);
    expect(totals.people.map((person) => person.totalBani)).toEqual([0, 0]);
    expect(totals.paidBani).toBe(0);
    expect(totals.feesBani).toBe(0);
    expect(totals.costsBani).toBe(0);
    expect(totals.companyBani).toBe(0);
  });

  it("a correction rounds with the person's month total, not on its own", () => {
    const quarter = fromFraction(1n, 4n);
    const totals = sumMonth(
      [madeLine({ paidBani: 1, shares: [printShare(PRINTER, quarter)], company: quarter })],
      [
        {
          paidBani: 0,
          costBani: 0,
          fee: ZERO_AMOUNT,
          shares: [printShare(PRINTER, quarter)],
          company: quarter,
        },
      ],
    );
    expect(totals.people).toEqual([
      {
        personId: PRINTER,
        print: quarter,
        paint: ZERO_AMOUNT,
        drybrush: ZERO_AMOUNT,
        corrections: quarter,
        totalBani: 1,
      },
    ]);
    expectAddsUpToPaid(totals);
  });

  it("a person with only a correction is in the totals", () => {
    const totals = sumMonth([], [FIGURINE_REFUND]);
    expect(totals.people.map((person) => [person.personId, person.totalBani])).toEqual([
      [PRINTER, -10206],
      [PAINTER, -37830],
    ]);
    expect(totals.companyBani).toBe(-6804);
    expectAddsUpToPaid(totals);
  });
});
