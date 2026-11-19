// The payout maths of one order line: the money paid becomes the fee, the cost, the share of the
// printer, the pay of the painter or the drybrusher, and the part of the company. Every amount
// stays exact here; the only rounding is in the month totals.

import {
  add,
  compare,
  divide,
  fromBani,
  fromFraction,
  maxOf,
  multiply,
  subtract,
  ZERO_AMOUNT,
} from "./exactAmount";
import type { ExactAmount } from "./exactAmount";
import type {
  BlockReason,
  LineInput,
  LineResult,
  LineSteps,
  LineTag,
  PaintOption,
  PayoutRates,
  Person,
  Share,
  SharePart,
} from "./types";

const BASIS_POINTS_PER_WHOLE = 10000n;

type PrintPriceSplit = { blocked: BlockReason } | { blocked: null; printPrice: ExactAmount };

interface DrybrushPay {
  amount: ExactAmount;
  /** True when the minimum per piece was paid because the percent was below it. */
  isMinimum: boolean;
}

/** Who keeps a part of a line: a person who gets paid, the company, or nobody chosen yet. */
type ShareHolder = { kind: "person"; personId: string } | { kind: "company" } | { kind: "nobody" };

/** The pay of one part of a line, before it is known whether its person gets paid. */
interface PartPay {
  part: SharePart;
  personId: string | null;
  amount: ExactAmount;
}

function takeBasisPoints(amount: ExactAmount, basisPoints: number): ExactAmount {
  return multiply(amount, fromFraction(BigInt(basisPoints), BASIS_POINTS_PER_WHOLE));
}

function isPainted(paintOption: PaintOption): boolean {
  return paintOption === "partial" || paintOption === "complete";
}

/**
 * The print part of the money paid. A painted line holds a primed piece and a paint job: its
 * print part is the primed price scaled by the discount ratio of the line (paid / list).
 * Any other line is all print.
 */
export function splitPrintPrice(input: LineInput): PrintPriceSplit {
  const paid = fromBani(input.paidBani);
  if (!isPainted(input.paintOption)) return { blocked: null, printPrice: paid };
  // No pieces left (all refunded): no print part, and no ratio to divide by.
  if (input.qty === 0) return { blocked: null, printPrice: ZERO_AMOUNT };
  if (input.primedUnitBani === null) return { blocked: "no-primed-price" };
  if (input.listBani === 0) return { blocked: "no-list-price" };

  const primedPrice = fromBani(input.primedUnitBani * input.qty);
  const discountRatio = divide(paid, fromBani(input.listBani));
  return { blocked: null, printPrice: multiply(primedPrice, discountRatio) };
}

/** Drybrush pay of a primed line: a percent of the print price, with a minimum per piece. */
export function drybrushPay(
  printPrice: ExactAmount,
  input: LineInput,
  rates: PayoutRates,
): DrybrushPay {
  if (input.paintOption !== "primed") return { amount: ZERO_AMOUNT, isMinimum: false };
  const percentPay = takeBasisPoints(printPrice, rates.drybrushBp);
  const minimumPay = fromBani(rates.drybrushMinBani * input.qty);
  return {
    amount: maxOf(percentPay, minimumPay),
    isMinimum: compare(minimumPay, percentPay) > 0,
  };
}

/**
 * Who keeps the pay of a part. A person with Gets paid off (an owner, a print farm) leaves it in
 * the company. An empty choice, or a person no longer in the list, pays nobody.
 */
export function assignShare(personId: string | null, people: readonly Person[]): ShareHolder {
  const person = people.find((candidate) => candidate.id === personId);
  if (person === undefined) return { kind: "nobody" };
  return person.getsPaid ? { kind: "person", personId: person.id } : { kind: "company" };
}

function listPartPays(input: LineInput, steps: LineSteps): PartPay[] {
  const partPays: PartPay[] = [{ part: "print", personId: input.printedBy, amount: steps.printer }];
  if (isPainted(input.paintOption)) {
    partPays.push({ part: "paint", personId: input.paintedBy, amount: steps.painter });
  }
  if (input.paintOption === "primed") {
    partPays.push({ part: "drybrush", personId: input.paintedBy, amount: steps.drybrush });
  }
  return partPays;
}

function calculateSteps(
  input: LineInput & { costBani: number },
  printPrice: ExactAmount,
  rates: PayoutRates,
): { steps: LineSteps; isMinimumDrybrush: boolean } {
  const printFee = takeBasisPoints(printPrice, rates.feeBp);
  const drybrush = drybrushPay(printPrice, input, rates);
  const profit = subtract(
    subtract(subtract(printPrice, printFee), fromBani(input.costBani)),
    drybrush.amount,
  );
  const printer = takeBasisPoints(profit, rates.splitBp);
  const paintPrice = isPainted(input.paintOption)
    ? subtract(fromBani(input.paidBani), printPrice)
    : ZERO_AMOUNT;
  const paintFee = takeBasisPoints(paintPrice, rates.feeBp);
  return {
    steps: {
      printPrice,
      printFee,
      drybrush: drybrush.amount,
      profit,
      printer,
      companyPrint: subtract(profit, printer),
      paintPrice,
      paintFee,
      painter: subtract(paintPrice, paintFee),
    },
    isMinimumDrybrush: drybrush.isMinimum,
  };
}

/**
 * The amounts of one line. A line with no cost, or a painted line with no primed price or no
 * list price, is blocked and has none. A share whose person does not get paid is added to the
 * company, so the fees, the cost, the shares and the company are always exactly the money paid.
 */
export function calculateLine(
  input: LineInput,
  rates: PayoutRates,
  people: readonly Person[],
): LineResult {
  const { costBani } = input;
  if (costBani === null) return { status: "blocked", reason: "no-cost" };
  const split = splitPrintPrice(input);
  if (split.blocked !== null) return { status: "blocked", reason: split.blocked };

  const { steps, isMinimumDrybrush } = calculateSteps(
    { ...input, costBani },
    split.printPrice,
    rates,
  );

  const shares: Share[] = [];
  let company = steps.companyPrint;
  let staysInCompany = false;
  for (const partPay of listPartPays(input, steps)) {
    const holder = assignShare(partPay.personId, people);
    if (holder.kind === "person") {
      shares.push({ personId: holder.personId, part: partPay.part, amount: partPay.amount });
      continue;
    }
    company = add(company, partPay.amount);
    if (holder.kind === "company") staysInCompany = true;
  }

  const tags: LineTag[] = [];
  if (isMinimumDrybrush) tags.push("min-drybrush");
  if (staysInCompany) tags.push("stays-in-company");
  if (compare(steps.profit, ZERO_AMOUNT) < 0) tags.push("loss");
  if (compare(steps.paintPrice, ZERO_AMOUNT) < 0) tags.push("negative-paint");

  return {
    status: "ok",
    paidBani: input.paidBani,
    costBani,
    fee: add(steps.printFee, steps.paintFee),
    shares,
    company,
    tags,
    steps,
  };
}
