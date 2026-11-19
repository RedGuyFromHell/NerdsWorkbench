// Which order lines the payout counts: the rule of Settings, by product tag, plus the products
// picked by title.

import { toMatchKey } from "./matchText";
import type { RawLine } from "./rawOrder";

export interface ProductRule {
  /** A product counts when it has any of these tags. */
  includeTags: string[];
  /** And none of these. */
  excludeTags: string[];
  /** Products that count whatever their tags, for example one that only carries a price. */
  extraProductTitles: string[];
}

function hasAnyTag(productTags: ReadonlySet<string>, ruleTags: readonly string[]): boolean {
  return ruleTags.some((ruleTag) => productTags.has(toMatchKey(ruleTag)));
}

/** True for a line of a product with an include tag and no exclude tag, or of an extra product. */
export function isPayoutLine(
  line: Pick<RawLine, "productTitle" | "productTags">,
  rule: ProductRule,
): boolean {
  const title = toMatchKey(line.productTitle);
  if (rule.extraProductTitles.some((extraTitle) => toMatchKey(extraTitle) === title)) return true;
  const productTags = new Set(line.productTags.map(toMatchKey));
  return hasAnyTag(productTags, rule.includeTags) && !hasAnyTag(productTags, rule.excludeTags);
}
