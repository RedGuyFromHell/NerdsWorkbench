import { describe, expect, it } from "vitest";
import type { Statement } from "./statement";
import { statementCsv } from "./statementCsv";

const BOM_LENGTH = 1;

function statementWith(overrides: Partial<Statement>): Statement {
  return {
    id: "PAY-2031-01-PRINTE",
    month: "2031-01",
    monthTitle: "January 2031",
    personId: "printer-a",
    personName: "Printer A",
    closedText: "28 Jan 2031, 18:00",
    totalBani: 7578,
    parts: [],
    lines: [
      { order: "#2001", item: "Marsh Troll", qty: 2, work: "Print", bani: 4620 },
      {
        order: "#1990",
        item: "Cave Bat (partly refunded since)",
        qty: null,
        work: "Correction",
        bani: -4620,
      },
    ],
    rules: "",
    paidOn: null,
    ...overrides,
  };
}

/** The file without its byte order mark, cut into rows. */
function rowsOf(csv: string): string[] {
  return csv.slice(BOM_LENGTH).split("\r\n");
}

describe("the shape of the file", () => {
  it("starts with a byte order mark so Excel reads the letters", () => {
    expect(statementCsv(statementWith({})).charCodeAt(0)).toBe(0xfeff);
  });

  it("has a header row, one row per line, a total row, and ends with CRLF", () => {
    const csv = statementCsv(statementWith({}));
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(rowsOf(csv)).toEqual([
      "Statement,Person,Order,Item,Qty,Work,Amount (lei)",
      "PAY-2031-01-PRINTE,Printer A,#2001,Marsh Troll,2,Print,46.20",
      "PAY-2031-01-PRINTE,Printer A,#1990,Cave Bat (partly refunded since),,Correction,-46.20",
      "PAY-2031-01-PRINTE,Printer A,,,,Total,75.78",
      "",
    ]);
  });

  it("writes money with a dot, two decimals, no thousands mark and a plain minus", () => {
    const lines = [
      { order: "#1", item: "Big", qty: 1, work: "Print", bani: 123456 },
      { order: "#2", item: "Small", qty: 1, work: "Print", bani: 5 },
      { order: "#3", item: "Refund", qty: null, work: "Correction", bani: -123456 },
    ];
    const rows = rowsOf(statementCsv(statementWith({ lines, totalBani: 5 })));
    expect(rows.slice(1, 4).map((row) => row.split(",").pop())).toEqual([
      "1234.56",
      "0.05",
      "-1234.56",
    ]);
    expect(rows[4]?.split(",").pop()).toBe("0.05");
  });
});

describe("quoting", () => {
  it("quotes a name with a comma", () => {
    const rows = rowsOf(statementCsv(statementWith({ personName: "Printer, A" })));
    expect(rows[1]).toBe('PAY-2031-01-PRINTE,"Printer, A",#2001,Marsh Troll,2,Print,46.20');
  });

  it("doubles a quote inside a quoted cell", () => {
    const lines = [{ order: "#1", item: 'The "Big" One', qty: 1, work: "Print", bani: 100 }];
    const rows = rowsOf(statementCsv(statementWith({ lines, totalBani: 100 })));
    expect(rows[1]).toBe('PAY-2031-01-PRINTE,Printer A,#1,"The ""Big"" One",1,Print,1.00');
  });

  it("quotes a line break inside a cell", () => {
    const lines = [{ order: "#1", item: "Two\r\nlines", qty: 1, work: "Print", bani: 100 }];
    const csv = statementCsv(statementWith({ lines, totalBani: 100 }));
    expect(csv).toContain('"Two\r\nlines"');
  });

  it("keeps Romanian letters as they are", () => {
    const csv = statementCsv(statementWith({ personName: "Ștefan Țurcanu" }));
    expect(csv).toContain("Ștefan Țurcanu");
  });
});

describe("spreadsheet formulas", () => {
  it("does not let a text cell start with a formula character", () => {
    const lines = [
      { order: "#1", item: "=1+1", qty: 1, work: "Print", bani: 100 },
      { order: "#2", item: "+SUM(A1)", qty: 1, work: "Print", bani: 100 },
      { order: "#3", item: "-2", qty: 1, work: "Print", bani: 100 },
      { order: "#4", item: "@cmd", qty: 1, work: "Print", bani: 100 },
    ];
    const rows = rowsOf(statementCsv(statementWith({ lines, totalBani: 400 })));
    expect(rows.slice(1, 5).map((row) => row.split(",")[3])).toEqual([
      "'=1+1",
      "'+SUM(A1)",
      "'-2",
      "'@cmd",
    ]);
  });

  it("does not let a formula start after a separator inside a cell", () => {
    // A spreadsheet set to split on ; or tab cuts the cell there: the part after it is a cell too.
    const lines = [
      { order: "#1", item: "Troll;=1+1", qty: 1, work: "Print", bani: 100 },
      { order: "#2", item: "Troll\t@cmd", qty: 1, work: "Print", bani: 100 },
      { order: "#3", item: "Troll;;-2;+3", qty: 1, work: "Print", bani: 100 },
      { order: "#4", item: "Troll; =1+1", qty: 1, work: "Print", bani: 100 },
    ];
    const rows = rowsOf(statementCsv(statementWith({ lines, totalBani: 400 })));
    expect(rows.slice(1, 5).map((row) => row.split(",")[3])).toEqual([
      "Troll;'=1+1",
      "Troll\t'@cmd",
      "Troll;;'-2;'+3",
      "Troll; =1+1",
    ]);
  });

  it("does not let a formula start after a comma inside a quoted cell", () => {
    const lines = [{ order: "#1", item: "Troll,=1+1", qty: 1, work: "Print", bani: 100 }];
    const csv = statementCsv(statementWith({ lines, totalBani: 100 }));
    expect(csv).toContain(`"Troll,'=1+1"`);
  });

  it("treats the full-width formula characters like the plain ones", () => {
    const lines = [
      { order: "#1", item: "＝1+1", qty: 1, work: "Print", bani: 100 },
      { order: "#2", item: "＋SUM(A1)", qty: 1, work: "Print", bani: 100 },
      { order: "#3", item: "－2", qty: 1, work: "Print", bani: 100 },
      { order: "#4", item: "＠cmd", qty: 1, work: "Print", bani: 100 },
      { order: "#5", item: "Troll;＝1", qty: 1, work: "Print", bani: 100 },
    ];
    const rows = rowsOf(statementCsv(statementWith({ lines, totalBani: 500 })));
    expect(rows.slice(1, 6).map((row) => row.split(",")[3])).toEqual([
      "'＝1+1",
      "'＋SUM(A1)",
      "'－2",
      "'＠cmd",
      "Troll;'＝1",
    ]);
  });

  it("leaves a negative amount a number", () => {
    const rows = rowsOf(statementCsv(statementWith({})));
    expect(rows[2]?.endsWith(",-46.20")).toBe(true);
  });
});
