// The statement of one person for one closed month: what they are owed, the parts, the lines
// behind it and a paragraph that says how it was worked out. Pure: the PDF and the CSV both
// draw this, and it reads a closed month only, never the live Settings.
//
// Money here is whole bani. The total is the one the month locked (the exact parts added, then
// rounded once). Every part and line is rounded for display, so each list ends with a "Rounding"
// row when its rounded rows miss the total by a ban: the lists then add up to the total exactly.
import { readAmounts, readResult, readTotals } from "../storage/amountCodec";
import type { ClosedMonthFile, Correction } from "../storage/monthSchema";
import { ZERO_AMOUNT, add, roundToBani } from "./exactAmount";
import { formatLei } from "./formatLei";
import { UNKNOWN_PERSON, formatMonthTitle, formatMoment } from "./monthView";
import { basisPointsToPercent } from "./percent";
import type { PayoutRates, PersonTotals, SharePart } from "./types";

// #region Shapes
export interface StatementPart {
  label: string;
  bani: number;
}

export interface StatementLine {
  order: string;
  item: string;
  /** Null for a correction and for the rounding row: they have no quantity of their own. */
  qty: number | null;
  work: string;
  bani: number;
}

export interface Statement {
  id: string;
  month: string;
  monthTitle: string;
  personId: string;
  personName: string;
  /** When the month was closed, as the month screen writes it: "3 Feb 2031, 09:00". */
  closedText: string;
  totalBani: number;
  parts: StatementPart[];
  lines: StatementLine[];
  rules: string;
  /** "yyyy-mm-dd", or null while no paid mark is set. */
  paidOn: string | null;
}
// #endregion

const ID_PREFIX = "PAY";
const ID_PERSON_LENGTH = 6;
const NOT_A_LETTER_OR_DIGIT = /[^A-Za-z0-9]/g;
const ITEM_SEPARATOR = " · ";
const ROUNDING = "Rounding";

/** "PAY-2031-01-3F9A1C": the same on every export of the same person and month. */
export function statementId(month: string, personId: string): string {
  const code = personId.replace(NOT_A_LETTER_OR_DIGIT, "").slice(0, ID_PERSON_LENGTH);
  return `${ID_PREFIX}-${month}-${code.toUpperCase()}`;
}

// #region Rules
function describeRules(rates: PayoutRates): string {
  const fee = basisPointsToPercent(rates.feeBp);
  const split = basisPointsToPercent(rates.splitBp);
  const drybrush = basisPointsToPercent(rates.drybrushBp);
  const minimum = formatLei(rates.drybrushMinBani);
  return [
    "How it is worked out.",
    `The price paid after discounts, minus a ${fee}% payment fee, minus the material and print cost, is the profit.`,
    `The person who printed a piece gets ${split}% of that profit.`,
    "Painting is the painted price minus the primed price of the same piece, minus the fee.",
    `Drybrush is ${drybrush}% of the price, at least ${minimum} lei per piece.`,
    "A refund that comes after a month is closed is taken off the next month.",
    "Amounts are in lei, without tax. The total is added exactly and rounded once, so single lines can differ from it by a few bani.",
  ].join(" ");
}
// #endregion

// #region Lines
const WORK_TEXT: Record<SharePart, string> = {
  print: "Print",
  paint: "Paint",
  drybrush: "Drybrush",
};

const CORRECTION_TEXT: Record<Correction["reason"], string> = {
  removed: "refunded in full or cancelled since",
  reduced: "partly refunded since",
};

function joinTitles(...titles: string[]): string {
  return titles.filter((title) => title !== "").join(ITEM_SEPARATOR);
}

function listLineRows(closed: ClosedMonthFile, personId: string): StatementLine[] {
  const dated = closed.lines.flatMap((line, index) => {
    const stored = closed.results[index];
    if (stored?.lineId !== line.lineId) {
      throw new Error(`The closed month ${closed.month} has no result for line ${line.lineId}.`);
    }
    const result = readResult(stored.result);
    const isMinimum = result.tags.includes("min-drybrush");
    const rows = result.shares
      .filter((share) => share.personId === personId && share.amount.numerator !== 0n)
      .map((share): StatementLine => ({
        order: line.orderName,
        item: joinTitles(line.productTitle, line.variantTitle),
        qty: line.facts.qty,
        work:
          share.part === "drybrush" && isMinimum
            ? `${WORK_TEXT.drybrush} (min.)`
            : WORK_TEXT[share.part],
        bani: roundToBani(share.amount),
      }));
    return rows.map((row) => ({ row, at: new Date(line.orderCreatedAt).getTime() }));
  });
  // WHY: the same order the month screen draws: by order date, then order name; the shares of
  // one line stay in the order the maths made them.
  dated.sort((left, right) => left.at - right.at || left.row.order.localeCompare(right.row.order));
  return dated.map((entry) => entry.row);
}

function listCorrectionRows(closed: ClosedMonthFile, personId: string): StatementLine[] {
  return closed.corrections.flatMap((correction): StatementLine[] => {
    const shares = readAmounts(correction.amounts).shares.filter(
      (share) => share.personId === personId,
    );
    const amount = shares.reduce((total, share) => add(total, share.amount), ZERO_AMOUNT);
    if (amount.numerator === 0n) return [];
    const title = joinTitles(correction.productTitle, correction.variantTitle);
    const when = formatMonthTitle(correction.sourceMonth);
    return [
      {
        order: correction.orderName,
        item: `${title} (paid in ${when}, ${CORRECTION_TEXT[correction.reason]})`,
        qty: null,
        work: "Correction",
        bani: roundToBani(amount),
      },
    ];
  });
}
// #endregion

// #region Parts
function sumBani(items: readonly { bani: number }[]): number {
  return items.reduce((total, item) => total + item.bani, 0);
}

function withRounding<T extends { bani: number }>(
  items: T[],
  totalBani: number,
  roundingRow: (bani: number) => T,
): T[] {
  const missing = totalBani - sumBani(items);
  return missing === 0 ? items : [...items, roundingRow(missing)];
}

function listParts(totals: PersonTotals, rates: PayoutRates): StatementPart[] {
  const split = basisPointsToPercent(rates.splitBp);
  const parts: StatementPart[] = [
    { label: `Print profit share (${split}%)`, bani: roundToBani(totals.print) },
    { label: "Painting", bani: roundToBani(totals.paint) },
    { label: "Drybrush", bani: roundToBani(totals.drybrush) },
    { label: "Corrections from earlier months", bani: roundToBani(totals.corrections) },
  ];
  return withRounding(parts, totals.totalBani, (bani) => ({ label: ROUNDING, bani }));
}
// #endregion

/**
 * The statement of one person for a closed month. `paidOn` is the day of their paid mark, or null.
 * Throws when the person has no part in the month: there is nothing to write.
 */
export function buildStatement(
  closed: ClosedMonthFile,
  personId: string,
  paidOn: string | null,
): Statement {
  const totals = readTotals(closed.totals).people.find((entry) => entry.personId === personId);
  if (totals === undefined) {
    throw new Error(`${personId} has no part in ${closed.month}, so there is no statement.`);
  }
  const rows = [...listLineRows(closed, personId), ...listCorrectionRows(closed, personId)];
  const lines = withRounding(rows, totals.totalBani, (bani) => ({
    order: "",
    item: ROUNDING,
    qty: null,
    work: ROUNDING,
    bani,
  }));
  return {
    id: statementId(closed.month, personId),
    month: closed.month,
    monthTitle: formatMonthTitle(closed.month),
    personId,
    personName: closed.people.find((person) => person.id === personId)?.name ?? UNKNOWN_PERSON,
    closedText: formatMoment(closed.closedAt, closed.timeZone),
    totalBani: totals.totalBani,
    parts: listParts(totals, closed.settings.rates),
    lines,
    rules: describeRules(closed.settings.rates),
    paidOn,
  };
}
