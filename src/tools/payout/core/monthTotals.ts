// The totals of a month: what each person is owed, the fees, the costs and what is left for the
// company. This is the only place the payout maths rounds.

import { add, fromBani, roundToBani, ZERO_AMOUNT } from "./exactAmount";
import type { ExactAmount } from "./exactAmount";
import type { LineAmounts, LineResult, MonthTotals, OkLineResult, PersonTotals } from "./types";

/** The exact sums of one person, before the rounding. */
type PersonSums = Record<"print" | "paint" | "drybrush" | "corrections", ExactAmount>;

function isOkLine(line: LineResult): line is OkLineResult {
  return line.status === "ok";
}

function addToPerson(
  sumsByPerson: Map<string, PersonSums>,
  personId: string,
  column: keyof PersonSums,
  amount: ExactAmount,
): void {
  const sums = sumsByPerson.get(personId) ?? {
    print: ZERO_AMOUNT,
    paint: ZERO_AMOUNT,
    drybrush: ZERO_AMOUNT,
    corrections: ZERO_AMOUNT,
  };
  sumsByPerson.set(personId, { ...sums, [column]: add(sums[column], amount) });
}

function toPersonTotals(personId: string, sums: PersonSums): PersonTotals {
  const exactTotal = add(add(sums.print, sums.paint), add(sums.drybrush, sums.corrections));
  return { personId, ...sums, totalBani: roundToBani(exactTotal) };
}

/**
 * Sums the lines of a month and the corrections it carries. A correction is the change to a line
 * of a closed month (the line recalculated, minus what was locked); the shares in it count under
 * "corrections". Blocked lines are left out and counted.
 *
 * Each person total is the exact sum of the shares, rounded once to bani, half away from zero.
 * The fees are rounded once for the month. The company total is what is left, so the people, the
 * company, the fees and the costs are exactly the money paid.
 */
export function sumMonth(
  results: readonly LineResult[],
  corrections: readonly LineAmounts[],
): MonthTotals {
  const okLines = results.filter(isOkLine);
  const sumsByPerson = new Map<string, PersonSums>();
  for (const line of okLines) {
    for (const share of line.shares) {
      addToPerson(sumsByPerson, share.personId, share.part, share.amount);
    }
  }
  for (const correction of corrections) {
    for (const share of correction.shares) {
      addToPerson(sumsByPerson, share.personId, "corrections", share.amount);
    }
  }

  const everyAmounts: LineAmounts[] = [...okLines, ...corrections];
  // WHY: the whole amounts are summed as exact amounts too: fromBani refuses a float, so a bad
  // amount fails here and never drifts into a total.
  let exactPaid = ZERO_AMOUNT;
  let exactCosts = ZERO_AMOUNT;
  let exactFees = ZERO_AMOUNT;
  for (const amounts of everyAmounts) {
    exactPaid = add(exactPaid, fromBani(amounts.paidBani));
    exactCosts = add(exactCosts, fromBani(amounts.costBani));
    exactFees = add(exactFees, amounts.fee);
  }

  const people = [...sumsByPerson].map(([personId, sums]) => toPersonTotals(personId, sums));
  const paidBani = roundToBani(exactPaid);
  const costsBani = roundToBani(exactCosts);
  const feesBani = roundToBani(exactFees);
  const peopleBani = people.reduce((sum, person) => sum + person.totalBani, 0);
  return {
    people,
    paidBani,
    feesBani,
    costsBani,
    companyBani: paidBani - costsBani - feesBani - peopleBani,
    blockedLines: results.length - okLines.length,
  };
}
