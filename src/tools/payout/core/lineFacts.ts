// From the raw orders of a month to the lines the payout maths runs on: which orders and lines
// count, and for each line the money paid, the list price, the quantity left, the paint level,
// the primed price and the cost. Pure: the loader fills the raw orders, the screen adds the people.

import { resolveUnitCost } from "./lineCost";
import type { CostTableRow } from "./lineCost";
import { monthOf } from "./orderMonth";
import { findPrimedSibling, resolvePaintOption } from "./paintOption";
import { isPayoutLine } from "./productRule";
import type { ProductRule } from "./productRule";
import type {
  FinancialStatus,
  ProductVariants,
  RawLine,
  RawOrder,
  RawRefundLine,
  RawVariant,
} from "./rawOrder";
import type { LineInput, LineTag } from "./types";

// #region Shapes

/** The part of Settings the line facts read. */
export interface LineFactsSettings {
  rule: ProductRule;
  costTable: CostTableRow[];
  /** The time zone of the store, an IANA name. */
  timeZone: string;
}

/** Everything the maths needs of a line except who printed and who painted it. */
export type LineFacts = Omit<LineInput, "printedBy" | "paintedBy">;

/** The tags that are facts of the order. The maths adds its own. */
export type FactTag = Extract<LineTag, "cost-from-table" | "not-paid-yet">;

/** A thing about the whole order to check by hand before the month closes. */
export type OrderWarning = "refund-without-lines";

export interface PlannedLine {
  orderId: string;
  orderName: string;
  lineId: string;
  productId: string | null;
  productTitle: string;
  variantTitle: string;
  facts: LineFacts;
  tags: FactTag[];
  orderWarning: OrderWarning | null;
}

/** Why an order or a line is not in the month. The first four count orders, the last two lines. */
export type LeftOutReason =
  | "other-month"
  | "cancelled"
  | "voided"
  | "expired"
  | "refunded"
  | "not-payout-line"
  | "no-units-left";

export interface MonthLinesPlan {
  /** In the order of the orders, then of their lines. */
  lines: PlannedLine[];
  leftOut: Record<LeftOutReason, number>;
}

// #endregion

// #region Orders

const NOT_PAID_YET_STATUSES: ReadonlySet<FinancialStatus> = new Set([
  "pending",
  "authorized",
  "partially-paid",
]);

/** Why a whole order is not in the month, or null when it is. */
function resolveOrderLeftOut(
  order: RawOrder,
  month: string,
  timeZone: string,
): LeftOutReason | null {
  if (monthOf(order.createdAt, timeZone) !== month) return "other-month";
  if (order.cancelledAt !== null) return "cancelled";
  if (order.financialStatus === "voided") return "voided";
  // WHY: Shopify marks an order expired when its payment was never captured in time: no money came in.
  if (order.financialStatus === "expired") return "expired";
  if (order.financialStatus === "refunded") return "refunded";
  return null;
}

// #endregion

// #region Refunds

/** What the refunds of an order took back from one line. */
interface LineRefund {
  quantity: number;
  subtotalBani: number;
}

const NO_REFUND: LineRefund = { quantity: 0, subtotalBani: 0 };

function sumRefundsByLine(refunds: readonly RawRefundLine[]): Map<string, LineRefund> {
  const refundByLine = new Map<string, LineRefund>();
  for (const refund of refunds) {
    const lineRefund = refundByLine.get(refund.lineId) ?? NO_REFUND;
    refundByLine.set(refund.lineId, {
      quantity: lineRefund.quantity + refund.quantity,
      subtotalBani: lineRefund.subtotalBani + refund.subtotalBani,
    });
  }
  return refundByLine;
}

// #endregion

// #region Lines

/**
 * The money paid for a line: its price after every discount, without tax, minus what was refunded.
 * WHY: only the money paid loses the tax. The list price keeps it, and so does the current primed
 * price, so on a painted line the ratio paid / list takes the tax out of the print price too.
 */
function calculatePaidBani(line: RawLine, order: RawOrder, lineRefund: LineRefund): number {
  const includedTaxBani = order.taxesIncluded ? line.taxBani : 0;
  return (
    line.originalUnitBani * line.quantity -
    line.discountAllocatedBani -
    includedTaxBani -
    lineRefund.subtotalBani
  );
}

function listFactTags(order: RawOrder, isCostFromTable: boolean): FactTag[] {
  const tags: FactTag[] = [];
  if (isCostFromTable) tags.push("cost-from-table");
  if (NOT_PAID_YET_STATUSES.has(order.financialStatus)) tags.push("not-paid-yet");
  return tags;
}

/** The planned line of a line that counts, or null when every piece of it was refunded. */
function planLine(
  line: RawLine,
  order: RawOrder,
  lineRefund: LineRefund,
  shop: { variants: readonly RawVariant[]; costTable: readonly CostTableRow[] },
): PlannedLine | null {
  const qty = line.quantity - lineRefund.quantity;
  if (qty < 0) {
    throw new Error(
      `Order ${order.name}: line ${line.id} has ${lineRefund.quantity} pieces refunded of ${line.quantity}.`,
    );
  }
  if (qty === 0) return null;

  const unitCost = resolveUnitCost(line, shop.variants, shop.costTable);
  return {
    orderId: order.id,
    orderName: order.name,
    lineId: line.id,
    productId: line.productId,
    productTitle: line.productTitle,
    variantTitle: line.variantTitle,
    facts: {
      paidBani: calculatePaidBani(line, order, lineRefund),
      listBani: line.originalUnitBani * qty,
      qty,
      paintOption: resolvePaintOption(line.options),
      primedUnitBani: findPrimedSibling(line.options, shop.variants)?.priceBani ?? null,
      costBani: unitCost === null ? null : unitCost.unitBani * qty,
    },
    tags: listFactTags(order, unitCost?.source === "table"),
    orderWarning: order.hasRefundWithoutLines ? "refund-without-lines" : null,
  };
}

// #endregion

// #region The month

const NO_VARIANTS: readonly RawVariant[] = [];

function countNothingLeftOut(): Record<LeftOutReason, number> {
  return {
    "other-month": 0,
    cancelled: 0,
    voided: 0,
    expired: 0,
    refunded: 0,
    "not-payout-line": 0,
    "no-units-left": 0,
  };
}

/**
 * The lines of a month with their facts, and how many orders and lines were left out, by reason.
 * Left out: orders of another month, cancelled, voided, expired and fully refunded orders, lines the
 * product rule does not count, and lines with no piece left after refunds. An order not paid yet
 * stays, tagged. A refund not tied to a line changes no amount: the lines carry a warning.
 */
export function planMonthLines(
  orders: readonly RawOrder[],
  productVariants: readonly ProductVariants[],
  settings: LineFactsSettings,
  month: string,
): MonthLinesPlan {
  const variantsByProduct = new Map(
    productVariants.map((product) => [product.productId, product.variants]),
  );
  const monthPlan: MonthLinesPlan = { lines: [], leftOut: countNothingLeftOut() };

  for (const order of orders) {
    const orderLeftOut = resolveOrderLeftOut(order, month, settings.timeZone);
    if (orderLeftOut !== null) {
      monthPlan.leftOut[orderLeftOut] += 1;
      continue;
    }
    const refundByLine = sumRefundsByLine(order.refunds);
    for (const line of order.lines) {
      if (!isPayoutLine(line, settings.rule)) {
        monthPlan.leftOut["not-payout-line"] += 1;
        continue;
      }
      const variants =
        line.productId === null ? NO_VARIANTS : variantsByProduct.get(line.productId);
      const plannedLine = planLine(line, order, refundByLine.get(line.id) ?? NO_REFUND, {
        variants: variants ?? NO_VARIANTS,
        costTable: settings.costTable,
      });
      if (plannedLine === null) {
        monthPlan.leftOut["no-units-left"] += 1;
        continue;
      }
      monthPlan.lines.push(plannedLine);
    }
  }
  return monthPlan;
}

// #endregion
