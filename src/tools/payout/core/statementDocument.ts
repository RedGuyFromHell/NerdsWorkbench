// The statement as a pdfmake document definition: A4, one title, the parts beside a "To pay" box,
// the line list, the rules paragraph, "Paid on" and the id. Pure: no pdfmake import here, only
// the shape it reads, so this is tested without a renderer. A long line list flows onto the
// next page with its header repeated; the footer then names the statement and the page.
import type {
  Content,
  ContentTable,
  DynamicContent,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import { formatLei } from "./formatLei";
import type { Statement } from "./statement";

// #region Look
const INK = "#1b1b1f";
const MUTED = "#4d4955";
const RULE = "#e2ddd0";
const PAY_BOX = "#e8f7ed";
const FONT = "Roboto";
const MARGIN_SIDE = 42;
const MARGIN_TOP = 40;
const MARGIN_BOTTOM = 48;
const EM_DASH = "—";
const PAID_ON_BLANK = "______________";

const lineLayout = {
  hLineWidth: (index: number) => (index === 1 ? 1.5 : 0.5),
  vLineWidth: () => 0,
  hLineColor: (index: number) => (index === 1 ? INK : RULE),
  paddingTop: () => 4,
  paddingBottom: () => 4,
  paddingLeft: () => 4,
  paddingRight: () => 4,
};
const boxLayout = {
  hLineWidth: () => 2,
  vLineWidth: () => 2,
  hLineColor: () => INK,
  vLineColor: () => INK,
  paddingTop: () => 8,
  paddingBottom: () => 8,
  paddingLeft: () => 10,
  paddingRight: () => 10,
};
// #endregion

// #region Pieces
function money(bani: number): string {
  return formatLei(bani);
}

function head(statement: Statement): Content {
  return {
    columns: [
      {
        stack: [
          { text: "Miniatures payout", fontSize: 8, bold: true, color: MUTED, characterSpacing: 1 },
          {
            text: `${statement.personName} ${EM_DASH} ${statement.monthTitle}`,
            fontSize: 20,
            bold: true,
            margin: [0, 4, 0, 0],
          },
        ],
      },
      {
        width: "auto",
        alignment: "right",
        color: MUTED,
        fontSize: 8,
        stack: [{ text: `Closed ${statement.closedText}` }],
      },
    ],
    margin: [0, 0, 0, 6],
  };
}

function rule(): Content {
  return {
    canvas: [{ type: "line", x1: 0, y1: 0, x2: 511, y2: 0, lineWidth: 2, lineColor: INK }],
    margin: [0, 0, 0, 14],
  };
}

function partsAndTotal(statement: Statement): Content {
  return {
    columns: [
      {
        width: "*",
        table: {
          widths: ["*", "auto"],
          body: statement.parts.map((part) => [
            { text: part.label, fontSize: 10 },
            { text: money(part.bani), alignment: "right", fontSize: 10 },
          ]),
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
      {
        width: 160,
        table: {
          widths: ["*"],
          body: [
            [
              {
                fillColor: PAY_BOX,
                stack: [
                  { text: "To pay", fontSize: 8, bold: true, characterSpacing: 1 },
                  {
                    text: `${money(statement.totalBani)} lei`,
                    fontSize: 20,
                    bold: true,
                    margin: [0, 4, 0, 0],
                  },
                ],
              },
            ],
          ],
        },
        layout: boxLayout,
      },
    ],
    columnGap: 18,
    margin: [0, 0, 0, 18],
  };
}

function lineTable(statement: Statement): ContentTable {
  const headerCell = (text: string, alignment: "left" | "right" = "left") => ({
    text,
    alignment,
    bold: true,
    fontSize: 8,
    color: MUTED,
  });
  const cell = (text: string, alignment: "left" | "right" = "left") => ({
    text,
    alignment,
    fontSize: 9,
  });
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: [46, "*", 26, 70, 52],
      body: [
        [
          headerCell("Order"),
          headerCell("Item"),
          headerCell("Qty", "right"),
          headerCell("Work"),
          headerCell("Lei", "right"),
        ],
        ...statement.lines.map((line) => [
          cell(line.order),
          cell(line.item),
          cell(line.qty === null ? "" : String(line.qty), "right"),
          cell(line.work),
          cell(money(line.bani), "right"),
        ]),
      ],
    },
    layout: lineLayout,
  };
}

function foot(statement: Statement): Content[] {
  return [
    {
      text: statement.rules,
      fontSize: 8,
      color: MUTED,
      lineHeight: 1.35,
      margin: [0, 16, 0, 12],
    },
    {
      columns: [
        { text: `Paid on: ${statement.paidOn ?? PAID_ON_BLANK}`, fontSize: 9 },
        { text: statement.id, fontSize: 9, alignment: "right" },
      ],
    },
  ];
}

/** Nothing on a one page statement; on a longer one, which statement and which page. */
function footerOf(statement: Statement): DynamicContent {
  return (currentPage, pageCount) => {
    if (pageCount < 2) return "";
    return {
      text: `${statement.id} · page ${currentPage} of ${pageCount}`,
      alignment: "center",
      fontSize: 8,
      color: MUTED,
      margin: [0, 16, 0, 0],
    };
  };
}
// #endregion

/** The pdfmake document of a statement. The font is Roboto, which pdfmake bundles: it has ș and ț. */
export function buildStatementDocument(statement: Statement): TDocumentDefinitions {
  return {
    info: { title: `${statement.personName} ${EM_DASH} ${statement.monthTitle}` },
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [MARGIN_SIDE, MARGIN_TOP, MARGIN_SIDE, MARGIN_BOTTOM],
    defaultStyle: { font: FONT, fontSize: 10, color: INK },
    content: [
      head(statement),
      rule(),
      partsAndTotal(statement),
      lineTable(statement),
      ...foot(statement),
    ],
    footer: footerOf(statement),
  };
}
