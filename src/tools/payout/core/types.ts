// The shapes of the payout maths: what goes into a line, what comes out, and the month totals.
// Money that is always whole is a number of bani (`paidBani`); money that can hold a fraction of
// a ban is an ExactAmount.

import type { ExactAmount } from "./exactAmount";

/** The rates in Settings, in basis points (3% is 300). The drybrush minimum is per piece. */
export interface PayoutRates {
  feeBp: number;
  splitBp: number;
  drybrushBp: number;
  drybrushMinBani: number;
}

/** A printer or painter. With `getsPaid` off (an owner, a print farm) their share stays in the company. */
export interface Person {
  id: string;
  getsPaid: boolean;
}

export type PaintOption = "primed" | "partial" | "complete" | "none";

export interface LineInput {
  /** What the customer paid for the line after all discounts, without tax, after partial refunds. */
  paidBani: number;
  /** The price of the line at order time, before discounts, for the quantity left. */
  listBani: number;
  /** The quantity left after refunded units. */
  qty: number;
  paintOption: PaintOption;
  /** The current price of one primed piece of the same product and size. Only a painted line needs it. */
  primedUnitBani: number | null;
  /** The cost of the whole line, or null when neither Shopify nor the cost table has one. */
  costBani: number | null;
  /** A person id. Null is a choice not made yet: nobody is paid for that part. */
  printedBy: string | null;
  paintedBy: string | null;
}

export type SharePart = "print" | "paint" | "drybrush";

/** The pay of one person for one part of one line. */
export interface Share {
  personId: string;
  part: SharePart;
  amount: ExactAmount;
}

/**
 * `cost-from-table` and `not-paid-yet` are facts of the order, set by the line facts.
 * The others are set by the maths.
 */
export type LineTag =
  | "min-drybrush"
  | "cost-from-table"
  | "stays-in-company"
  | "not-paid-yet"
  | "loss"
  | "negative-paint";

export type BlockReason = "no-cost" | "no-primed-price" | "no-list-price";

/** The named values of the "How we got this" fold-out, in the order the maths makes them. */
export interface LineSteps {
  printPrice: ExactAmount;
  printFee: ExactAmount;
  drybrush: ExactAmount;
  profit: ExactAmount;
  printer: ExactAmount;
  companyPrint: ExactAmount;
  paintPrice: ExactAmount;
  paintFee: ExactAmount;
  painter: ExactAmount;
}

/**
 * Where the money of a line went. `fee + costBani + every share + company` is `paidBani`, exactly.
 * A correction is the same shape holding the change to a line of a closed month, so the same
 * identity holds for it.
 */
export interface LineAmounts {
  paidBani: number;
  costBani: number;
  /** The print fee and the paint fee together. */
  fee: ExactAmount;
  shares: Share[];
  /** Everything that is not a fee, the cost or the share of a person who gets paid. */
  company: ExactAmount;
}

export interface OkLineResult extends LineAmounts {
  status: "ok";
  tags: LineTag[];
  steps: LineSteps;
}

/** A line the maths cannot do. It has no amounts and counts in no total. */
export interface BlockedLineResult {
  status: "blocked";
  reason: BlockReason;
}

export type LineResult = OkLineResult | BlockedLineResult;

export interface PersonTotals {
  personId: string;
  print: ExactAmount;
  paint: ExactAmount;
  drybrush: ExactAmount;
  corrections: ExactAmount;
  /** The four parts added exactly, then rounded once. */
  totalBani: number;
}

export interface MonthTotals {
  /** In the order each person first appears in the month. */
  people: PersonTotals[];
  paidBani: number;
  feesBani: number;
  costsBani: number;
  /** What is left of the money paid after the fees, the costs and the rounded total of every person. */
  companyBani: number;
  /** Blocked lines are in none of the totals above. */
  blockedLines: number;
}
