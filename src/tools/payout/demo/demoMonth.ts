// A made-up month for looking at the screen before the Shopify loader exists. Every person,
// product, price and order here is invented. The tool imports this file only in a dev build
// (import.meta.env.DEV, through a dynamic import), so a release never shows it as real data.

import { planClose } from "../core/closeMonth";
import { planCorrections } from "../core/corrections";
import { planMonthLines } from "../core/lineFacts";
import type { LineFactsSettings, MonthLinesPlan } from "../core/lineFacts";
import { toMonthLines } from "../core/monthLines";
import type {
  FinancialStatus,
  ProductVariants,
  RawLine,
  RawOrder,
  RawVariant,
} from "../core/rawOrder";
import type { ClosedMonthFile, MonthFile, MonthLine } from "../storage/monthSchema";
import { monthFileSchema } from "../storage/monthSchema";
import { createMemoryStore } from "../storage/payoutStore";
import type { PayoutStore } from "../storage/payoutStore";
import { DEFAULT_SETTINGS, STORAGE_VERSION } from "../storage/schemas";
import type { PayoutSettings, StoredPeople } from "../storage/schemas";

export const DEMO_MONTH = "2031-03";
/** A month already closed, and the open one after it that carries its late refunds. */
export const DEMO_CLOSED_MONTH = "2031-01";
export const DEMO_CARRY_MONTH = "2031-02";
const DEMO_TIME_ZONE = "Europe/Bucharest";
const PRIMED = "Primed & Drybrushed";
const COMPLETE = "Complete Paint Job";

/** Everything the tool shows of the demo: the months and the settings and people they were worked out with. */
export interface DemoBundle {
  /** The month with every tag. Its blocked lines keep it open. */
  month: MonthFile;
  /** The closed month, then the open one that can be closed. Oldest first. */
  earlierMonths: MonthFile[];
  settings: PayoutSettings;
  people: StoredPeople;
  plan: MonthLinesPlan;
}

// #region People and settings
const PRINTER_A = "demo-printer-a";
const PAINTER_B = "demo-painter-b";
const FARM = "demo-farm";
const OWNER_C = "demo-owner-c";

const DEMO_PEOPLE: StoredPeople = {
  version: STORAGE_VERSION,
  people: [
    {
      id: PRINTER_A,
      name: "Printer A",
      prints: true,
      paints: false,
      getsPaid: true,
      defaultFor: ["printing"],
    },
    {
      id: PAINTER_B,
      name: "Painter B",
      prints: false,
      paints: true,
      getsPaid: true,
      defaultFor: ["painting", "drybrush"],
    },
    { id: FARM, name: "Farm", prints: true, paints: false, getsPaid: false, defaultFor: [] },
    { id: OWNER_C, name: "Owner C", prints: false, paints: true, getsPaid: false, defaultFor: [] },
  ],
};

const DEMO_SETTINGS: PayoutSettings = {
  ...DEFAULT_SETTINGS,
  rates: { feeBp: 300, splitBp: 6000, drybrushBp: 1200, drybrushMinBani: 2000 },
  rule: { ...DEFAULT_SETTINGS.rule, extraProductTitles: ["Demo Custom Piece"] },
  costTable: [
    { productTitle: "Demo Custom Piece", sizeValue: null, unitCostBani: 2000 },
    { productTitle: "Demo Gargoyle", sizeValue: null, unitCostBani: 2500 },
  ],
  firstMonth: DEMO_CLOSED_MONTH,
};

const FACTS_SETTINGS: LineFactsSettings = {
  rule: DEMO_SETTINGS.rule,
  costTable: DEMO_SETTINGS.costTable,
  timeZone: DEMO_TIME_ZONE,
};
// #endregion

// #region Products and orders
function variant(
  id: string,
  size: string,
  paint: string,
  priceBani: number,
  unitCostBani: number | null,
): RawVariant {
  return {
    id,
    options: [
      { name: "Size", value: size },
      { name: "Finish", value: paint },
    ],
    priceBani,
    unitCostBani,
  };
}

const PRODUCT_VARIANTS: ProductVariants[] = [
  {
    productId: "demo-griffin",
    variants: [
      variant("griffin-small-primed", "Small", PRIMED, 7000, 2200),
      variant("griffin-small-complete", "Small", COMPLETE, 31200, null),
      variant("griffin-large-primed", "Large", PRIMED, 23000, 5300),
      variant("griffin-large-complete", "Large", COMPLETE, 62000, null),
    ],
  },
  {
    productId: "demo-drake",
    variants: [
      variant("drake-primed", "Large", PRIMED, 23000, 4800),
      variant("drake-complete", "Large", COMPLETE, 60000, null),
    ],
  },
  {
    productId: "demo-gargoyle",
    variants: [variant("gargoyle-complete", "Small", COMPLETE, 32000, null)],
  },
  {
    productId: "demo-troll",
    variants: [{ id: "troll", options: [], priceBani: 4400, unitCostBani: 1200 }],
  },
  {
    productId: "demo-imp",
    variants: [{ id: "imp", options: [], priceBani: 2100, unitCostBani: 3500 }],
  },
  {
    productId: "demo-soldiers",
    variants: [{ id: "soldiers", options: [], priceBani: 3400, unitCostBani: 1000 }],
  },
  {
    productId: "demo-box",
    variants: [{ id: "box", options: [], priceBani: 3700, unitCostBani: null }],
  },
  {
    productId: "demo-custom",
    variants: [{ id: "custom", options: [], priceBani: 8900, unitCostBani: null }],
  },
  {
    productId: "demo-dice",
    variants: [{ id: "dice", options: [], priceBani: 2700, unitCostBani: 500 }],
  },
];

interface LineSpec {
  id: string;
  productId: string;
  title: string;
  tags: string[];
  variantId: string;
  variantTitle?: string;
  options?: RawLine["options"];
  quantity?: number;
  unitBani: number;
}

function rawLine(spec: LineSpec): RawLine {
  return {
    id: spec.id,
    productId: spec.productId,
    productTitle: spec.title,
    productTags: spec.tags,
    variantId: spec.variantId,
    variantTitle: spec.variantTitle ?? "Default",
    options: spec.options ?? [],
    quantity: spec.quantity ?? 1,
    originalUnitBani: spec.unitBani,
    discountAllocatedBani: 0,
    taxBani: 0,
  };
}

function sizeAndFinish(size: string, finish: string): Pick<LineSpec, "options" | "variantTitle"> {
  return {
    options: [
      { name: "Size", value: size },
      { name: "Finish", value: finish },
    ],
    variantTitle: `${size} / ${finish}`,
  };
}

function rawOrder(
  number: number,
  day: number,
  lines: RawLine[],
  overrides: Partial<RawOrder> = {},
): RawOrder {
  const status: FinancialStatus = "paid";
  return {
    id: `demo-order-${number}`,
    name: `#D${number}`,
    createdAt: `2031-03-${String(day).padStart(2, "0")}T10:00:00Z`,
    cancelledAt: null,
    financialStatus: status,
    taxesIncluded: false,
    lines,
    refunds: [],
    hasRefundWithoutLines: false,
    ...overrides,
  };
}

const MINI = ["mini"];

const DEMO_ORDERS: RawOrder[] = [
  rawOrder(1001, 2, [
    rawLine({
      id: "l-troll",
      productId: "demo-troll",
      title: "Demo Troll",
      tags: MINI,
      variantId: "troll",
      quantity: 2,
      unitBani: 4400,
    }),
  ]),
  rawOrder(1002, 5, [
    rawLine({
      id: "l-griffin-large",
      productId: "demo-griffin",
      title: "Demo Griffin",
      tags: MINI,
      variantId: "griffin-large-complete",
      unitBani: 62000,
      ...sizeAndFinish("Large", COMPLETE),
    }),
  ]),
  rawOrder(1003, 8, [
    rawLine({
      id: "l-griffin-small",
      productId: "demo-griffin",
      title: "Demo Griffin",
      tags: MINI,
      variantId: "griffin-small-primed",
      unitBani: 7000,
      ...sizeAndFinish("Small", PRIMED),
    }),
    rawLine({
      id: "l-dice",
      productId: "demo-dice",
      title: "Demo Dice Set",
      tags: ["dice"],
      variantId: "dice",
      unitBani: 2700,
    }),
  ]),
  rawOrder(1004, 12, [
    rawLine({
      id: "l-drake-primed",
      productId: "demo-drake",
      title: "Demo Drake",
      tags: MINI,
      variantId: "drake-primed",
      unitBani: 23000,
      ...sizeAndFinish("Large", PRIMED),
    }),
  ]),
  rawOrder(1005, 14, [
    rawLine({
      id: "l-custom",
      productId: "demo-custom",
      title: "Demo Custom Piece",
      tags: [],
      variantId: "custom",
      unitBani: 8900,
    }),
  ]),
  rawOrder(1006, 19, [
    rawLine({
      id: "l-griffin-owner",
      productId: "demo-griffin",
      title: "Demo Griffin",
      tags: MINI,
      variantId: "griffin-small-complete",
      unitBani: 31200,
      ...sizeAndFinish("Small", COMPLETE),
    }),
  ]),
  rawOrder(
    1007,
    23,
    [
      rawLine({
        id: "l-soldiers",
        productId: "demo-soldiers",
        title: "Demo Bone Soldiers",
        tags: MINI,
        variantId: "soldiers",
        quantity: 3,
        unitBani: 3400,
      }),
    ],
    { financialStatus: "pending" },
  ),
  rawOrder(1008, 27, [
    rawLine({
      id: "l-box",
      productId: "demo-box",
      title: "Demo Treasure Box",
      tags: MINI,
      variantId: "box",
      unitBani: 3700,
    }),
    rawLine({
      id: "l-gargoyle",
      productId: "demo-gargoyle",
      title: "Demo Gargoyle",
      tags: MINI,
      variantId: "gargoyle-complete",
      unitBani: 32000,
      ...sizeAndFinish("Small", COMPLETE),
    }),
  ]),
  rawOrder(
    1009,
    28,
    [
      rawLine({
        id: "l-imp",
        productId: "demo-imp",
        title: "Demo Imp",
        tags: MINI,
        variantId: "imp",
        unitBani: 2100,
      }),
      // The shop raised the price of the primed piece after this was sold: the paint part is negative.
      rawLine({
        id: "l-drake-old",
        productId: "demo-drake",
        title: "Demo Drake",
        tags: MINI,
        variantId: "drake-complete",
        unitBani: 19000,
        ...sizeAndFinish("Large", COMPLETE),
      }),
    ],
    { hasRefundWithoutLines: true },
  ),
  // Left out on purpose, so the plan's counts are not all zero: a cancelled order and one of April.
  rawOrder(
    1010,
    29,
    [
      rawLine({
        id: "l-cancelled",
        productId: "demo-troll",
        title: "Demo Troll",
        tags: MINI,
        variantId: "troll",
        unitBani: 4400,
      }),
    ],
    { cancelledAt: "2031-03-30T09:00:00Z" },
  ),
  {
    ...rawOrder(1011, 29, [
      rawLine({
        id: "l-april",
        productId: "demo-troll",
        title: "Demo Troll",
        tags: MINI,
        variantId: "troll",
        unitBani: 4400,
      }),
    ]),
    createdAt: "2031-04-02T10:00:00Z",
  },
];
// #endregion

// #region Choices
/** Who printed and painted each demo line: the two menus, filled in the way a user would. */
const DEMO_CHOICES: Record<string, { printedBy: string | null; paintedBy: string | null }> = {
  "l-troll": { printedBy: PRINTER_A, paintedBy: null },
  "l-griffin-large": { printedBy: PRINTER_A, paintedBy: PAINTER_B },
  "l-griffin-small": { printedBy: PRINTER_A, paintedBy: PAINTER_B },
  "l-drake-primed": { printedBy: FARM, paintedBy: PAINTER_B },
  "l-custom": { printedBy: PRINTER_A, paintedBy: null },
  "l-griffin-owner": { printedBy: PRINTER_A, paintedBy: OWNER_C },
  "l-soldiers": { printedBy: PRINTER_A, paintedBy: null },
  "l-box": { printedBy: PRINTER_A, paintedBy: null },
  "l-gargoyle": { printedBy: PRINTER_A, paintedBy: PAINTER_B },
  "l-imp": { printedBy: null, paintedBy: null }, // no one chosen yet: "needs a choice"
  "l-drake-old": { printedBy: PRINTER_A, paintedBy: PAINTER_B },
};
// #endregion

// #region The earlier months
type EarlierLine = Pick<
  MonthLine,
  "lineId" | "productTitle" | "variantTitle" | "facts" | "printedBy"
> &
  Partial<Pick<MonthLine, "paintedBy">>;

function earlierLine(month: string, orderNumber: number, line: EarlierLine): MonthLine {
  return {
    orderId: `demo-order-${orderNumber}`,
    orderName: `#${orderNumber}`,
    orderCreatedAt: `${month}-${String((orderNumber % 20) + 5).padStart(2, "0")}T10:00:00Z`,
    productId: null,
    tags: [],
    orderWarning: null,
    paintedBy: null,
    ...line,
  };
}

const CLOSED_MONTH_LINES: MonthLine[] = [
  earlierLine(DEMO_CLOSED_MONTH, 901, {
    lineId: "l-jan-troll",
    productTitle: "Demo Troll",
    variantTitle: "",
    facts: {
      paidBani: 8800,
      listBani: 8800,
      qty: 2,
      paintOption: "none",
      primedUnitBani: null,
      costBani: 1600,
    },
    printedBy: PRINTER_A,
  }),
  earlierLine(DEMO_CLOSED_MONTH, 902, {
    lineId: "l-jan-griffin",
    productTitle: "Demo Griffin",
    variantTitle: `Large / ${COMPLETE}`,
    facts: {
      paidBani: 32000,
      listBani: 32000,
      qty: 1,
      paintOption: "complete",
      primedUnitBani: 12000,
      costBani: 2500,
    },
    printedBy: PRINTER_A,
    paintedBy: PAINTER_B,
  }),
  earlierLine(DEMO_CLOSED_MONTH, 903, {
    lineId: "l-jan-drake",
    productTitle: "Demo Drake",
    variantTitle: `Small / ${PRIMED}`,
    facts: {
      paidBani: 16400,
      listBani: 16400,
      qty: 2,
      paintOption: "primed",
      primedUnitBani: 8200,
      costBani: 3000,
    },
    printedBy: FARM,
    paintedBy: PAINTER_B,
  }),
];

const CARRY_MONTH_LINES: MonthLine[] = [
  earlierLine(DEMO_CARRY_MONTH, 951, {
    lineId: "l-feb-troll",
    productTitle: "Demo Troll",
    variantTitle: "",
    facts: {
      paidBani: 4400,
      listBani: 4400,
      qty: 1,
      paintOption: "none",
      primedUnitBani: null,
      costBani: 800,
    },
    printedBy: PRINTER_A,
  }),
  earlierLine(DEMO_CARRY_MONTH, 952, {
    lineId: "l-feb-griffin",
    productTitle: "Demo Griffin",
    variantTitle: `Small / ${COMPLETE}`,
    facts: {
      paidBani: 22000,
      listBani: 22000,
      qty: 1,
      paintOption: "complete",
      primedUnitBani: 9000,
      costBani: 1800,
    },
    printedBy: PRINTER_A,
    paintedBy: PAINTER_B,
  }),
  earlierLine(DEMO_CARRY_MONTH, 953, {
    lineId: "l-feb-drake",
    productTitle: "Demo Drake",
    variantTitle: `Large / ${COMPLETE}`,
    facts: {
      paidBani: 40000,
      listBani: 40000,
      qty: 1,
      paintOption: "complete",
      primedUnitBani: 15000,
      costBani: 3500,
    },
    printedBy: PRINTER_A,
    paintedBy: PAINTER_B,
  }),
];

function openDemoMonth(month: string, lines: MonthLine[]): MonthFile {
  return {
    version: STORAGE_VERSION,
    month,
    status: "open",
    timeZone: DEMO_TIME_ZONE,
    loadedAt: `${month}-27T12:00:00Z`,
    lines,
  };
}

function createClosedMonth(): ClosedMonthFile {
  const plan = planClose({
    file: openDemoMonth(DEMO_CLOSED_MONTH, CLOSED_MONTH_LINES),
    settings: DEMO_SETTINGS,
    people: DEMO_PEOPLE,
    months: [],
    closedAt: "2031-02-03T09:00:00Z",
  });
  if (plan.kind === "refused") throw new Error("The closed month of the demo may not close.");
  return plan.closed;
}

/** January closed; then two late refunds on it, one in full and one of a single piece, land in February. */
function createEarlierMonths(): MonthFile[] {
  const closed = createClosedMonth();
  const corrections = planCorrections(
    [closed],
    [
      { month: DEMO_CLOSED_MONTH, lineId: "l-jan-troll", state: null },
      {
        month: DEMO_CLOSED_MONTH,
        lineId: "l-jan-drake",
        state: { qty: 1, paidBani: 8200, listBani: 8200 },
      },
    ],
  );
  return [closed, { ...openDemoMonth(DEMO_CARRY_MONTH, CARRY_MONTH_LINES), corrections }];
}
// #endregion

/** The demo month, worked out the way the loader will: raw orders, then the planned lines, then the file. */
export function createDemoBundle(): DemoBundle {
  const plan = planMonthLines(DEMO_ORDERS, PRODUCT_VARIANTS, FACTS_SETTINGS, DEMO_MONTH);
  const lines = toMonthLines(plan, DEMO_ORDERS, (planned) => {
    const choice = DEMO_CHOICES[planned.lineId];
    if (choice === undefined)
      throw new Error(`The demo has no choices for line ${planned.lineId}.`);
    return choice;
  });
  return {
    month: {
      version: STORAGE_VERSION,
      month: DEMO_MONTH,
      status: "open",
      timeZone: DEMO_TIME_ZONE,
      loadedAt: "2031-03-30T12:00:00Z",
      lines,
    },
    earlierMonths: createEarlierMonths(),
    settings: DEMO_SETTINGS,
    people: DEMO_PEOPLE,
    plan,
  };
}

/**
 * The demo in a store of its own, in memory: closing a month and marking a person paid run the
 * real code, and nothing reaches the files on the PC.
 */
export async function createDemoStore(): Promise<PayoutStore> {
  const bundle = createDemoBundle();
  const store = createMemoryStore();
  await store.writeSettings(bundle.settings);
  await store.writePeople(bundle.people);
  for (const file of [...bundle.earlierMonths, bundle.month]) {
    await store.writeMonth(file.month, monthFileSchema, file);
  }
  await store.markPaid(DEMO_CLOSED_MONTH, PRINTER_A, "2031-02-05");
  return store;
}
