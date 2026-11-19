import { describe, expect, it } from "vitest";
import type { Statement } from "./statement";
import { buildStatementDocument } from "./statementDocument";

const STATEMENT: Statement = {
  id: "PAY-2031-01-PRINTE",
  month: "2031-01",
  monthTitle: "January 2031",
  personId: "printer-a",
  personName: "Ștefan Țurcanu",
  closedText: "28 Jan 2031, 18:00",
  totalBani: 7578,
  parts: [
    { label: "Print profit share (60%)", bani: 12198 },
    { label: "Painting", bani: 0 },
    { label: "Drybrush", bani: 0 },
    { label: "Corrections from earlier months", bani: -4620 },
  ],
  lines: [
    { order: "#2001", item: "Marsh Troll", qty: 2, work: "Print", bani: 4620 },
    { order: "#2002", item: "Stone Golem · Large", qty: 1, work: "Print", bani: 5184 },
    {
      order: "#1990",
      item: "Cave Bat (paid in December 2030)",
      qty: null,
      work: "Correction",
      bani: -4620,
    },
  ],
  rules: "How it is worked out. A made-up paragraph.",
  paidOn: null,
};

/** Every piece of text in the tree, in reading order. */
function collectText(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node !== "object" || node === null) return [];
  return Object.entries(node).flatMap(([key, value]) =>
    key === "text" || key === "stack" || key === "columns" || key === "table" || key === "body"
      ? collectText(value)
      : [],
  );
}

type Definition = ReturnType<typeof buildStatementDocument>;
type LineTable = { table: { body: unknown[][]; headerRows: number; dontBreakRows: boolean } };

/** The table whose first header cell says "Order": the line list. */
function findLineTable(node: unknown): LineTable | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findLineTable(child);
      if (found !== null) return found;
    }
    return null;
  }
  if (typeof node !== "object" || node === null) return null;
  const record = node as Record<string, unknown>;
  const table = record["table"] as { body?: unknown[][] } | undefined;
  if (table?.body !== undefined && collectText(table.body[0])[0] === "Order") {
    return record as unknown as LineTable;
  }
  for (const value of Object.values(record)) {
    const found = findLineTable(value);
    if (found !== null) return found;
  }
  return null;
}

function lineTableOf(definition: Definition): LineTable {
  const found = findLineTable(definition.content);
  if (found === null) throw new Error("The statement has no line table.");
  return found;
}

describe("the page", () => {
  it("is A4, portrait", () => {
    const definition = buildStatementDocument(STATEMENT);
    expect(definition.pageSize).toBe("A4");
    expect(definition.pageOrientation ?? "portrait").toBe("portrait");
  });

  it("uses a bundled font, never one that has to be fetched", () => {
    expect(buildStatementDocument(STATEMENT).defaultStyle?.font).toBe("Roboto");
  });
});

describe("the content", () => {
  const text = collectText(buildStatementDocument(STATEMENT).content);

  it("has the person and the month in the title, with the letters as they are", () => {
    expect(text).toContain("Ștefan Țurcanu — January 2031");
  });

  it("has the total to pay and the statement id", () => {
    expect(text).toContain("75.78 lei");
    expect(text).toContain("PAY-2031-01-PRINTE");
  });

  it("has every part, with a real minus on a negative one", () => {
    expect(text).toContain("Print profit share (60%)");
    expect(text).toContain("121.98");
    expect(text).toContain("Corrections from earlier months");
    expect(text).toContain("−46.20");
  });

  it("has the rules paragraph and an empty Paid on line while nothing is marked", () => {
    expect(text).toContain("How it is worked out. A made-up paragraph.");
    expect(text).toContain("Paid on: ______________");
  });

  it("has the paid day once it is marked", () => {
    const paid = collectText(
      buildStatementDocument({ ...STATEMENT, paidOn: "2031-02-05" }).content,
    );
    expect(paid).toContain("Paid on: 2031-02-05");
  });
});

describe("the line table", () => {
  it("has a header row and one row per line", () => {
    const body = lineTableOf(buildStatementDocument(STATEMENT)).table.body;
    expect(body).toHaveLength(STATEMENT.lines.length + 1);
    expect(collectText(body[0])).toEqual(["Order", "Item", "Qty", "Work", "Lei"]);
  });

  it("holds the line's own words and money", () => {
    const body = lineTableOf(buildStatementDocument(STATEMENT)).table.body;
    expect(collectText(body[1])).toEqual(["#2001", "Marsh Troll", "2", "Print", "46.20"]);
    expect(collectText(body[3])).toEqual([
      "#1990",
      "Cave Bat (paid in December 2030)",
      "",
      "Correction",
      "−46.20",
    ]);
  });

  it("repeats its header on the next page, so a long list flows instead of being cut", () => {
    const node = lineTableOf(buildStatementDocument(STATEMENT));
    expect(node.table.headerRows).toBe(1);
    expect(node.table.dontBreakRows).toBe(true);
  });
});

describe("the footer", () => {
  const PAGE = { width: 595, height: 842, orientation: "portrait" as const };
  const { footer } = buildStatementDocument(STATEMENT);
  if (typeof footer !== "function") throw new Error("The footer must be a function of the page.");

  it("says nothing on a one page statement", () => {
    expect(collectText(footer(1, 1, PAGE)).join("")).toBe("");
  });

  it("names the statement and the page when there is more than one", () => {
    const text = collectText(footer(2, 3, PAGE));
    expect(text.join(" ")).toContain("PAY-2031-01-PRINTE");
    expect(text.join(" ")).toContain("page 2 of 3");
  });
});
