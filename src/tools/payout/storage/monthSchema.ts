// The file of one month, `payout/months/<yyyy-mm>.json`: the lines of the month with their facts
// and the two choices per line. An open month keeps inputs and choices only; the results are
// worked out on screen. Closing adds the frozen parts: the settings and people as used, every
// result and the totals. A closed file is written once and never again.
import { z } from "zod";
import { MONTH_KEY_PATTERN, STORAGE_VERSION, peopleSchema, settingsSchema } from "./schemas";

const BANI = z.number().int();
const NON_NEGATIVE_BANI = BANI.nonnegative();

/** An instant as ISO 8601 text with an offset or a Z. */
const instant = z.string().refine((text) => !Number.isNaN(new Date(text).getTime()), {
  message: "not a time",
});

/** The same shape as `LineFacts` in core/. */
const lineFactsSchema = z.object({
  paidBani: BANI,
  listBani: NON_NEGATIVE_BANI,
  qty: z.number().int().positive(),
  paintOption: z.enum(["primed", "partial", "complete", "none"]),
  primedUnitBani: NON_NEGATIVE_BANI.nullable(),
  costBani: NON_NEGATIVE_BANI.nullable(),
});

export const monthLineSchema = z.object({
  orderId: z.string().min(1),
  orderName: z.string(),
  /** When the order was made: the order of the month screen and the day shown on it. */
  orderCreatedAt: instant,
  lineId: z.string().min(1),
  productId: z.string().nullable(),
  productTitle: z.string(),
  variantTitle: z.string(),
  facts: lineFactsSchema,
  /** The tags that are facts of the order; the maths adds its own on screen. */
  tags: z.array(z.enum(["cost-from-table", "not-paid-yet"])),
  orderWarning: z.literal("refund-without-lines").nullable(),
  /** Person ids. Null is a choice not made yet. */
  printedBy: z.string().nullable(),
  paintedBy: z.string().nullable(),
});

export type MonthLine = z.infer<typeof monthLineSchema>;

// #region Amounts, as stored
/** An exact amount as "n/d" text (core/exactAmount): BigInt has no JSON form. */
const exactAmount = z.string().regex(/^-?\d+\/[1-9]\d*$/, "not an exact amount");

/** The same shape as `LineAmounts` in core/, the amounts as text. In a correction they can be below zero. */
const storedAmountsSchema = z.object({
  paidBani: BANI,
  costBani: BANI,
  fee: exactAmount,
  shares: z.array(
    z.object({
      personId: z.string().min(1),
      part: z.enum(["print", "paint", "drybrush"]),
      amount: exactAmount,
    }),
  ),
  company: exactAmount,
});

export type StoredAmounts = z.infer<typeof storedAmountsSchema>;

/** The same shape as `OkLineResult` in core/: a month closes only when no line is blocked. */
const storedResultSchema = storedAmountsSchema.extend({
  tags: z.array(
    z.enum([
      "min-drybrush",
      "cost-from-table",
      "stays-in-company",
      "not-paid-yet",
      "loss",
      "negative-paint",
    ]),
  ),
  steps: z.object({
    printPrice: exactAmount,
    printFee: exactAmount,
    drybrush: exactAmount,
    profit: exactAmount,
    printer: exactAmount,
    companyPrint: exactAmount,
    paintPrice: exactAmount,
    paintFee: exactAmount,
    painter: exactAmount,
  }),
});

export type StoredResult = z.infer<typeof storedResultSchema>;

/** The same shape as `MonthTotals` in core/, without the count of blocked lines: a closed month has none. */
const storedTotalsSchema = z.object({
  people: z.array(
    z.object({
      personId: z.string().min(1),
      print: exactAmount,
      paint: exactAmount,
      drybrush: exactAmount,
      corrections: exactAmount,
      totalBani: BANI,
    }),
  ),
  paidBani: BANI,
  feesBani: BANI,
  costsBani: BANI,
  companyBani: BANI,
});

export type StoredTotals = z.infer<typeof storedTotalsSchema>;
// #endregion

// #region Corrections
/**
 * The change to one line of a closed month, after a refund or a cancellation that came later.
 * The oldest open month carries it, and it is locked with that month.
 */
export const correctionSchema = z.object({
  /** The closed month the line was paid in. */
  sourceMonth: z.string().regex(MONTH_KEY_PATTERN),
  lineId: z.string().min(1),
  orderName: z.string(),
  productTitle: z.string(),
  variantTitle: z.string(),
  /** `removed`: refunded in full, or cancelled. `reduced`: a part of it was refunded. */
  reason: z.enum(["removed", "reduced"]),
  amounts: storedAmountsSchema,
});

export type Correction = z.infer<typeof correctionSchema>;
// #endregion

// #region The month file
const monthBase = {
  version: z.literal(STORAGE_VERSION),
  month: z.string().regex(MONTH_KEY_PATTERN),
  /** The time zone (IANA name) the orders were cut into months in. */
  timeZone: z.string().min(1),
  loadedAt: instant,
  lines: z.array(monthLineSchema),
};

const openMonthSchema = z.object({
  ...monthBase,
  /** The Rust writer reads this top-level field to refuse a write over a closed month. */
  status: z.literal("open"),
  /** Left out means none. */
  corrections: z.array(correctionSchema).optional(),
});

export type OpenMonthFile = z.infer<typeof openMonthSchema>;

const closedMonthSchema = z
  .object({
    ...monthBase,
    status: z.literal("closed"),
    corrections: z.array(correctionSchema),
    closedAt: instant,
    /** The settings the results were worked out with. A closed month never reads the live Settings. */
    settings: settingsSchema.pick({ rates: true, rule: true, costTable: true }),
    /** The people as they were at the close: a later rename or removal changes nothing here. */
    people: peopleSchema.shape.people,
    /** One result per line, in the order of `lines`. */
    results: z.array(z.object({ lineId: z.string().min(1), result: storedResultSchema })),
    totals: storedTotalsSchema,
  })
  .refine(
    (file) =>
      file.results.length === file.lines.length &&
      file.results.every((entry, index) => entry.lineId === file.lines[index]?.lineId),
    { message: "a closed month needs one result per line, in the order of the lines" },
  );

export type ClosedMonthFile = z.infer<typeof closedMonthSchema>;

export const monthFileSchema = z.union([openMonthSchema, closedMonthSchema]);

export type MonthFile = z.infer<typeof monthFileSchema>;
// #endregion
