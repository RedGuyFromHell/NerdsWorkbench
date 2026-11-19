// The settings of Settings › Payout as the text the fields hold (a draft), and the one function
// that turns a draft back into stored settings or says what is wrong. Nothing is saved from a
// draft that has a problem, so the file on disk never holds a half-typed value.
import { toMatchKey } from "../core/matchText";
import { basisPointsToPercent } from "../core/percent";
import { MONTH_KEY_PATTERN, STORAGE_VERSION, type PayoutSettings } from "../storage/schemas";
import {
  formatBaniText,
  formatTagList,
  parseLineList,
  parseMoneyText,
  parsePercentText,
  parseTagList,
} from "./fieldText";

export interface CostRowDraft {
  productTitle: string;
  /** Empty means the row holds for every size of the product. */
  sizeValue: string;
  costText: string;
}

export interface SettingsDraft {
  feeText: string;
  splitText: string;
  drybrushText: string;
  drybrushMinText: string;
  firstMonth: string;
  includeTagsText: string;
  excludeTagsText: string;
  /** One product title per line. */
  extraProductsText: string;
  costRows: CostRowDraft[];
}

export type SettingsResult =
  { ok: true; settings: PayoutSettings } | { ok: false; issues: string[] };

const BLANK_COST_ROW: CostRowDraft = { productTitle: "", sizeValue: "", costText: "" };
const PERCENT_ADVICE = "must be a percent from 0 to 100, for example 70 or 12.5.";
const MONEY_ADVICE = "in lei, for example 12 or 12.50.";

export function settingsToDraft(settings: PayoutSettings): SettingsDraft {
  const { rates, rule } = settings;
  return {
    feeText: basisPointsToPercent(rates.feeBp),
    splitText: basisPointsToPercent(rates.splitBp),
    drybrushText: basisPointsToPercent(rates.drybrushBp),
    drybrushMinText: formatBaniText(rates.drybrushMinBani),
    firstMonth: settings.firstMonth,
    includeTagsText: formatTagList(rule.includeTags),
    excludeTagsText: formatTagList(rule.excludeTags),
    extraProductsText: rule.extraProductTitles.join("\n"),
    costRows: settings.costTable.map((row) => ({
      productTitle: row.productTitle,
      sizeValue: row.sizeValue ?? "",
      costText: formatBaniText(row.unitCostBani),
    })),
  };
}

export function addCostRow(rows: readonly CostRowDraft[]): CostRowDraft[] {
  return [...rows, { ...BLANK_COST_ROW }];
}

export function removeCostRow(rows: readonly CostRowDraft[], index: number): CostRowDraft[] {
  if (!Number.isInteger(index) || index < 0 || index >= rows.length) {
    throw new RangeError(`There is no cost row at position ${index}.`);
  }
  return rows.filter((_row, position) => position !== index);
}

// #region Reading the fields
type Rates = PayoutSettings["rates"];

function readRates(draft: SettingsDraft, issues: string[]): Rates {
  const feeBp = parsePercentText(draft.feeText);
  const splitBp = parsePercentText(draft.splitText);
  const drybrushBp = parsePercentText(draft.drybrushText);
  const drybrushMinBani = parseMoneyText(draft.drybrushMinText);
  if (feeBp === null) issues.push(`Payment fee ${PERCENT_ADVICE}`);
  if (splitBp === null) issues.push(`Printer's share ${PERCENT_ADVICE}`);
  if (drybrushBp === null) issues.push(`Drybrush pay ${PERCENT_ADVICE}`);
  if (drybrushMinBani === null) issues.push(`Drybrush minimum must be an amount ${MONEY_ADVICE}`);
  return {
    feeBp: feeBp ?? 0,
    splitBp: splitBp ?? 0,
    drybrushBp: drybrushBp ?? 0,
    drybrushMinBani: drybrushMinBani ?? 0,
  };
}

function readFirstMonth(draft: SettingsDraft, issues: string[]): string {
  const month = draft.firstMonth.trim();
  if (month !== "" && !MONTH_KEY_PATTERN.test(month)) {
    issues.push("First month must be a month written yyyy-mm, for example 2031-01.");
  }
  return month;
}

function readRule(draft: SettingsDraft, issues: string[]): PayoutSettings["rule"] {
  const rule = {
    includeTags: parseTagList(draft.includeTagsText),
    excludeTags: parseTagList(draft.excludeTagsText),
    extraProductTitles: parseLineList(draft.extraProductsText),
  };
  if (rule.includeTags.length === 0 && rule.extraProductTitles.length === 0) {
    issues.push("Add at least one tag or one extra product, or no line will count.");
  }
  return rule;
}
// #endregion

// #region The cost table
type CostTable = PayoutSettings["costTable"];

function isBlankRow(row: CostRowDraft): boolean {
  return [row.productTitle, row.sizeValue, row.costText].every((text) => text.trim() === "");
}

function describeRowKey(row: CostRowDraft): string {
  const size = row.sizeValue.trim() === "" ? "every size" : `"${row.sizeValue.trim()}"`;
  return `"${row.productTitle.trim()}", ${size}`;
}

function rowKey(row: CostRowDraft): string {
  return `${toMatchKey(row.productTitle)}\u0000${toMatchKey(row.sizeValue)}`;
}

/** Two rows with one key would make the table answer differently by their order. */
function listRepeatedRows(rows: readonly CostRowDraft[], issues: string[]): void {
  const firstOfKey = new Map<string, number>();
  rows.forEach((row, index) => {
    if (isBlankRow(row) || false) return;
    const key = rowKey(row);
    const first = firstOfKey.get(key);
    if (first === undefined) {
      firstOfKey.set(key, index);
      return;
    }
    issues.push(
      `Cost rows ${first + 1} and ${index + 1} are the same product and size (${describeRowKey(rows[first] ?? row)}).`,
    );
  });
}

function readCostTable(draft: SettingsDraft, issues: string[]): CostTable {
  const table: CostTable = [];
  draft.costRows.forEach((row, index) => {
    if (isBlankRow(row)) return;
    const productTitle = row.productTitle.trim();
    const unitCostBani = parseMoneyText(row.costText);
    const position = index + 1;
    if (productTitle === "") issues.push(`Cost row ${position} needs a product title.`);
    if (unitCostBani === null) issues.push(`Cost row ${position} needs a cost ${MONEY_ADVICE}`);
    if (productTitle === "" || unitCostBani === null) return;
    const sizeValue = row.sizeValue.trim();
    table.push({ productTitle, sizeValue: sizeValue === "" ? null : sizeValue, unitCostBani });
  });
  listRepeatedRows(draft.costRows, issues);
  return table;
}
// #endregion

/** The stored settings of a draft, or every problem found, in the order the screen shows them. */
export function settingsFromDraft(draft: SettingsDraft): SettingsResult {
  const issues: string[] = [];
  const rates = readRates(draft, issues);
  const firstMonth = readFirstMonth(draft, issues);
  const rule = readRule(draft, issues);
  const costTable = readCostTable(draft, issues);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, settings: { version: STORAGE_VERSION, rates, rule, costTable, firstMonth } };
}
