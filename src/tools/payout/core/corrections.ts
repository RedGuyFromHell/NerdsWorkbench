// Corrections: what a refund or a cancellation changes on a line of a month that is already
// closed. Pure. The line is worked out again with the closed month's own settings, people and
// choices, and the correction is that result minus what is already locked. For a line that
// is gone, it is exactly minus the locked amounts.

import { readAmounts, readResult, storeAmounts } from "../storage/amountCodec";
import type { ClosedMonthFile, Correction, MonthLine } from "../storage/monthSchema";
import { add, divide, fromBani, multiply, subtract, ZERO_AMOUNT } from "./exactAmount";
import type { ExactAmount } from "./exactAmount";
import type { MonthEntryStatus } from "./monthList";
import { calculateLine } from "./payoutMath";
import type { LineAmounts, Share } from "./types";

// #region Shapes
/**
 * What a refund can change on a line: the quantity left, the money paid for it and its list price.
 * The cost per piece, the primed price and the paint option stay as they were locked, so a price
 * or a cost edited in the shop after the close never makes a correction.
 */
export interface CurrentLineState {
  qty: number;
  paidBani: number;
  listBani: number;
}

/** A line of a closed month as it is now. `state` is null when the line is gone: refunded in full, or its order cancelled. */
export interface CurrentLine {
  month: string;
  lineId: string;
  state: CurrentLineState | null;
}
// #endregion

// #region Amount arithmetic
const NO_AMOUNTS: LineAmounts = {
  paidBani: 0,
  costBani: 0,
  fee: ZERO_AMOUNT,
  shares: [],
  company: ZERO_AMOUNT,
};

function isZero(amount: ExactAmount): boolean {
  return amount.numerator === 0n;
}

/** `left` and `right` share by share, joined with `join`. A share that comes out as zero is dropped. */
function joinShares(
  left: readonly Share[],
  right: readonly Share[],
  join: (left: ExactAmount, right: ExactAmount) => ExactAmount,
): Share[] {
  const keyOf = (share: Share) => `${share.part}\n${share.personId}`;
  const joined = new Map<string, Share>();
  for (const share of left) {
    const earlier = joined.get(keyOf(share))?.amount ?? ZERO_AMOUNT;
    joined.set(keyOf(share), { ...share, amount: add(earlier, share.amount) });
  }
  for (const share of right) {
    const earlier = joined.get(keyOf(share))?.amount ?? ZERO_AMOUNT;
    joined.set(keyOf(share), { ...share, amount: join(earlier, share.amount) });
  }
  return [...joined.values()].filter((share) => !isZero(share.amount));
}

function addAmounts(left: LineAmounts, right: LineAmounts): LineAmounts {
  return {
    paidBani: left.paidBani + right.paidBani,
    costBani: left.costBani + right.costBani,
    fee: add(left.fee, right.fee),
    shares: joinShares(left.shares, right.shares, add),
    company: add(left.company, right.company),
  };
}

function subtractAmounts(left: LineAmounts, right: LineAmounts): LineAmounts {
  return {
    paidBani: left.paidBani - right.paidBani,
    costBani: left.costBani - right.costBani,
    fee: subtract(left.fee, right.fee),
    shares: joinShares(left.shares, right.shares, subtract),
    company: subtract(left.company, right.company),
  };
}

function isNoChange(amounts: LineAmounts): boolean {
  return (
    amounts.paidBani === 0 &&
    amounts.costBani === 0 &&
    isZero(amounts.fee) &&
    isZero(amounts.company) &&
    amounts.shares.length === 0
  );
}
// #endregion

// #region One line
interface LockedLine {
  closed: ClosedMonthFile;
  line: MonthLine;
  amounts: LineAmounts;
}

function findLockedLine(
  closedMonths: readonly ClosedMonthFile[],
  current: CurrentLine,
): LockedLine {
  const closed = closedMonths.find((candidate) => candidate.month === current.month);
  if (closed === undefined) {
    throw new Error(`A correction needs a closed month, and ${current.month} is not one.`);
  }
  const index = closed.lines.findIndex((line) => line.lineId === current.lineId);
  const line = closed.lines[index];
  const stored = closed.results[index];
  if (line === undefined || stored === undefined) {
    throw new Error(`The closed month ${current.month} has no line ${current.lineId}.`);
  }
  return { closed, line, amounts: readResult(stored.result) };
}

/** What is locked for the line by now: its own result, plus every correction already locked for it. */
function sumEffective(locked: LockedLine, closedMonths: readonly ClosedMonthFile[]): LineAmounts {
  let effective = locked.amounts;
  for (const closed of closedMonths) {
    for (const correction of closed.corrections) {
      const isForLine =
        correction.sourceMonth === locked.closed.month && correction.lineId === locked.line.lineId;
      if (isForLine) effective = addAmounts(effective, readAmounts(correction.amounts));
    }
  }
  return effective;
}

/** The locked cost is for the locked quantity; the same cost per piece for the quantity left. */
function scaleCost(line: MonthLine, qty: number): number | null {
  const { costBani } = line.facts;
  if (costBani === null) return null;
  const scaled = divide(multiply(fromBani(costBani), fromBani(qty)), fromBani(line.facts.qty));
  if (scaled.denominator !== 1n) {
    throw new Error(`The cost of line ${line.lineId} does not divide by its quantity.`);
  }
  return Number(scaled.numerator);
}

/** The line as it should be paid now, worked out with what the closed month froze. */
function recalculate(locked: LockedLine, state: CurrentLineState | null): LineAmounts {
  if (state === null) return NO_AMOUNTS;
  const { closed, line } = locked;
  if (!Number.isSafeInteger(state.qty) || state.qty <= 0) {
    throw new Error(`Line ${line.lineId}: a line with no pieces left is gone, pass no state.`);
  }
  const result = calculateLine(
    {
      ...line.facts,
      qty: state.qty,
      paidBani: state.paidBani,
      listBani: state.listBani,
      costBani: scaleCost(line, state.qty),
      printedBy: line.printedBy,
      paintedBy: line.paintedBy,
    },
    closed.settings.rates,
    closed.people,
  );
  if (result.status === "blocked") {
    throw new Error(
      `Line ${line.lineId} of ${line.orderName} cannot be worked out again (${result.reason}).`,
    );
  }
  return result;
}
// #endregion

/**
 * The corrections the lines in `currentLines` need, one per changed line. A line that is as it
 * was locked, or whose change is already locked in a later closed month, gives none, so the same
 * call twice gives the same list. The caller replaces the open month's corrections with it.
 * Throws for a month that is not closed or a line the month does not hold.
 */
export function planCorrections(
  closedMonths: readonly ClosedMonthFile[],
  currentLines: readonly CurrentLine[],
): Correction[] {
  const corrections: Correction[] = [];
  for (const current of currentLines) {
    const locked = findLockedLine(closedMonths, current);
    const change = subtractAmounts(
      recalculate(locked, current.state),
      sumEffective(locked, closedMonths),
    );
    if (isNoChange(change)) continue;
    corrections.push({
      sourceMonth: current.month,
      lineId: current.lineId,
      orderName: locked.line.orderName,
      productTitle: locked.line.productTitle,
      variantTitle: locked.line.variantTitle,
      reason: current.state === null ? "removed" : "reduced",
      amounts: storeAmounts(change),
    });
  }
  return corrections;
}

/** The month that takes the corrections: the oldest one not closed, the next to close. Null when every month is closed. */
export function findCorrectionsMonth(
  months: readonly { month: string; status: MonthEntryStatus }[],
): string | null {
  const open = months.filter((entry) => entry.status !== "closed").map((entry) => entry.month);
  return open.sort()[0] ?? null;
}
