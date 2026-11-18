// The collection list for the "specific collections" picker: Shopify's pages merged into one list.

export interface Collection {
  id: string;
  title: string;
}

export function mergeCollectionPages(pages: readonly (readonly Collection[])[]): Collection[] {
  // WHY: titles are compared by lower-cased character code (Python's sorted with .lower()),
  // not with localeCompare, so the list stays in the order the old app showed. The sort is
  // stable: titles that differ only in case keep the order Shopify returned them in.
  return pages.flat().sort((first, second) => compareTitles(first.title, second.title));
}

function compareTitles(first: string, second: string): number {
  const lowerFirst = first.toLowerCase();
  const lowerSecond = second.toLowerCase();
  if (lowerFirst < lowerSecond) return -1;
  return lowerFirst > lowerSecond ? 1 : 0;
}
