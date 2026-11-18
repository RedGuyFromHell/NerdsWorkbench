// How the codes reach Shopify: the first one creates the discount, the rest are added in batches.

// Most codes one discountRedeemCodeBulkAdd call accepts (Shopify Admin GraphQL docs).
export const BULK_ADD_CODE_LIMIT = 250;

export interface CodeBatches {
  /** Goes into `discountCodeBasicCreate`, whose input holds a single code. */
  firstCode: string;
  /** Each one is a `discountRedeemCodeBulkAdd` call, no larger than the limit. */
  remainingBatches: string[][];
}

export function planCodeBatches(codes: readonly string[]): CodeBatches {
  const [firstCode, ...remainingCodes] = codes;
  if (firstCode === undefined) {
    throw new Error("A discount needs at least one code.");
  }
  const remainingBatches: string[][] = [];
  for (let start = 0; start < remainingCodes.length; start += BULK_ADD_CODE_LIMIT) {
    remainingBatches.push(remainingCodes.slice(start, start + BULK_ADD_CODE_LIMIT));
  }
  return { firstCode, remainingBatches };
}
