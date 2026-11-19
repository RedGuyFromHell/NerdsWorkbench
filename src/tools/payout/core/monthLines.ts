// The stored lines of a month: the planned lines of planMonthLines, each with the date of its
// order and the two choices. The loader and the demo data both build a month file through this.

import type { MonthLine } from "../storage/monthSchema";
import type { MonthLinesPlan, PlannedLine } from "./lineFacts";
import type { RawOrder } from "./rawOrder";

export interface LineChoice {
  /** Person ids. Null is a choice not made yet. */
  printedBy: string | null;
  paintedBy: string | null;
}

/** Throws when a planned line's order is missing: its date cannot be guessed. */
export function toMonthLines(
  plan: MonthLinesPlan,
  orders: readonly RawOrder[],
  choiceOf: (line: PlannedLine) => LineChoice,
): MonthLine[] {
  const createdAtByOrder = new Map(orders.map((order) => [order.id, order.createdAt]));
  return plan.lines.map((planned) => {
    const orderCreatedAt = createdAtByOrder.get(planned.orderId);
    if (orderCreatedAt === undefined) {
      throw new Error(`Order ${planned.orderId} of line ${planned.lineId} is not in the orders.`);
    }
    return {
      orderId: planned.orderId,
      orderName: planned.orderName,
      orderCreatedAt,
      lineId: planned.lineId,
      productId: planned.productId,
      productTitle: planned.productTitle,
      variantTitle: planned.variantTitle,
      facts: planned.facts,
      tags: planned.tags,
      orderWarning: planned.orderWarning,
      ...choiceOf(planned),
    };
  });
}
