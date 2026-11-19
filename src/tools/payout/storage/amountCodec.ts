// Between the amounts of the maths (ExactAmount, on BigInt) and their stored form ("n/d" text).
// A closed month and a correction cross this line once each way; nothing is rounded on the way.
import { formatAmount, parseAmount } from "../core/exactAmount";
import type { LineAmounts, MonthTotals, OkLineResult } from "../core/types";
import type { StoredAmounts, StoredResult, StoredTotals } from "./monthSchema";

// #region Line amounts
export function storeAmounts(amounts: LineAmounts): StoredAmounts {
  return {
    paidBani: amounts.paidBani,
    costBani: amounts.costBani,
    fee: formatAmount(amounts.fee),
    shares: amounts.shares.map((share) => ({ ...share, amount: formatAmount(share.amount) })),
    company: formatAmount(amounts.company),
  };
}

export function readAmounts(stored: StoredAmounts): LineAmounts {
  return {
    paidBani: stored.paidBani,
    costBani: stored.costBani,
    fee: parseAmount(stored.fee),
    shares: stored.shares.map((share) => ({ ...share, amount: parseAmount(share.amount) })),
    company: parseAmount(stored.company),
  };
}
// #endregion

// #region Line results
export function storeResult(result: OkLineResult): StoredResult {
  const { steps } = result;
  return {
    ...storeAmounts(result),
    tags: [...result.tags],
    steps: {
      printPrice: formatAmount(steps.printPrice),
      printFee: formatAmount(steps.printFee),
      drybrush: formatAmount(steps.drybrush),
      profit: formatAmount(steps.profit),
      printer: formatAmount(steps.printer),
      companyPrint: formatAmount(steps.companyPrint),
      paintPrice: formatAmount(steps.paintPrice),
      paintFee: formatAmount(steps.paintFee),
      painter: formatAmount(steps.painter),
    },
  };
}

export function readResult(stored: StoredResult): OkLineResult {
  const { steps } = stored;
  return {
    status: "ok",
    ...readAmounts(stored),
    tags: [...stored.tags],
    steps: {
      printPrice: parseAmount(steps.printPrice),
      printFee: parseAmount(steps.printFee),
      drybrush: parseAmount(steps.drybrush),
      profit: parseAmount(steps.profit),
      printer: parseAmount(steps.printer),
      companyPrint: parseAmount(steps.companyPrint),
      paintPrice: parseAmount(steps.paintPrice),
      paintFee: parseAmount(steps.paintFee),
      painter: parseAmount(steps.painter),
    },
  };
}
// #endregion

// #region Month totals
export function storeTotals(totals: MonthTotals): StoredTotals {
  return {
    people: totals.people.map((person) => ({
      personId: person.personId,
      print: formatAmount(person.print),
      paint: formatAmount(person.paint),
      drybrush: formatAmount(person.drybrush),
      corrections: formatAmount(person.corrections),
      totalBani: person.totalBani,
    })),
    paidBani: totals.paidBani,
    feesBani: totals.feesBani,
    costsBani: totals.costsBani,
    companyBani: totals.companyBani,
  };
}

/** A closed month has no blocked line, so the count is 0. */
export function readTotals(stored: StoredTotals): MonthTotals {
  return {
    people: stored.people.map((person) => ({
      personId: person.personId,
      print: parseAmount(person.print),
      paint: parseAmount(person.paint),
      drybrush: parseAmount(person.drybrush),
      corrections: parseAmount(person.corrections),
      totalBani: person.totalBani,
    })),
    paidBani: stored.paidBani,
    feesBani: stored.feesBani,
    costsBani: stored.costsBani,
    companyBani: stored.companyBani,
    blockedLines: 0,
  };
}
// #endregion
