// The cost of one piece of a line: the cost the shop has for the variant, else the cost table of
// Settings, else none. A painted line costs what its primed sibling costs: the paint is paid apart.

import { toMatchKey } from "./matchText";
import { findPrimedSibling, resolvePaintOption } from "./paintOption";
import type { RawLine, RawVariant } from "./rawOrder";

/** A row of the fallback cost table in Settings. */
export interface CostTableRow {
  productTitle: string;
  /** An option value of the product, for example a size. Null is a row for every size. */
  sizeValue: string | null;
  unitCostBani: number;
}

export type CostSource = "shopify" | "table";

export interface UnitCost {
  unitBani: number;
  source: CostSource;
}

type CostLine = Pick<RawLine, "productTitle" | "variantId" | "options">;

function findCostVariant(line: CostLine, variants: readonly RawVariant[]): RawVariant | null {
  const paintOption = resolvePaintOption(line.options);
  if (paintOption === "partial" || paintOption === "complete") {
    return findPrimedSibling(line.options, variants);
  }
  return variants.find((variant) => variant.id === line.variantId) ?? null;
}

/** The row of the product for a size of the line, else the row of the product for every size. */
function findCostTableRow(line: CostLine, costTable: readonly CostTableRow[]): CostTableRow | null {
  const title = toMatchKey(line.productTitle);
  const productRows = costTable.filter((row) => toMatchKey(row.productTitle) === title);
  const optionValues = new Set(line.options.map((option) => toMatchKey(option.value)));
  const sizeRow = productRows.find(
    (row) => row.sizeValue !== null && optionValues.has(toMatchKey(row.sizeValue)),
  );
  return sizeRow ?? productRows.find((row) => row.sizeValue === null) ?? null;
}

/**
 * The cost of one piece and where it came from, or null when neither the shop nor the table has
 * one. A cost of zero in the shop is a cost.
 */
export function resolveUnitCost(
  line: CostLine,
  variants: readonly RawVariant[],
  costTable: readonly CostTableRow[],
): UnitCost | null {
  const shopCostBani = findCostVariant(line, variants)?.unitCostBani ?? null;
  if (shopCostBani !== null) return { unitBani: shopCostBani, source: "shopify" };
  const row = findCostTableRow(line, costTable);
  return row === null ? null : { unitBani: row.unitCostBani, source: "table" };
}
