// The CSV of a statement: the same lines as the PDF, for a spreadsheet. A comma between cells,
// CRLF between rows and a UTF-8 byte order mark, so Excel reads ș and ț. Money is plain: a dot,
// two decimals, no thousands mark, an ASCII minus.
import { formatLei } from "./formatLei";
import type { Statement } from "./statement";

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const ROW_END = "\r\n";
const HEADER = ["Statement", "Person", "Order", "Item", "Qty", "Work", "Amount (lei)"];
const NEEDS_QUOTES = /[",\r\n]/;
// WHY: a spreadsheet runs a cell that starts with one of these as a formula, and reads the
// full-width forms as the plain ones. It may also cut a cell at ; , or tab (Romanian Excel splits
// on ;), so the character after one of those starts a cell too.
const STARTS_A_FORMULA = /(?<=^|[;,\t])[=+\-@＝＋－＠\t\r]/g;
const THOUSANDS_MARK = /,/g;
const TYPOGRAPHIC_MINUS = "−";

/** A text cell. Each place a spreadsheet would start a formula at gets an apostrophe in front. */
function textCell(text: string): string {
  const safe = text.replace(STARTS_A_FORMULA, "'$&");
  return NEEDS_QUOTES.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function moneyCell(bani: number): string {
  return formatLei(bani).replace(THOUSANDS_MARK, "").replace(TYPOGRAPHIC_MINUS, "-");
}

/** The whole file as text, byte order mark first. */
export function statementCsv(statement: Statement): string {
  const lead = [statement.id, statement.personName].map(textCell);
  const row = (cells: string[]) => [...lead, ...cells].join(",");
  const rows = [
    HEADER.join(","),
    ...statement.lines.map((line) =>
      row([
        textCell(line.order),
        textCell(line.item),
        line.qty === null ? "" : String(line.qty),
        textCell(line.work),
        moneyCell(line.bani),
      ]),
    ),
    row(["", "", "", "Total", moneyCell(statement.totalBani)]),
  ];
  return `${BYTE_ORDER_MARK}${rows.join(ROW_END)}${ROW_END}`;
}
