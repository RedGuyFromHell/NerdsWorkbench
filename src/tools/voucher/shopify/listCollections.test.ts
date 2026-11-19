import { describe, expect, it } from "vitest";
import type { GraphqlCall } from "../../../lib/shopify/client";
import { listCollections } from "./listCollections";

/** A stand-in for the Shopify call: answers each request with the next raw page, parsed as the client does. */
function fakeGraphql(rawPages: readonly unknown[]) {
  const cursors: unknown[] = [];
  const graphql: GraphqlCall = (_query, variables, schema) => {
    const rawPage = rawPages[cursors.length];
    cursors.push(variables.cursor);
    return Promise.resolve(schema.parse(rawPage));
  };
  return { graphql, cursors };
}

function page(titles: readonly string[], endCursor: string | null) {
  return {
    collections: {
      nodes: titles.map((title) => ({ id: `gid://shopify/Collection/${title}`, title })),
      pageInfo: { hasNextPage: endCursor !== null, endCursor },
    },
  };
}

describe("listCollections", () => {
  it("follows the cursor until the last page and returns every collection, sorted", async () => {
    const { graphql, cursors } = fakeGraphql([
      page(["dice", "Trays"], "cursor-1"),
      page(["apparel"], "cursor-2"),
      page(["Minis"], null),
    ]);

    const collections = await listCollections(graphql);

    expect(cursors).toEqual([null, "cursor-1", "cursor-2"]);
    expect(collections).toEqual([
      { id: "gid://shopify/Collection/apparel", title: "apparel" },
      { id: "gid://shopify/Collection/dice", title: "dice" },
      { id: "gid://shopify/Collection/Minis", title: "Minis" },
      { id: "gid://shopify/Collection/Trays", title: "Trays" },
    ]);
  });

  it("asks once for a store whose collections fit one page", async () => {
    const { graphql, cursors } = fakeGraphql([page(["Dice"], null)]);
    expect(await listCollections(graphql)).toEqual([
      { id: "gid://shopify/Collection/Dice", title: "Dice" },
    ]);
    expect(cursors).toEqual([null]);
  });

  it("keeps only the id and the title of a collection", async () => {
    const { graphql } = fakeGraphql([
      {
        collections: {
          nodes: [{ id: "gid://shopify/Collection/1", title: "Dice", handle: "dice" }],
          pageInfo: { hasNextPage: false, endCursor: "end" },
        },
      },
    ]);
    expect(await listCollections(graphql)).toEqual([
      { id: "gid://shopify/Collection/1", title: "Dice" },
    ]);
  });

  it("refuses an answer of another shape", async () => {
    const { graphql } = fakeGraphql([{ collections: { nodes: [{ id: 7 }] } }]);
    await expect(listCollections(graphql)).rejects.toThrow();
  });

  it("stops with an error when Shopify promises a next page but gives no cursor", async () => {
    const { graphql, cursors } = fakeGraphql([
      {
        collections: {
          nodes: [{ id: "gid://shopify/Collection/1", title: "Dice" }],
          pageInfo: { hasNextPage: true, endCursor: null },
        },
      },
    ]);
    await expect(listCollections(graphql)).rejects.toThrow("no cursor");
    expect(cursors).toEqual([null]);
  });
});
