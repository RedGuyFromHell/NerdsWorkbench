// What the payout tool keeps on the PC: four small files, each with a `version`, parsed with zod
// at the one place they are read. The defaults hold no person, no rate and no amount: every
// number is a placeholder the user fills in Settings.
import { z } from "zod";

const WHOLE_NUMBER = z.number().int().nonnegative();
const BASIS_POINTS = WHOLE_NUMBER.max(10_000);
// An empty text is "not set yet"; otherwise yyyy-mm.
export const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const STORAGE_VERSION = 1;
const version = z.literal(STORAGE_VERSION);

// #region Settings
export const settingsSchema = z.object({
  version,
  /** Basis points (3% is 300) and bani (1 RON is 100); the drybrush minimum is per piece. */
  rates: z.object({
    feeBp: BASIS_POINTS,
    splitBp: BASIS_POINTS,
    drybrushBp: BASIS_POINTS,
    drybrushMinBani: WHOLE_NUMBER,
  }),
  /** The same shape as `ProductRule` and `CostTableRow` in core/. */
  rule: z.object({
    includeTags: z.array(z.string()),
    excludeTags: z.array(z.string()),
    extraProductTitles: z.array(z.string()),
  }),
  costTable: z.array(
    z.object({
      productTitle: z.string(),
      sizeValue: z.string().nullable(),
      unitCostBani: WHOLE_NUMBER,
    }),
  ),
  firstMonth: z.union([z.literal(""), z.string().regex(MONTH_KEY_PATTERN)]),
});

export type PayoutSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: PayoutSettings = {
  version: STORAGE_VERSION,
  rates: { feeBp: 0, splitBp: 0, drybrushBp: 0, drybrushMinBani: 0 },
  rule: {
    includeTags: ["mini", "figurine", "statue", "resin"],
    excludeTags: ["filament", "dice"],
    extraProductTitles: [],
  },
  costTable: [],
  firstMonth: "",
};
// #endregion

// #region People, choices and paid marks
export const PERSON_JOBS = ["printing", "painting", "drybrush"] as const;
export type PersonJob = (typeof PERSON_JOBS)[number];

export const peopleSchema = z.object({
  version,
  people: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string(),
      prints: z.boolean(),
      paints: z.boolean(),
      getsPaid: z.boolean(),
      /** The jobs this person is the menu default for (at most one person per job: a Settings rule). */
      defaultFor: z.array(z.enum(PERSON_JOBS)),
    }),
  ),
});

export type StoredPeople = z.infer<typeof peopleSchema>;

export const DEFAULT_PEOPLE: StoredPeople = { version: STORAGE_VERSION, people: [] };

/** The last _Printed by_ and _Painted by_ picked for a product, by Shopify product id. */
export const choicesSchema = z.object({
  version,
  byProduct: z.record(
    z.string(),
    z.object({ printedBy: z.string().nullable(), paintedBy: z.string().nullable() }),
  ),
});

export type StoredChoices = z.infer<typeof choicesSchema>;

export const DEFAULT_CHOICES: StoredChoices = { version: STORAGE_VERSION, byProduct: {} };

/** "Paid on" marks live apart from the months, so marking a person paid never rewrites a locked month. */
export const paidMarksSchema = z.object({
  version,
  marks: z.array(
    z.object({
      month: z.string().regex(MONTH_KEY_PATTERN),
      personId: z.string().min(1),
      paidOn: z.string().regex(DATE_PATTERN),
    }),
  ),
});

export type StoredPaidMarks = z.infer<typeof paidMarksSchema>;

export const DEFAULT_PAID_MARKS: StoredPaidMarks = { version: STORAGE_VERSION, marks: [] };
// #endregion
