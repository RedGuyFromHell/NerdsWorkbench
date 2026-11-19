import { describe, expect, it } from "vitest";
import { readAmounts } from "../storage/amountCodec";
import { correctionSchema } from "../storage/monthSchema";
import type { Correction, StoredAmounts } from "../storage/monthSchema";
import type { PayoutSettings, StoredPeople } from "../storage/schemas";
import { findCorrectionsMonth, planCorrections } from "./corrections";
import { add, compare, fromBani, ZERO_AMOUNT } from "./exactAmount";
import { sumMonth } from "./monthTotals";
import { calculateLine } from "./payoutMath";
import {
  closeMonth,
  FARM,
  openMonth,
  PAINTED_LINE,
  PAINTER,
  PLAIN_LINE,
  PRINTER,
  TEST_PEOPLE,
  TEST_SETTINGS,
  testLine,
} from "./testMonths";

const JANUARY = closeMonth(openMonth("2031-01", [PLAIN_LINE, PAINTED_LINE]));

/** Minus everything locked for the plain line: fee 3.00, cost 20.00, printer 46.20, company 30.80. */
const PLAIN_REMOVED: StoredAmounts = {
  paidBani: -10000,
  costBani: -2000,
  fee: "-300/1",
  shares: [{ personId: PRINTER, part: "print", amount: "-4620/1" }],
  company: "-3080/1",
};

/** One of the two plain pieces refunded: half of everything goes back. */
const PLAIN_HALVED: StoredAmounts = {
  paidBani: -5000,
  costBani: -1000,
  fee: "-150/1",
  shares: [{ personId: PRINTER, part: "print", amount: "-2310/1" }],
  company: "-1540/1",
};

const HALF_STATE = { qty: 1, paidBani: 5000, listBani: 5000 };

function expectAddsUp(amounts: StoredAmounts): void {
  const exact = readAmounts(amounts);
  const shares = exact.shares.reduce((sum, share) => add(sum, share.amount), ZERO_AMOUNT);
  const everything = add(add(exact.fee, fromBani(exact.costBani)), add(shares, exact.company));
  expect(compare(everything, fromBani(exact.paidBani))).toBe(0);
}

function only(corrections: Correction[]): Correction {
  const [first] = corrections;
  if (first === undefined || corrections.length !== 1) {
    throw new Error(`Expected one correction, got ${corrections.length}.`);
  }
  return first;
}

describe("a line gone after its month closed", () => {
  it("is taken back in full: minus the locked amounts, per person and for the company", () => {
    const corrections = planCorrections(
      [JANUARY],
      [{ month: "2031-01", lineId: "line-plain", state: null }],
    );
    expect(corrections).toEqual([
      {
        sourceMonth: "2031-01",
        lineId: "line-plain",
        orderName: "#2001",
        productTitle: "Marsh Troll",
        variantTitle: "",
        reason: "removed",
        amounts: PLAIN_REMOVED,
      },
    ]);
    expect(correctionSchema.parse(corrections[0])).toEqual(corrections[0]);
  });

  it("takes back the print and the paint share of a painted line", () => {
    const correction = only(
      planCorrections([JANUARY], [{ month: "2031-01", lineId: "line-painted", state: null }]),
    );
    expect(correction.amounts).toEqual({
      paidBani: -30000,
      costBani: -3000,
      fee: "-900/1",
      shares: [
        { personId: PRINTER, part: "print", amount: "-5184/1" },
        { personId: PAINTER, part: "paint", amount: "-17460/1" },
      ],
      company: "-3456/1",
    });
    expectAddsUp(correction.amounts);
  });

  it("reverses every line of a cancelled order, and the month it lands in is back to nothing", () => {
    const corrections = planCorrections(
      [JANUARY],
      [
        { month: "2031-01", lineId: "line-plain", state: null },
        { month: "2031-01", lineId: "line-painted", state: null },
      ],
    );
    expect(corrections).toHaveLength(2);
    const totals = sumMonth(
      [],
      corrections.map((correction) => readAmounts(correction.amounts)),
    );
    expect(totals).toMatchObject({
      paidBani: -40000,
      feesBani: -1200,
      costsBani: -5000,
      companyBani: -6536,
    });
    expect(totals.people.map((person) => [person.personId, person.totalBani])).toEqual([
      [PRINTER, -9804],
      [PAINTER, -17460],
    ]);
  });

  it("takes nothing from a person who was not paid: the share was the company's", () => {
    const farmLine = testLine({ lineId: "line-farm", printedBy: FARM });
    const closed = closeMonth(openMonth("2031-01", [farmLine]));
    const correction = only(
      planCorrections([closed], [{ month: "2031-01", lineId: "line-farm", state: null }]),
    );
    expect(correction.amounts).toEqual({
      paidBani: -10000,
      costBani: -2000,
      fee: "-300/1",
      shares: [],
      company: "-7700/1",
    });
  });
});

describe("a partial refund after the close", () => {
  it("is the line worked out again, minus what was locked", () => {
    const correction = only(
      planCorrections([JANUARY], [{ month: "2031-01", lineId: "line-plain", state: HALF_STATE }]),
    );
    expect(correction.reason).toBe("reduced");
    expect(correction.amounts).toEqual(PLAIN_HALVED);
    expectAddsUp(correction.amounts);
  });

  it("splits a painted line again with the locked primed price", () => {
    // Half the money back, the piece kept: print part 60.00 (fee 1.80, cost 30.00, profit 28.20,
    // printer 16.92, company 11.28), paint part 90.00 (fee 2.70, painter 87.30).
    const correction = only(
      planCorrections(
        [JANUARY],
        [
          {
            month: "2031-01",
            lineId: "line-painted",
            state: { qty: 1, paidBani: 15000, listBani: 30000 },
          },
        ],
      ),
    );
    expect(correction.amounts).toEqual({
      paidBani: -15000,
      costBani: 0,
      fee: "-450/1",
      shares: [
        { personId: PRINTER, part: "print", amount: "-3492/1" },
        { personId: PAINTER, part: "paint", amount: "-8730/1" },
      ],
      company: "-2328/1",
    });
    expectAddsUp(correction.amounts);
  });

  it("uses the closed month's rates and people, whatever Settings says now", () => {
    const otherRates: PayoutSettings = {
      ...TEST_SETTINGS,
      rates: { ...TEST_SETTINGS.rates, splitBp: 5000 },
    };
    const unpaidPrinter: StoredPeople = {
      ...TEST_PEOPLE,
      people: TEST_PEOPLE.people.map((person) =>
        person.id === PRINTER ? { ...person, getsPaid: false } : person,
      ),
    };
    // Closed at 50%: profit 77.00, printer 38.50. Half left: printer 19.25, so 19.25 goes back.
    const atHalf = closeMonth(openMonth("2031-01", [PLAIN_LINE]), otherRates);
    const halved = [{ month: "2031-01", lineId: "line-plain", state: HALF_STATE }];
    expect(only(planCorrections([atHalf], halved)).amounts.shares).toEqual([
      { personId: PRINTER, part: "print", amount: "-1925/1" },
    ]);
    // Closed while the printer was not paid: there is no share to take back.
    const unpaid = closeMonth(openMonth("2031-01", [PLAIN_LINE]), TEST_SETTINGS, unpaidPrinter);
    expect(only(planCorrections([unpaid], halved)).amounts).toMatchObject({
      shares: [],
      company: "-3850/1",
    });
  });
});

describe("what gives no correction", () => {
  it("is a line that is as it was locked", () => {
    const same = { qty: 2, paidBani: 10000, listBani: 10000 };
    expect(
      planCorrections([JANUARY], [{ month: "2031-01", lineId: "line-plain", state: same }]),
    ).toEqual([]);
  });

  it("is a second run: the same facts give the same list, not a second correction", () => {
    const current = [{ month: "2031-01", lineId: "line-plain", state: null }];
    expect(planCorrections([JANUARY], current)).toEqual(planCorrections([JANUARY], current));
  });

  it("is a correction already locked in a later closed month", () => {
    const current = [{ month: "2031-01", lineId: "line-plain", state: null }];
    const february = closeMonth(
      openMonth("2031-02", [testLine({ lineId: "line-feb" })], planCorrections([JANUARY], current)),
    );
    expect(planCorrections([JANUARY, february], current)).toEqual([]);
  });

  it("is only the rest, when a part was already corrected", () => {
    const halved = planCorrections(
      [JANUARY],
      [{ month: "2031-01", lineId: "line-plain", state: HALF_STATE }],
    );
    const february = closeMonth(openMonth("2031-02", [], halved));
    // The other piece is refunded too: what is left to take back is the second half.
    const rest = only(
      planCorrections(
        [JANUARY, february],
        [{ month: "2031-01", lineId: "line-plain", state: null }],
      ),
    );
    expect(rest.reason).toBe("removed");
    expect(rest.amounts).toEqual(PLAIN_HALVED);
  });
});

describe("a correction in the month that carries it", () => {
  it("rounds with the person's month total, not on its own", () => {
    // Paid 33.33, cost 10.00: printer 13.39806. Paid 33.34: printer 13.40388.
    const oddLine = testLine({
      lineId: "line-odd",
      facts: { ...PLAIN_LINE.facts, qty: 1, paidBani: 3333, listBani: 3333, costBani: 1000 },
    });
    const closed = closeMonth(openMonth("2031-01", [oddLine]));
    const correction = only(
      planCorrections([closed], [{ month: "2031-01", lineId: "line-odd", state: null }]),
    );
    expect(correction.amounts.shares).toEqual([
      { personId: PRINTER, part: "print", amount: "-669903/500" },
    ]);
    const thisMonth = calculateLine(
      { ...oddLine.facts, paidBani: 3334, listBani: 3334, printedBy: PRINTER, paintedBy: null },
      TEST_SETTINGS.rates,
      TEST_PEOPLE.people,
    );
    const totals = sumMonth([thisMonth], [readAmounts(correction.amounts)]);
    // 1340.388 − 1339.806 = 0.582 bani, so 1 ban. Each rounded alone would be 1340 − 1340 = 0.
    expect(totals.people).toMatchObject([{ personId: PRINTER, totalBani: 1 }]);
    expect(totals).toMatchObject({ paidBani: 1, costsBani: 0, feesBani: 0, companyBani: 0 });
  });
});

describe("what the planner refuses", () => {
  it("throws for a month that is not closed", () => {
    expect(() =>
      planCorrections([JANUARY], [{ month: "2031-02", lineId: "line-plain", state: null }]),
    ).toThrow("2031-02");
  });

  it("throws for a line the closed month does not hold", () => {
    expect(() =>
      planCorrections([JANUARY], [{ month: "2031-01", lineId: "line-nowhere", state: null }]),
    ).toThrow("line-nowhere");
  });

  it("throws for a state with no pieces left: that line is gone", () => {
    expect(() =>
      planCorrections(
        [JANUARY],
        [{ month: "2031-01", lineId: "line-plain", state: { qty: 0, paidBani: 0, listBani: 0 } }],
      ),
    ).toThrow("line-plain");
  });
});

describe("the month that takes the corrections", () => {
  it("is the oldest month that is not closed", () => {
    expect(
      findCorrectionsMonth([
        { month: "2031-03", status: "open" },
        { month: "2031-02", status: "open" },
        { month: "2031-01", status: "closed" },
      ]),
    ).toBe("2031-02");
  });

  it("can be a month that is not loaded yet", () => {
    expect(
      findCorrectionsMonth([
        { month: "2031-01", status: "closed" },
        { month: "2031-02", status: "not-loaded" },
        { month: "2031-03", status: "open" },
      ]),
    ).toBe("2031-02");
  });

  it("is none when every month is closed", () => {
    expect(findCorrectionsMonth([{ month: "2031-01", status: "closed" }])).toBeNull();
  });
});
