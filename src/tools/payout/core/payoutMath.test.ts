import { describe, expect, it } from "vitest";
import { add, formatAmount, fromBani, fromFraction, parseAmount, ZERO_AMOUNT } from "./exactAmount";
import type { ExactAmount } from "./exactAmount";
import { calculateLine } from "./payoutMath";
import type { LineInput, LineResult, OkLineResult, PayoutRates, Person, Share } from "./types";

// Every number here is made up. Money is in bani: 620.00 is 62000.

/** The settings of the spec's worked example: fee 3%, split 60%, drybrush 12% with a minimum of 20.00. */
const RATES: PayoutRates = { feeBp: 300, splitBp: 6000, drybrushBp: 1200, drybrushMinBani: 2000 };

const PRINTER = "printer-a";
const PAINTER = "painter-b";
const FARM = "farm";
const OWNER = "owner";

const PEOPLE: Person[] = [
  { id: PRINTER, getsPaid: true },
  { id: PAINTER, getsPaid: true },
  { id: FARM, getsPaid: false },
  { id: OWNER, getsPaid: false },
];

/** The spec's painted figurine: paid 620.00, primed price 230.00, cost 53.00. */
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

/** The spec's primed bust: paid 70.00, cost 22.00. */
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

/** A plain resin print with no paint option. */
const PLAIN_PRINT: LineInput = {
  paidBani: 10000,
  listBani: 10000,
  qty: 1,
  paintOption: "none",
  primedUnitBani: null,
  costBani: 2000,
  printedBy: PRINTER,
  paintedBy: null,
};

function sumAmounts(amounts: ExactAmount[]): ExactAmount {
  return amounts.reduce(add, ZERO_AMOUNT);
}

/** The identity every line must keep: both fees, the cost, every share and the company's part are the money paid. */
function expectAddsUpToPaid(line: OkLineResult): void {
  expect(line.fee).toEqual(add(line.steps.printFee, line.steps.paintFee));
  const total = sumAmounts([
    line.fee,
    fromBani(line.costBani),
    ...line.shares.map((lineShare) => lineShare.amount),
    line.company,
  ]);
  expect(total).toEqual(fromBani(line.paidBani));
}

/** Calculates a line that must not be blocked, and checks the identity on it. */
function calculateOk(input: LineInput, rates: PayoutRates = RATES): OkLineResult {
  const line = calculateLine(input, rates, PEOPLE);
  if (line.status !== "ok") throw new Error(`the line is blocked: ${line.reason}`);
  expect(line.paidBani).toBe(input.paidBani);
  expectAddsUpToPaid(line);
  return line;
}

function share(personId: string, part: Share["part"], bani: number): Share {
  return { personId, part, amount: fromBani(bani) };
}

describe("calculateLine: the spec's worked examples", () => {
  it("painted figurine: printer 102.06, company 68.04, painter 378.30", () => {
    const line = calculateOk(PAINTED_FIGURINE);
    expect(line.shares).toEqual([share(PRINTER, "print", 10206), share(PAINTER, "paint", 37830)]);
    expect(line.company).toEqual(fromBani(6804));
    expect(line.fee).toEqual(fromBani(1860));
    expect(line.costBani).toBe(5300);
    expect(line.tags).toEqual([]);
    expect(line.steps).toEqual({
      printPrice: fromBani(23000),
      printFee: fromBani(690),
      drybrush: ZERO_AMOUNT,
      profit: fromBani(17010),
      printer: fromBani(10206),
      companyPrint: fromBani(6804),
      paintPrice: fromBani(39000),
      paintFee: fromBani(1170),
      painter: fromBani(37830),
    });
  });

  it("primed bust: drybrush 20.00, printer 15.54, company 10.36", () => {
    const line = calculateOk(PRIMED_BUST);
    expect(line.shares).toEqual([share(PRINTER, "print", 1554), share(PAINTER, "drybrush", 2000)]);
    expect(line.company).toEqual(fromBani(1036));
    expect(line.fee).toEqual(fromBani(210));
    expect(line.tags).toEqual(["min-drybrush"]);
    expect(line.steps.profit).toEqual(fromBani(2590));
    expect(line.steps.paintPrice).toEqual(ZERO_AMOUNT);
    expect(line.steps.painter).toEqual(ZERO_AMOUNT);
  });
});

describe("calculateLine: the minimum drybrush", () => {
  it("pays the percent when it is above the minimum", () => {
    const line = calculateOk({ ...PRIMED_BUST, paidBani: 20000, listBani: 20000, costBani: 3000 });
    expect(line.steps.drybrush).toEqual(fromBani(2400));
    expect(line.tags).toEqual([]);
    expect(line.shares).toEqual([share(PRINTER, "print", 8400), share(PAINTER, "drybrush", 2400)]);
    expect(line.company).toEqual(fromBani(5600));
  });

  it("pays the minimum when the percent is below it, and says so", () => {
    const line = calculateOk(PRIMED_BUST);
    expect(line.steps.drybrush).toEqual(fromBani(2000));
    expect(line.tags).toContain("min-drybrush");
  });

  it("does not tag a percent exactly equal to the minimum", () => {
    const line = calculateOk({ ...PRIMED_BUST, paidBani: 50000, listBani: 50000, qty: 3 });
    expect(line.steps.drybrush).toEqual(fromBani(6000));
    expect(line.tags).toEqual([]);
  });

  it("takes the minimum per piece: quantity 3 gives three minimums", () => {
    const line = calculateOk({
      ...PRIMED_BUST,
      paidBani: 30000,
      listBani: 30000,
      qty: 3,
      costBani: 5400,
    });
    expect(line.steps.drybrush).toEqual(fromBani(6000));
    expect(line.tags).toEqual(["min-drybrush"]);
    expect(line.shares).toEqual([share(PRINTER, "print", 10620), share(PAINTER, "drybrush", 6000)]);
    expect(line.company).toEqual(fromBani(7080));
  });
});

describe("calculateLine: painted against primed", () => {
  it("with no discount the print part is the primed price", () => {
    const line = calculateOk(PAINTED_FIGURINE);
    expect(line.steps.printPrice).toEqual(fromBani(23000));
    expect(line.steps.paintPrice).toEqual(fromBani(39000));
  });

  it("a 20% order discount scales the print part and the paint part alike", () => {
    const line = calculateOk({ ...PAINTED_FIGURINE, paidBani: 49600 });
    expect(line.steps.printPrice).toEqual(fromBani(18400));
    expect(line.steps.paintPrice).toEqual(fromBani(31200));
    expect(line.steps.profit).toEqual(fromBani(12548));
    expect(line.shares).toEqual([
      { personId: PRINTER, part: "print", amount: fromFraction(37644n, 5n) },
      share(PAINTER, "paint", 30264),
    ]);
    expect(line.company).toEqual(fromFraction(25096n, 5n));
  });

  it("keeps full precision when the discount ratio does not end (two thirds)", () => {
    const line = calculateOk({
      ...PAINTED_FIGURINE,
      paidBani: 20000,
      listBani: 30000,
      primedUnitBani: 10000,
      costBani: 1000,
    });
    expect(line.steps.printPrice).toEqual(fromFraction(20000n, 3n));
    expect(line.shares).toEqual([
      share(PRINTER, "print", 3280),
      { personId: PAINTER, part: "paint", amount: fromFraction(38800n, 3n) },
    ]);
    expect(line.company).toEqual(fromFraction(6560n, 3n));
    expect(line.fee).toEqual(fromBani(600));
  });

  it("quantity 2 takes the primed price twice", () => {
    const line = calculateOk({
      ...PAINTED_FIGURINE,
      paidBani: 124000,
      listBani: 124000,
      qty: 2,
      costBani: 10600,
    });
    expect(line.steps.printPrice).toEqual(fromBani(46000));
    expect(line.shares).toEqual([share(PRINTER, "print", 20412), share(PAINTER, "paint", 75660)]);
    expect(line.company).toEqual(fromBani(13608));
  });

  it("a primed price above the line returns the negative paint part, tagged, not hidden", () => {
    const line = calculateOk({
      ...PAINTED_FIGURINE,
      paidBani: 25000,
      listBani: 25000,
      primedUnitBani: 30000,
      costBani: 5000,
    });
    expect(line.steps.paintPrice).toEqual(fromBani(-5000));
    expect(line.shares).toEqual([share(PRINTER, "print", 14460), share(PAINTER, "paint", -4850)]);
    expect(line.company).toEqual(fromBani(9640));
    expect(line.fee).toEqual(fromBani(750));
    expect(line.tags).toEqual(["negative-paint"]);
  });

  it("a partial paint job splits like a complete one", () => {
    const line = calculateOk({ ...PAINTED_FIGURINE, paintOption: "partial" });
    expect(line.shares).toEqual([share(PRINTER, "print", 10206), share(PAINTER, "paint", 37830)]);
  });
});

describe("calculateLine: who gets the money", () => {
  it("a printer with Gets paid off: the print share stays in the company", () => {
    const line = calculateOk({ ...PRIMED_BUST, printedBy: OWNER });
    expect(line.shares).toEqual([share(PAINTER, "drybrush", 2000)]);
    expect(line.company).toEqual(fromBani(2590));
    expect(line.tags).toEqual(["min-drybrush", "stays-in-company"]);
  });

  it("a print farm: the whole print profit stays in the company", () => {
    const line = calculateOk({ ...PAINTED_FIGURINE, printedBy: FARM });
    expect(line.shares).toEqual([share(PAINTER, "paint", 37830)]);
    expect(line.company).toEqual(fromBani(17010));
    expect(line.tags).toEqual(["stays-in-company"]);
  });

  it("a painter who does not get paid: the paint part stays in the company", () => {
    const line = calculateOk({ ...PAINTED_FIGURINE, paintedBy: OWNER });
    expect(line.shares).toEqual([share(PRINTER, "print", 10206)]);
    expect(line.company).toEqual(fromBani(44634));
    expect(line.tags).toEqual(["stays-in-company"]);
  });

  it("drybrush by a person who does not get paid still comes out of the profit first", () => {
    const line = calculateOk({ ...PRIMED_BUST, paintedBy: OWNER });
    expect(line.steps.profit).toEqual(fromBani(2590));
    expect(line.shares).toEqual([share(PRINTER, "print", 1554)]);
    expect(line.company).toEqual(fromBani(3036));
    expect(line.tags).toEqual(["min-drybrush", "stays-in-company"]);
  });

  it("nobody paid: everything but the fee and the cost is the company's", () => {
    const line = calculateOk({ ...PAINTED_FIGURINE, printedBy: FARM, paintedBy: OWNER });
    expect(line.shares).toEqual([]);
    expect(line.company).toEqual(fromBani(54840));
  });

  it("an empty choice pays nobody and is not tagged as a company share", () => {
    const line = calculateOk({ ...PAINTED_FIGURINE, printedBy: null, paintedBy: null });
    expect(line.shares).toEqual([]);
    expect(line.company).toEqual(fromBani(54840));
    expect(line.tags).toEqual([]);
  });

  it("a person who is not in the list is paid nothing", () => {
    const line = calculateOk({ ...PRIMED_BUST, printedBy: "gone" });
    expect(line.shares).toEqual([share(PAINTER, "drybrush", 2000)]);
    expect(line.company).toEqual(fromBani(2590));
  });

  it("paint option none: no painter and no drybrush, whoever is in Painted by", () => {
    const line = calculateOk({ ...PLAIN_PRINT, paintedBy: PAINTER });
    expect(line.shares).toEqual([share(PRINTER, "print", 4620)]);
    expect(line.company).toEqual(fromBani(3080));
    expect(line.fee).toEqual(fromBani(300));
    expect(line.steps.drybrush).toEqual(ZERO_AMOUNT);
    expect(line.tags).toEqual([]);
  });
});

describe("calculateLine: blocked lines", () => {
  it("no cost blocks the line, with no shares", () => {
    const line = calculateLine({ ...PRIMED_BUST, costBani: null }, RATES, PEOPLE);
    expect(line).toEqual({ status: "blocked", reason: "no-cost" });
  });

  it("a cost of zero is a cost, not a missing one", () => {
    const line = calculateOk({ ...PLAIN_PRINT, costBani: 0 });
    expect(line.steps.profit).toEqual(fromBani(9700));
  });

  it("a painted line with no primed price is blocked", () => {
    const line = calculateLine({ ...PAINTED_FIGURINE, primedUnitBani: null }, RATES, PEOPLE);
    expect(line).toEqual({ status: "blocked", reason: "no-primed-price" });
  });

  it("a primed or plain line needs no primed price", () => {
    expect(calculateOk({ ...PRIMED_BUST, primedUnitBani: null }).company).toEqual(fromBani(1036));
    expect(calculateOk(PLAIN_PRINT).company).toEqual(fromBani(3080));
  });

  it("a painted line with a list price of 0 is blocked: there is no discount ratio", () => {
    const line = calculateLine({ ...PAINTED_FIGURINE, listBani: 0 }, RATES, PEOPLE);
    expect(line).toEqual({ status: "blocked", reason: "no-list-price" });
  });
});

describe("calculateLine: loss and nothing left", () => {
  it("a cost above the price is a loss the printer shares, tagged", () => {
    const line = calculateOk({ ...PLAIN_PRINT, paidBani: 5000, listBani: 5000, costBani: 6000 });
    expect(line.steps.profit).toEqual(fromBani(-1150));
    expect(line.shares).toEqual([share(PRINTER, "print", -690)]);
    expect(line.company).toEqual(fromBani(-460));
    expect(line.tags).toEqual(["loss"]);
  });

  it("a profit of exactly zero is not a loss", () => {
    const line = calculateOk({ ...PLAIN_PRINT, costBani: 9700 });
    expect(line.steps.profit).toEqual(ZERO_AMOUNT);
    expect(line.tags).toEqual([]);
  });

  it("quantity 0 on a painted line: all zeros, not blocked by its list price of 0", () => {
    const line = calculateOk({
      ...PAINTED_FIGURINE,
      paidBani: 0,
      listBani: 0,
      qty: 0,
      costBani: 0,
    });
    expect(line.shares).toEqual([share(PRINTER, "print", 0), share(PAINTER, "paint", 0)]);
    expect(line.company).toEqual(ZERO_AMOUNT);
    expect(line.fee).toEqual(ZERO_AMOUNT);
    expect(line.tags).toEqual([]);
  });

  it("quantity 0 on a primed line: no minimum drybrush for no pieces", () => {
    const line = calculateOk({ ...PRIMED_BUST, paidBani: 0, listBani: 0, qty: 0, costBani: 0 });
    expect(line.shares).toEqual([share(PRINTER, "print", 0), share(PAINTER, "drybrush", 0)]);
    expect(line.company).toEqual(ZERO_AMOUNT);
    expect(line.tags).toEqual([]);
  });
});

describe("calculateLine: rates", () => {
  it("a fee of 0 and a split of 100% give the printer the whole profit", () => {
    const rates: PayoutRates = { feeBp: 0, splitBp: 10000, drybrushBp: 0, drybrushMinBani: 0 };
    const line = calculateOk(PLAIN_PRINT, rates);
    expect(line.fee).toEqual(ZERO_AMOUNT);
    expect(line.shares).toEqual([share(PRINTER, "print", 8000)]);
    expect(line.company).toEqual(ZERO_AMOUNT);
  });

  it("a fee with decimals stays exact per line (2.5% of 0.33)", () => {
    const rates: PayoutRates = { ...RATES, feeBp: 250 };
    const line = calculateOk({ ...PLAIN_PRINT, paidBani: 33, listBani: 33, costBani: 0 }, rates);
    expect(line.fee).toEqual(fromFraction(33n, 40n));
  });

  it("throws on an amount that is not a whole number of bani", () => {
    expect(() => calculateLine({ ...PLAIN_PRINT, paidBani: 100.5 }, RATES, PEOPLE)).toThrow(
      /whole number of bani/,
    );
  });
});

describe("a LineResult and JSON", () => {
  /** What storage does with a result: every amount written as "n/d". */
  function toStored(line: OkLineResult) {
    return {
      ...line,
      fee: formatAmount(line.fee),
      company: formatAmount(line.company),
      shares: line.shares.map((lineShare) => ({
        ...lineShare,
        amount: formatAmount(lineShare.amount),
      })),
      steps: Object.fromEntries(
        Object.entries(line.steps).map(([name, amount]) => [name, formatAmount(amount)]),
      ),
    };
  }

  it("cannot be stringified as it is: BigInt has no JSON form", () => {
    const line: LineResult = calculateOk(PAINTED_FIGURINE);
    expect(() => JSON.stringify(line)).toThrow(TypeError);
  });

  it("survives JSON once every amount went through formatAmount", () => {
    const line = calculateOk({ ...PAINTED_FIGURINE, paidBani: 20000, listBani: 30000 });
    const stored = toStored(line);
    const read = JSON.parse(JSON.stringify(stored)) as typeof stored;

    expect(read.paidBani).toBe(20000);
    expect(read.status).toBe("ok");
    expect(parseAmount(read.fee)).toEqual(line.fee);
    expect(parseAmount(read.company)).toEqual(line.company);
    expect(read.shares.map((lineShare) => parseAmount(lineShare.amount))).toEqual(
      line.shares.map((lineShare) => lineShare.amount),
    );
    expect(parseAmount(read.steps.printPrice ?? "")).toEqual(line.steps.printPrice);
  });
});
