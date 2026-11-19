// The shape of an order as the payout maths wants it: one object per order, its lines and its
// refunds, with every amount already separated and in whole bani. The loader fills it from
// Shopify and owns that mapping; everything after it is pure and runs on made-up orders in tests.

/** One option of a variant, for example a size or a paint level. The name varies per product. */
export interface RawOption {
  name: string;
  value: string;
}

export type FinancialStatus =
  | "pending"
  | "authorized"
  | "partially-paid"
  | "paid"
  | "partially-refunded"
  | "refunded"
  | "voided"
  | "expired";

export interface RawLine {
  id: string;
  /** Null for a line that is not a catalogue product (a custom item). */
  productId: string | null;
  productTitle: string;
  productTags: string[];
  /** Null when the variant is gone from the shop. */
  variantId: string | null;
  variantTitle: string;
  options: RawOption[];
  /** The quantity ordered, before any refund. */
  quantity: number;
  /** The price of one piece at order time, before discounts. It holds the tax when the order has taxes included. */
  originalUnitBani: number;
  /** Every discount shared out to the line, line and order level together, for the whole quantity. */
  discountAllocatedBani: number;
  /** The tax of the whole line. It is inside the price when the order has taxes included, on top of it otherwise. */
  taxBani: number;
}

/** A refund of one line: pieces given back, money given back, or both. */
export interface RawRefundLine {
  lineId: string;
  /** Pieces given back. 0 is a refund of money only. */
  quantity: number;
  /** The money given back for the line, after discounts and without tax. */
  subtotalBani: number;
  createdAt: string;
}

export interface RawOrder {
  id: string;
  /** The order number the shop shows, for example "#1001". */
  name: string;
  /** ISO 8601 with an offset or a Z. */
  createdAt: string;
  cancelledAt: string | null;
  financialStatus: FinancialStatus;
  /** True when the prices of the order hold the tax. */
  taxesIncluded: boolean;
  lines: RawLine[];
  /** The refunded lines of every refund of the order, in one list. */
  refunds: RawRefundLine[];
  /** True when a refund gave money back without naming a line. That money is shared out to no line. */
  hasRefundWithoutLines: boolean;
}

/** A variant as the shop has it today: its price and its cost can differ from the order's. */
export interface RawVariant {
  id: string;
  options: RawOption[];
  priceBani: number;
  /** The cost per item, or null when the shop has none. */
  unitCostBani: number | null;
}

/** The current variants of one product, for the primed sibling and the cost of a line. */
export interface ProductVariants {
  productId: string;
  variants: RawVariant[];
}
