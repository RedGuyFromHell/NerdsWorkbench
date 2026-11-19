import { describe, expect, it } from "vitest";
import { mergeCollectionPages, type Collection } from "./collections";

function collection(title: string, id = `gid://shopify/Collection/${title}`): Collection {
  return { id, title };
}

describe("mergeCollectionPages", () => {
  it("joins the pages and sorts by title", () => {
    const merged = mergeCollectionPages([
      [collection("Minis"), collection("Accessories")],
      [collection("Dice")],
    ]);

    expect(merged.map((entry) => entry.title)).toEqual(["Accessories", "Dice", "Minis"]);
  });

  it("sorts without regard to case", () => {
    const merged = mergeCollectionPages([
      [collection("zebra"), collection("Apple"), collection("mango")],
    ]);

    expect(merged.map((entry) => entry.title)).toEqual(["Apple", "mango", "zebra"]);
  });

  it("keeps the merge order for titles that differ only in case", () => {
    const merged = mergeCollectionPages([
      [collection("dice", "first")],
      [collection("Dice", "second"), collection("DICE", "third")],
    ]);

    expect(merged.map((entry) => entry.id)).toEqual(["first", "second", "third"]);
  });

  it("orders by character code, not by the locale: an accented letter goes after z", () => {
    // A locale-aware sort would put école between d and f.
    const merged = mergeCollectionPages([
      [collection("école"), collection("farm"), collection("dice")],
    ]);

    expect(merged.map((entry) => entry.title)).toEqual(["dice", "farm", "école"]);
  });

  it("returns an empty list for no pages and for empty pages", () => {
    expect(mergeCollectionPages([])).toEqual([]);
    expect(mergeCollectionPages([[], []])).toEqual([]);
  });

  it("leaves the pages it was given untouched", () => {
    const page = [collection("B"), collection("A")];

    mergeCollectionPages([page]);

    expect(page.map((entry) => entry.title)).toEqual(["B", "A"]);
  });
});
