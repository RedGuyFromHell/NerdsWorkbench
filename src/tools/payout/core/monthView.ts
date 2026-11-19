// The month as the screen shows it: orders in date order, a row per line with its money already
// formatted, the tags, the steps of the maths, the totals and the notices. Pure: the component
// only draws what this returns. Amounts of a line are rounded for display here; the totals are the
// exact sums of sumMonth, rounded once.

import { readAmounts, readResult, readTotals } from "../storage/amountCodec";
import type { ClosedMonthFile, Correction, MonthFile, MonthLine } from "../storage/monthSchema";
import { NO_PERSON, listMissingChoices, menuOptions } from "./choices";
import type { ChoicePart, MenuOption } from "./choices";
import type { PayoutSettings, StoredPeople } from "../storage/schemas";
import { fromBani, fromFraction, multiply, roundToBani, add, ZERO_AMOUNT } from "./exactAmount";
import type { ExactAmount } from "./exactAmount";
import { formatLei } from "./formatLei";
import { sumMonth } from "./monthTotals";
import { calculateLine } from "./payoutMath";
import { basisPointsToPercent } from "./percent";
import type {
  BlockReason,
  BlockedLineResult,
  LineAmounts,
  LineResult,
  LineTag,
  MonthTotals,
  OkLineResult,
  PayoutRates,
} from "./types";

// #region Shapes
export type TagTone = "plain" | "warn" | "good" | "danger";
/** The cell a tag is drawn in: next to the product, or under a person menu. */
export type TagPlace = "product" | "printed" | "painted";

export interface TagView {
  id: string;
  label: string;
  /** What the tag means, in a sentence. */
  title: string;
  tone: TagTone;
  place: TagPlace;
}

export interface StepView {
  label: string;
  value: string;
}

export interface OwedView {
  personId: string;
  name: string;
  amount: string;
}

export interface LineRowView {
  lineId: string;
  productTitle: string;
  variantTitle: string;
  qty: number;
  paid: string;
  /** "?" while the line is blocked: the maths cannot give it. */
  fee: string;
  cost: string;
  company: string;
  status: "ok" | "blocked";
  /** Why the line is blocked, or null. */
  blockedText: string | null;
  /** False for a line with no paint option: there is no painter to choose. */
  hasPaintPart: boolean;
  /** Null when the choice is not made yet; "Unknown person" for a person removed from Settings. */
  printedByName: string | null;
  paintedByName: string | null;
  /** The menus: the chosen person's id ("" for nobody; a removed person is nobody) and the options. */
  printedValue: string;
  paintedValue: string;
  printedOptions: MenuOption[];
  paintedOptions: MenuOption[];
  /** The menus that are empty and need a choice. They keep the month from closing. */
  missingChoices: ChoicePart[];
  owed: OwedView[];
  tags: TagView[];
  steps: StepView[];
}

export interface OrderView {
  orderId: string;
  name: string;
  dateText: string;
  notPaidYet: boolean;
  warning: string | null;
  lines: LineRowView[];
}

export interface PersonTotalView {
  personId: string;
  name: string;
  print: string;
  paint: string;
  drybrush: string;
  corrections: string;
  total: string;
}

/** A correction as the corrections box shows it: what changed, and what it takes from whom. */
export interface CorrectionView {
  id: string;
  /** "#1002 · Stone Golem · Large". */
  title: string;
  /** "Paid in January 2031, refunded in full or cancelled since." */
  text: string;
  people: OwedView[];
  company: string;
}

export interface MonthView {
  month: string;
  title: string;
  status: MonthFile["status"];
  loadedText: string;
  /** "3 Feb 2031, 09:00" for a closed month, else null. */
  closedText: string | null;
  lineCount: number;
  orderCount: number;
  orders: OrderView[];
  people: PersonTotalView[];
  paid: string;
  company: string;
  fees: string;
  costs: string;
  corrections: CorrectionView[];
  /** What the corrections change for the company; null when the month has none. */
  companyCorrections: string | null;
  blockedLines: number;
  /** Lines with a menu still empty: they block Close like a blocked line. */
  needsChoiceLines: number;
  /** What the user must look at, one sentence each. */
  notices: string[];
  statusText: string;
}
interface LineContext {
  rates: PayoutRates;
  people: StoredPeople["people"];
}

/** A line of the file with its result, worked out once for the rows and the totals. */
interface CalculatedLine {
  line: MonthLine;
  result: LineResult;
}
// #endregion

// #region Dates
/** Cut with formatToParts, so the words do not change with the ICU data ("Sept" against "Sep"). */
function pickParts(
  instant: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, ...options }).formatToParts(instant);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function formatMonth(month: string, monthStyle: "long" | "short"): string {
  const parts = pickParts(new Date(`${month}-01T12:00:00Z`), "UTC", {
    month: monthStyle,
    year: "numeric",
  });
  return `${parts.month} ${parts.year}`;
}

/** "2031-03" gives "March 2031". */
export function formatMonthTitle(month: string): string {
  return formatMonth(month, "long");
}

/** "2031-03" gives "Mar 2031", for the months list. */
export function formatMonthShort(month: string): string {
  return formatMonth(month, "short");
}

function formatDay(createdAt: string, timeZone: string): string {
  const parts = pickParts(new Date(createdAt), timeZone, { day: "numeric", month: "short" });
  return `${parts.day} ${parts.month}`;
}

export function formatMoment(moment: string, timeZone: string): string {
  const instant = new Date(moment);
  const day = pickParts(instant, timeZone, { day: "numeric", month: "short", year: "numeric" });
  const time = pickParts(instant, timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${day.day} ${day.month} ${day.year}, ${time.hour}:${time.minute}`;
}
// #endregion

// #region Money
const BASIS_POINTS_PER_WHOLE = 10000n;
const UNKNOWN_AMOUNT = "?";
export const UNKNOWN_PERSON = "Unknown person";

function formatExact(amount: ExactAmount): string {
  return formatLei(roundToBani(amount));
}
// #endregion

// #region Tags
type ShownTagId = Exclude<LineTag, "not-paid-yet"> | BlockReason | "needs-choice";

/** Each tag's words and place, in the order the tags are drawn. */
const TAG_TEXT: Record<ShownTagId, Omit<TagView, "id">> = {
  "no-cost": {
    label: "no cost",
    title: "Shopify has no Cost per item for this line and the cost table has no row for it",
    tone: "danger",
    place: "product",
  },
  "no-primed-price": {
    label: "no primed price",
    title:
      "The product has no Primed & Drybrushed variant at this size, so the print part cannot be split off",
    tone: "danger",
    place: "product",
  },
  "no-list-price": {
    label: "no list price",
    title: "The price of the line at order time is 0, so the discount ratio cannot be worked out",
    tone: "danger",
    place: "product",
  },
  "needs-choice": {
    label: "needs a choice",
    title: "Pick a person in the menu. The month cannot close while a menu is empty",
    tone: "danger",
    place: "product",
  },
  loss: {
    label: "loss",
    title: "The line costs more than it earns",
    tone: "danger",
    place: "product",
  },
  "negative-paint": {
    label: "negative paint part",
    title: "The primed price is above what was paid for the line, so the paint part is negative",
    tone: "danger",
    place: "product",
  },
  "min-drybrush": {
    label: "drybrush: minimum",
    title: "",
    tone: "good",
    place: "painted",
  },
  "cost-from-table": {
    label: "cost from table",
    title: "Shopify has no Cost per item for this line; the cost table in Settings gave it",
    tone: "warn",
    place: "product",
  },
  "stays-in-company": {
    label: "stays in company",
    title: "A person who does not get paid is chosen, so their part stays in the company",
    tone: "good",
    place: "painted",
  },
};

const PLACE_OF_PART: Record<ChoicePart, TagPlace> = { printedBy: "printed", paintedBy: "painted" };

const TAG_ORDER = Object.keys(TAG_TEXT) as ShownTagId[];

function isShownTag<T extends LineTag>(tag: T): tag is Exclude<T, "not-paid-yet"> {
  // WHY: "not paid yet" is a fact of the whole order, so it is drawn on the order, not on each line.
  return tag !== "not-paid-yet";
}

function describeDrybrushMinimum(result: OkLineResult, rates: PayoutRates, qty: number): string {
  const percentAmount = multiply(
    result.steps.printPrice,
    fromFraction(BigInt(rates.drybrushBp), BASIS_POINTS_PER_WHOLE),
  );
  const minimum = fromBani(rates.drybrushMinBani * qty);
  const percentText = basisPointsToPercent(rates.drybrushBp);
  return `${percentText}% would be ${formatExact(percentAmount)}; the minimum is ${formatExact(minimum)}`;
}

function findTagIds(
  line: MonthLine,
  result: LineResult,
  missing: readonly ChoicePart[],
): Set<ShownTagId> {
  const found = new Set<ShownTagId>(line.tags.filter(isShownTag));
  if (missing.length > 0) found.add("needs-choice");
  if (result.status === "blocked") return found.add(result.reason);
  for (const tag of result.tags.filter(isShownTag)) found.add(tag);
  return found;
}

/** The cells whose person is chosen but does not get paid: their part of the line stays in the company. */
function listStayingPlaces(
  line: MonthLine,
  people: StoredPeople["people"],
  hasPaintPart: boolean,
): TagPlace[] {
  const staysWith = (personId: string | null) =>
    people.some((person) => person.id === personId && !person.getsPaid);
  const places: TagPlace[] = [];
  if (staysWith(line.printedBy)) places.push("printed");
  if (hasPaintPart && staysWith(line.paintedBy)) places.push("painted");
  return places;
}

function listTags(
  line: MonthLine,
  result: LineResult,
  context: LineContext,
  hasPaintPart: boolean,
  missing: readonly ChoicePart[],
): TagView[] {
  const found = findTagIds(line, result, missing);
  return TAG_ORDER.filter((id) => found.has(id)).flatMap((id): TagView[] => {
    const text = TAG_TEXT[id];
    if (id === "min-drybrush" && result.status === "ok") {
      const title = describeDrybrushMinimum(result, context.rates, line.facts.qty);
      return [{ id, ...text, title }];
    }
    if (id === "needs-choice") {
      // WHY: like every person tag, it sits under the empty menu it is about.
      return missing.map((part) => ({ id, ...text, place: PLACE_OF_PART[part] }));
    }
    if (id === "stays-in-company") {
      return listStayingPlaces(line, context.people, hasPaintPart).map((place) => ({
        id,
        ...text,
        place,
      }));
    }
    return [{ id, ...text }];
  });
}
// #endregion

// #region Lines
function describeSteps(result: OkLineResult): StepView[] {
  const { steps } = result;
  const shown = (label: string, amount: ExactAmount): StepView => ({
    label,
    value: formatExact(amount),
  });
  const printSteps = [
    shown("Print part", steps.printPrice),
    shown("Fee on the print part", steps.printFee),
    { label: "Cost", value: formatLei(result.costBani) },
  ];
  const hasDrybrush = steps.drybrush.numerator !== 0n;
  if (hasDrybrush) printSteps.push(shown("Drybrush", steps.drybrush));
  printSteps.push(
    shown("Profit", steps.profit),
    shown("Printer share", steps.printer),
    shown("Company part of the print", steps.companyPrint),
  );
  const hasPaintSteps = steps.paintPrice.numerator !== 0n;
  if (!hasPaintSteps) return printSteps;
  return [
    ...printSteps,
    shown("Paint part", steps.paintPrice),
    shown("Fee on the paint part", steps.paintFee),
    shown("Painter", steps.painter),
  ];
}

function listOwed(result: OkLineResult, people: StoredPeople["people"]): OwedView[] {
  const owed: OwedView[] = [];
  for (const person of people) {
    const shares = result.shares.filter((share) => share.personId === person.id);
    if (shares.length === 0) continue;
    const sum = shares.reduce((total, share) => add(total, share.amount), ZERO_AMOUNT);
    owed.push({ personId: person.id, name: person.name, amount: formatExact(sum) });
  }
  return owed;
}

function nameOfChoice(personId: string | null, people: StoredPeople["people"]): string | null {
  if (personId === null) return null;
  return people.find((person) => person.id === personId)?.name ?? UNKNOWN_PERSON;
}

/** The id a menu shows as chosen: a person removed from Settings is no choice. */
function valueOfChoice(personId: string | null, people: StoredPeople["people"]): string {
  return people.some((person) => person.id === personId) ? (personId ?? NO_PERSON) : NO_PERSON;
}

function buildLineRow({ line, result }: CalculatedLine, context: LineContext): LineRowView {
  const { people } = context;
  const hasPaintPart = line.facts.paintOption !== "none";
  const missingChoices = listMissingChoices(line, people);
  const base = {
    lineId: line.lineId,
    productTitle: line.productTitle,
    variantTitle: line.variantTitle,
    qty: line.facts.qty,
    paid: formatLei(line.facts.paidBani),
    hasPaintPart,
    printedByName: nameOfChoice(line.printedBy, people),
    paintedByName: hasPaintPart ? nameOfChoice(line.paintedBy, people) : null,
    printedValue: valueOfChoice(line.printedBy, people),
    paintedValue: valueOfChoice(line.paintedBy, people),
    printedOptions: menuOptions("printedBy", line.printedBy, people),
    paintedOptions: menuOptions("paintedBy", line.paintedBy, people),
    missingChoices,
    tags: listTags(line, result, context, hasPaintPart, missingChoices),
  };
  if (result.status === "blocked") return { ...base, ...blockedRow(result) };
  return {
    ...base,
    fee: formatExact(result.fee),
    cost: formatLei(result.costBani),
    company: formatExact(result.company),
    status: "ok",
    blockedText: null,
    owed: listOwed(result, people),
    steps: describeSteps(result),
  };
}

function blockedRow(result: BlockedLineResult) {
  return {
    fee: UNKNOWN_AMOUNT,
    cost: UNKNOWN_AMOUNT,
    company: UNKNOWN_AMOUNT,
    status: "blocked" as const,
    blockedText: TAG_TEXT[result.reason].label,
    owed: [],
    steps: [],
  };
}
// #endregion

// #region Orders
function compareOrders(
  left: OrderView & { at: number },
  right: OrderView & { at: number },
): number {
  return left.at - right.at || left.name.localeCompare(right.name);
}

function groupByOrder(
  file: MonthFile,
  calculated: readonly CalculatedLine[],
  context: LineContext,
): OrderView[] {
  const groups = new Map<string, OrderView & { at: number }>();
  for (const entry of calculated) {
    const { line } = entry;
    let group = groups.get(line.orderId);
    if (group === undefined) {
      group = {
        orderId: line.orderId,
        name: line.orderName,
        dateText: formatDay(line.orderCreatedAt, file.timeZone),
        notPaidYet: line.tags.includes("not-paid-yet"),
        warning: line.orderWarning === null ? null : "Refund without lines: check it by hand",
        lines: [],
        at: new Date(line.orderCreatedAt).getTime(),
      };
      groups.set(line.orderId, group);
    }
    group.lines.push(buildLineRow(entry, context));
  }
  return [...groups.values()].sort(compareOrders).map(({ at: _at, ...order }) => order);
}
// #endregion

// #region Totals and notices
function describePeopleTotals(
  totals: MonthTotals,
  people: StoredPeople["people"],
): PersonTotalView[] {
  return totals.people.map((total) => {
    // WHY: only a correction can name a person who is gone from Settings (their line is in a
    // closed month). The money is still theirs, so the total is shown, not dropped.
    const person = people.find((candidate) => candidate.id === total.personId);
    return {
      personId: total.personId,
      name: person?.name ?? UNKNOWN_PERSON,
      print: formatExact(total.print),
      paint: formatExact(total.paint),
      drybrush: formatExact(total.drybrush),
      corrections: formatExact(total.corrections),
      total: formatLei(total.totalBani),
    };
  });
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function listNotices(orders: readonly OrderView[]): string[] {
  const notices: string[] = [];
  const blockedByReason = new Map<string, number>();
  for (const line of orders.flatMap((order) => order.lines)) {
    if (line.blockedText === null) continue;
    blockedByReason.set(line.blockedText, (blockedByReason.get(line.blockedText) ?? 0) + 1);
  }
  for (const [reason, count] of blockedByReason) {
    notices.push(`${count} ${plural(count, "line is", "lines are")} blocked: ${reason}.`);
  }
  const needChoice = orders
    .flatMap((order) => order.lines)
    .filter((line) => line.missingChoices.length > 0).length;
  if (needChoice > 0) {
    const subject = plural(needChoice, "line needs", "lines need");
    notices.push(`${needChoice} ${subject} a person chosen for Printed by or Painted by.`);
  }
  const refundOrders = orders.filter((order) => order.warning !== null).length;
  if (refundOrders > 0) {
    const subject = plural(
      refundOrders,
      "order has a refund that is",
      "orders have refunds that are",
    );
    notices.push(`${refundOrders} ${subject} not tied to a line: check it by hand.`);
  }
  return notices;
}

function describeStatus(
  title: string,
  lineCount: number,
  orderCount: number,
  blocked: number,
  needsChoice: number,
): string {
  if (lineCount === 0) return `${title}: no lines`;
  const counts = `${lineCount} ${plural(lineCount, "line", "lines")} in ${orderCount} ${plural(orderCount, "order", "orders")}`;
  const blockedText = blocked > 0 ? `, ${blocked} blocked` : "";
  const choiceText = needsChoice > 0 ? `, ${needsChoice} need a choice` : "";
  return `${title}: ${counts}${blockedText}${choiceText}`;
}
// #endregion

// #region Corrections
const CORRECTION_TEXT: Record<Correction["reason"], string> = {
  removed: "refunded in full or cancelled since",
  reduced: "partly refunded since",
};

function describeCorrection(
  correction: Correction,
  amounts: LineAmounts,
  people: StoredPeople["people"],
): CorrectionView {
  const names = [correction.orderName, correction.productTitle, correction.variantTitle];
  const personIds = [...new Set(amounts.shares.map((share) => share.personId))];
  return {
    id: `${correction.sourceMonth}/${correction.lineId}`,
    title: names.filter((name) => name !== "").join(" · "),
    text: `Paid in ${formatMonthTitle(correction.sourceMonth)}, ${CORRECTION_TEXT[correction.reason]}.`,
    people: personIds.map((personId) => {
      const sum = amounts.shares
        .filter((share) => share.personId === personId)
        .reduce((total, share) => add(total, share.amount), ZERO_AMOUNT);
      return {
        personId,
        name: people.find((person) => person.id === personId)?.name ?? UNKNOWN_PERSON,
        amount: formatExact(sum),
      };
    }),
    company: formatExact(amounts.company),
  };
}
// #endregion

// #region The month's numbers
/** What the view draws from: the lines with their results, the corrections and the totals. */
interface MonthNumbers {
  context: LineContext;
  calculated: CalculatedLine[];
  corrections: LineAmounts[];
  totals: MonthTotals;
}

/** An open month is worked out now, with the live settings and people. */
function calculateOpenMonth(
  file: MonthFile,
  settings: PayoutSettings,
  stored: StoredPeople,
): MonthNumbers {
  const calculated = file.lines.map((line) => ({
    line,
    result: calculateLine(
      { ...line.facts, printedBy: line.printedBy, paintedBy: line.paintedBy },
      settings.rates,
      stored.people,
    ),
  }));
  const corrections = (file.corrections ?? []).map((correction) => readAmounts(correction.amounts));
  const totals = sumMonth(
    calculated.map((entry) => entry.result),
    corrections,
  );
  return {
    context: { rates: settings.rates, people: stored.people },
    calculated,
    corrections,
    totals,
  };
}

/** A closed month is read, never worked out: its own results, totals, rates and people. */
function readClosedMonth(file: ClosedMonthFile): MonthNumbers {
  const calculated = file.lines.map((line, index) => {
    const stored = file.results[index];
    if (stored?.lineId !== line.lineId) {
      throw new Error(`The closed month ${file.month} has no result for line ${line.lineId}.`);
    }
    return { line, result: readResult(stored.result) };
  });
  return {
    context: { rates: file.settings.rates, people: file.people },
    calculated,
    corrections: file.corrections.map((correction) => readAmounts(correction.amounts)),
    totals: readTotals(file.totals),
  };
}
// #endregion

/**
 * The view of a month file. An open month is worked out with the rates and the people given; a
 * closed one shows what was locked in it and ignores them.
 */
export function buildMonthView(
  file: MonthFile,
  settings: PayoutSettings,
  stored: StoredPeople,
): MonthView {
  const { context, calculated, corrections, totals } =
    file.status === "closed" ? readClosedMonth(file) : calculateOpenMonth(file, settings, stored);
  const orders = groupByOrder(file, calculated, context);
  const title = formatMonthTitle(file.month);
  const needsChoiceLines = orders
    .flatMap((order) => order.lines)
    .filter((row) => row.missingChoices.length > 0).length;
  const companyCorrections = corrections.reduce(
    (sum, amounts) => add(sum, amounts.company),
    ZERO_AMOUNT,
  );
  return {
    month: file.month,
    title,
    status: file.status,
    loadedText: formatMoment(file.loadedAt, file.timeZone),
    closedText: file.status === "closed" ? formatMoment(file.closedAt, file.timeZone) : null,
    lineCount: file.lines.length,
    orderCount: orders.length,
    orders,
    people: describePeopleTotals(totals, context.people),
    paid: formatLei(totals.paidBani),
    company: formatLei(totals.companyBani),
    fees: formatLei(totals.feesBani),
    costs: formatLei(totals.costsBani),
    corrections: (file.corrections ?? []).flatMap((correction, index) => {
      const amounts = corrections[index];
      return amounts === undefined ? [] : describeCorrection(correction, amounts, context.people);
    }),
    companyCorrections: corrections.length === 0 ? null : formatExact(companyCorrections),
    blockedLines: totals.blockedLines,
    needsChoiceLines,
    notices: listNotices(orders),
    statusText: describeStatus(
      title,
      file.lines.length,
      orders.length,
      totals.blockedLines,
      needsChoiceLines,
    ),
  };
}
