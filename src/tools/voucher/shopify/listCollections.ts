// Every collection of the store, for the "specific collections" picker: asks Shopify page by page
// and merges the pages.
import { z } from "zod";
import { shopifyGraphql } from "../../../lib/shopify/client";
import { mergeCollectionPages } from "./collections";
import type { Collection } from "./collections";

/** The Shopify call this needs; the tests pass a stand-in. */
export type GraphqlCall = <T>(
  query: string,
  variables: Record<string, unknown>,
  schema: z.ZodType<T>,
) => Promise<T>;

const COLLECTIONS_QUERY = `
  query Collections($cursor: String) {
    collections(first: 250, after: $cursor) {
      nodes { id title }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const collectionsPageSchema = z.object({
  collections: z.object({
    nodes: z.array(z.object({ id: z.string(), title: z.string() })),
    pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
  }),
});

type CollectionsPage = z.infer<typeof collectionsPageSchema>;

export async function listCollections(
  graphql: GraphqlCall = shopifyGraphql,
): Promise<Collection[]> {
  const pages: Collection[][] = [];
  let cursor: string | null = null;
  do {
    const page: CollectionsPage = await graphql(
      COLLECTIONS_QUERY,
      { cursor },
      collectionsPageSchema,
    );
    const { collections } = page;
    pages.push(collections.nodes);
    const { hasNextPage, endCursor } = collections.pageInfo;
    // WHY: without this, a next page with no cursor would ask for the first page for ever.
    if (hasNextPage && endCursor === null) {
      throw new Error("Shopify promised more collections but gave no cursor to continue from.");
    }
    cursor = hasNextPage ? endCursor : null;
  } while (cursor !== null);
  return mergeCollectionPages(pages);
}
