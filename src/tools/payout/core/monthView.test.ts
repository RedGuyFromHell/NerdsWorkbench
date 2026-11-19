import { describe, expect, it } from "vitest";
import { buildMonthView } from "./monthView";
import type { LineRowView, MonthView } from "./monthView";
import type { MonthFile, MonthLine } from "../storage/monthSchema";
import type { PayoutSettings, StoredPeople } from "../storage/schemas";

// Every person, product and amount here is made up. Money is in bani: 620.00 is 62000.
// Rates are the spec's worked example: fee 3%, split 60%, drybrush 12% with a minimum of 20.00.

const SETTINGS: PayoutSettings = {
  version: 1,
  rates: { feeBp: 300, splitBp: 6000, drybrushBp: 1200, drybrushMinBani: 2000 },
  rule: { includeTags: ["mini"], excludeTags: [], extraProductTitles: [] },
  costTable: [],
  firstMonth: "2031-03",
};

const PEOPLE: StoredPeople = {
  version: 1,
  people: [
    {
      id: "printer-a",
      name: "Printer A",
      prints: true,
      paints: true,
      getsPaid: true,
      defaultFor: [],
    },
    {
      id: "painter-b",
      name: "Painter B",
      prints: false,
      paints: true,
      getsPaid: true,
      defaultFor: [],
    },
    { id: "farm", name: "Farm", prints: true, paints: false, getsPaid: false, defaultFor: [] },
    { id: "owner", name: "Owner C", prints: false, paints: true, getsPaid: false, defaultFor: [] },
  ],
};

const PLAIN_FACTS: MonthLine["facts"] = {
  paidBani: 9000,
  listBani: 9000,
  qty: 1,
  paintOption: "none",
  primedUnitBani: null,
  costBani: 2000,
};

function line(overrides: Partial<MonthLine>): MonthLine {
  return {
    orderId: "order-1",
    orderName: "#1001",
    orderCreatedAt: "2031-03-02T10:00:00Z",
    lineId: "line-1",
    productId: "owl",
    productTitle: "Moon Owl",
    variantTitle: "Small",
    facts: PLAIN_FACTS,
    tags: [],
    orderWarning: null,
    printedBy: "printer-a",
    paintedBy: null,
    ...overrides,
  };
}

/** The spec's painted figurine: paid 620.00, primed 230.00, cost 53.00. */
const PAINTED_LINE = line({
  orderId: "order-2",
  orderName: "#1002",
  orderCreatedAt: "2031-03-05T10:00:00Z",
  lineId: "line-painted",
  productTitle: "Stone Golem",
  variantTitle: "15 cm / Complete Paint Job",
  facts: {
    paidBani: 62000,
    listBani: 62000,
    qty: 1,
    paintOption: "complete",
    primedUnitBani: 23000,
    costBani: 5300,
  },
  paintedBy: "printer-a",
});

/** The spec's primed bust: paid 70.00, cost 22.00, the minimum drybrush of 20.00 applies. */
const PRIMED_LINE = line({
  orderId: "order-3",
  orderName: "#1003",
  orderCreatedAt: "2031-03-08T10:00:00Z",
  lineId: "line-primed",
  productTitle: "Brass Heron Bust",
  variantTitle: "10 cm / Primed & Drybrushed",
  facts: {
    paidBani: 7000,
    listBani: 7000,
    qty: 1,
    paintOption: "primed",
    primedUnitBani: 7000,
    costBani: 2200,
  },
  paintedBy: "painter-b",
});

function monthFile(lines: MonthLine[], timeZone = "UTC"): MonthFile {
  return {
    version: 1,
    month: "2031-03",
    status: "open",
    timeZone,
    loadedAt: "2031-03-20T12:30:00Z",
    lines,
  };
}

function view(lines: MonthLine[]): MonthView {
  return buildMonthView(monthFile(lines), SETTINGS, PEOPLE);
}

function onlyLine(monthView: MonthView) {
  const row = monthView.orders[0]?.lines[0];
  if (row === undefined) throw new Error("The view has no line.");
  return row;
}

describe("buildMonthView: the month", () => {
  it("names the month and counts the lines and the orders", () => {
    const monthView = view([PAINTED_LINE, PRIMED_LINE]);
    expect(monthView.title).toBe("March 2031");
    expect(monthView.lineCount).toBe(2);
    expect(monthView.orderCount).toBe(2);
    expect(monthView.statusText).toBe("March 2031: 2 lines in 2 orders");
  });

  it("is empty, not broken, for a month with no line", () => {
    const monthView = view([]);
    expect(monthView.orders).toEqual([]);
    expect(monthView.people).toEqual([]);
    expect(monthView.paid).toBe("0.00");
    expect(monthView.company).toBe("0.00");
    expect(monthView.statusText).toBe("March 2031: no lines");
  });
});

describe("buildMonthView: orders", () => {
  it("groups the lines of one order even when the file lists them apart", () => {
    const first = line({ lineId: "a" });
    const other = line({ orderId: "order-9", orderName: "#1009", lineId: "b" });
    const second = line({ lineId: "c" });
    const monthView = view([first, other, second]);
    expect(monthView.orders.map((order) => order.lines.map((row) => row.lineId))).toEqual([
      ["a", "c"],
      ["b"],
    ]);
  });

  it("puts the orders in date order", () => {
    const late = line({ orderId: "late", orderCreatedAt: "2031-03-20T08:00:00Z", lineId: "l-1" });
    const early = line({ orderId: "early", orderCreatedAt: "2031-03-03T08:00:00Z", lineId: "e-1" });
    const monthView = view([late, early]);
    expect(monthView.orders.map((order) => order.orderId)).toEqual(["early", "late"]);
  });

  it("shows the day of the order in the time zone of the month file", () => {
    const monthView = buildMonthView(
      monthFile([line({ orderCreatedAt: "2031-03-31T23:30:00Z" })], "Europe/Bucharest"),
      SETTINGS,
      PEOPLE,
    );
    expect(monthView.orders[0]?.dateText).toBe("1 Apr");
  });

  it("marks an order not paid yet and an order with a refund tied to no line", () => {
    const monthView = view([
      line({ tags: ["not-paid-yet"], orderWarning: "refund-without-lines" }),
    ]);
    const order = monthView.orders[0];
    expect(order?.notPaidYet).toBe(true);
    expect(order?.warning).toBe("Refund without lines: check it by hand");
    expect(monthView.notices).toContain(
      "1 order has a refund that is not tied to a line: check it by hand.",
    );
  });
});

describe("buildMonthView: a line", () => {
  it("shows the spec's painted figurine, rounded for display", () => {
    const row = onlyLine(view([PAINTED_LINE]));
    expect(row.productTitle).toBe("Stone Golem");
    expect(row.qty).toBe(1);
    expect(row.paid).toBe("620.00");
    expect(row.fee).toBe("18.60");
    expect(row.cost).toBe("53.00");
    expect(row.company).toBe("68.04");
    expect(row.owed).toEqual([{ personId: "printer-a", name: "Printer A", amount: "480.36" }]);
    expect(row.printedByName).toBe("Printer A");
    expect(row.paintedByName).toBe("Printer A");
  });

  it("splits the owed money by person, in the order of the people", () => {
    const row = onlyLine(view([PRIMED_LINE]));
    expect(row.owed).toEqual([
      { personId: "printer-a", name: "Printer A", amount: "15.54" },
      { personId: "painter-b", name: "Painter B", amount: "20.00" },
    ]);
  });

  it("has no painter for a line with no paint option", () => {
    const row = onlyLine(view([line({})]));
    expect(row.hasPaintPart).toBe(false);
    expect(row.paintedByName).toBeNull();
  });

  it("shows a choice not made yet as no name, and a removed person as unknown", () => {
    const notChosen = onlyLine(view([{ ...PRIMED_LINE, printedBy: null }]));
    expect(notChosen.printedByName).toBeNull();
    const removed = onlyLine(view([{ ...PRIMED_LINE, printedBy: "gone" }]));
    expect(removed.printedByName).toBe("Unknown person");
  });

  it("lists the steps of the maths as label and value pairs", () => {
    const row = onlyLine(view([PAINTED_LINE]));
    expect(row.steps).toEqual([
      { label: "Print part", value: "230.00" },
      { label: "Fee on the print part", value: "6.90" },
      { label: "Cost", value: "53.00" },
      { label: "Profit", value: "170.10" },
      { label: "Printer share", value: "102.06" },
      { label: "Company part of the print", value: "68.04" },
      { label: "Paint part", value: "390.00" },
      { label: "Fee on the paint part", value: "11.70" },
      { label: "Painter", value: "378.30" },
    ]);
  });

  it("adds the drybrush step to a primed line and leaves the paint steps out", () => {
    const labels = onlyLine(view([PRIMED_LINE])).steps.map((step) => step.label);
    expect(labels).toEqual([
      "Print part",
      "Fee on the print part",
      "Cost",
      "Drybrush",
      "Profit",
      "Printer share",
      "Company part of the print",
    ]);
  });

  it("blocks a line with no cost: question marks, and no money in any total", () => {
    const noCost = line({ facts: { ...PLAIN_FACTS, costBani: null } });
    const monthView = view([noCost, PRIMED_LINE]);
    const row = monthView.orders[0]?.lines[0];
    expect(row?.status).toBe("blocked");
    expect(row?.blockedText).toBe("no cost");
    expect([row?.fee, row?.cost, row?.company]).toEqual(["?", "?", "?"]);
    expect(row?.owed).toEqual([]);
    expect(row?.steps).toEqual([]);
    expect(row?.paid).toBe("90.00");
    expect(monthView.blockedLines).toBe(1);
    expect(monthView.paid).toBe("70.00");
    expect(monthView.notices).toEqual(["1 line is blocked: no cost."]);
    expect(monthView.statusText).toBe("March 2031: 2 lines in 2 orders, 1 blocked");
  });

  it("says why painted lines with no primed price are blocked, and counts them", () => {
    const noPrimedPrice = { ...PAINTED_LINE.facts, primedUnitBani: null };
    const monthView = view([
      { ...PAINTED_LINE, facts: noPrimedPrice },
      { ...PAINTED_LINE, lineId: "second", facts: noPrimedPrice },
    ]);
    expect(monthView.notices).toEqual(["2 lines are blocked: no primed price."]);
  });
});

describe("buildMonthView: tags", () => {
  it("says the drybrush minimum with the two amounts, in the Painted by cell", () => {
    expect(onlyLine(view([PRIMED_LINE])).tags).toEqual([
      {
        id: "min-drybrush",
        label: "drybrush: minimum",
        title: "12% would be 8.40; the minimum is 20.00",
        tone: "good",
        place: "painted",
      },
    ]);
  });

  it("puts stays-in-company under the person whose part stays, one tag per person", () => {
    const places = (row: LineRowView) =>
      row.tags.filter((tag) => tag.id === "stays-in-company").map((tag) => tag.place);
    // The farm prints, a paid person paints: only the printer's part stays.
    expect(places(onlyLine(view([{ ...PRIMED_LINE, printedBy: "farm" }])))).toEqual(["printed"]);
    // A paid person prints, the owner paints: only the painter's part stays.
    expect(places(onlyLine(view([{ ...PAINTED_LINE, paintedBy: "owner" }])))).toEqual(["painted"]);
    // Both unpaid: both cells say it.
    const both = { ...PAINTED_LINE, printedBy: "farm", paintedBy: "owner" };
    expect(places(onlyLine(view([both])))).toEqual(["printed", "painted"]);
    // No paint part: the printer's cell.
    expect(places(onlyLine(view([line({ printedBy: "farm" })])))).toEqual(["printed"]);
  });

  it("puts cost from table, loss and the blocked reason next to the product", () => {
    const fromTable = onlyLine(view([line({ tags: ["cost-from-table"] })])).tags;
    expect(fromTable).toEqual([
      expect.objectContaining({ id: "cost-from-table", place: "product", tone: "warn" }),
    ]);
    const loss = onlyLine(view([line({ facts: { ...PLAIN_FACTS, costBani: 90000 } })])).tags;
    expect(loss).toEqual([expect.objectContaining({ id: "loss", place: "product" })]);
    const blocked = onlyLine(view([line({ facts: { ...PLAIN_FACTS, costBani: null } })])).tags;
    expect(blocked).toEqual([
      expect.objectContaining({ id: "no-cost", place: "product", tone: "danger" }),
    ]);
  });

  it("keeps the tags in a fixed order whatever order they were found in", () => {
    // A farm prints a primed line sold below cost, with a table cost: four tags at once.
    const row = onlyLine(
      view([
        {
          ...PRIMED_LINE,
          printedBy: "farm",
          tags: ["cost-from-table"],
          facts: { ...PRIMED_LINE.facts, costBani: 90000 },
        },
      ]),
    );
    expect(row.tags.map((tag) => tag.id)).toEqual([
      "loss",
      "min-drybrush",
      "cost-from-table",
      "stays-in-company",
    ]);
  });
});

describe("buildMonthView: totals", () => {
  const monthView = view([PAINTED_LINE, PRIMED_LINE]);

  it("gives each person what the month adds up to, rounded once", () => {
    expect(monthView.people).toEqual([
      {
        personId: "printer-a",
        name: "Printer A",
        print: "117.60",
        paint: "378.30",
        drybrush: "0.00",
        corrections: "0.00",
        total: "495.90",
      },
      {
        personId: "painter-b",
        name: "Painter B",
        print: "0.00",
        paint: "0.00",
        drybrush: "20.00",
        corrections: "0.00",
        total: "20.00",
      },
    ]);
  });

  it("adds up to the money paid: people, company, fees and costs", () => {
    expect(monthView.paid).toBe("690.00");
    expect(monthView.company).toBe("78.40");
    expect(monthView.fees).toBe("20.70");
    expect(monthView.costs).toBe("75.00");
  });

  it("leaves a person removed from Settings with no total: their share is the company's", () => {
    const orphan = buildMonthView(monthFile([PRIMED_LINE]), SETTINGS, { version: 1, people: [] });
    expect(orphan.people).toEqual([]);
    expect(orphan.company).toBe("45.90");
  });
});

describe("buildMonthView: the menus and needs a choice", () => {
  const EMPTY_PAINTER = { ...PAINTED_LINE, paintedBy: null };

  it("gives each menu its chosen person and the people who do the job", () => {
    const row = onlyLine(view([PAINTED_LINE]));
    expect(row.printedValue).toBe("printer-a");
    expect(row.paintedValue).toBe("printer-a");
    expect(row.printedOptions.map((option) => option.value)).toEqual(["", "printer-a", "farm"]);
    expect(row.paintedOptions.map((option) => option.value)).toEqual([
      "",
      "printer-a",
      "painter-b",
      "owner",
    ]);
  });

  it("shows a removed person as nobody in the menu", () => {
    const row = onlyLine(view([{ ...PAINTED_LINE, printedBy: "gone" }]));
    expect(row.printedValue).toBe("");
    expect(row.printedOptions.some((option) => option.value === "gone")).toBe(false);
  });

  it("marks the empty menu and puts the tag under that menu", () => {
    const row = onlyLine(view([EMPTY_PAINTER]));
    expect(row.missingChoices).toEqual(["paintedBy"]);
    const needs = row.tags.filter((tag) => tag.id === "needs-choice");
    expect(needs.map((tag) => [tag.label, tag.place, tag.tone])).toEqual([
      ["needs a choice", "painted", "danger"],
    ]);
  });

  it("puts one tag under each empty menu", () => {
    const row = onlyLine(view([{ ...PAINTED_LINE, printedBy: null, paintedBy: null }]));
    expect(row.tags.filter((tag) => tag.id === "needs-choice").map((tag) => tag.place)).toEqual([
      "printed",
      "painted",
    ]);
  });

  it("does not ask for a painter on a line with no paint", () => {
    const row = onlyLine(view([line({ printedBy: "farm" })]));
    expect(row.missingChoices).toEqual([]);
    expect(row.tags.some((tag) => tag.id === "needs-choice")).toBe(false);
  });

  it("counts the lines, adds a notice and says it in the status text", () => {
    const monthView = view([
      EMPTY_PAINTER,
      { ...PRIMED_LINE, printedBy: null },
      line({ lineId: "line-ok", orderId: "order-9", orderName: "#1009" }),
    ]);
    expect(monthView.needsChoiceLines).toBe(2);
    expect(monthView.notices).toEqual([
      "2 lines need a person chosen for Printed by or Painted by.",
    ]);
    expect(monthView.statusText).toBe("March 2031: 3 lines in 3 orders, 2 need a choice");
  });

  it("still pays nobody for an empty menu: the part stays in the company", () => {
    const monthView = view([EMPTY_PAINTER]);
    expect(monthView.people.map((person) => person.personId)).toEqual(["printer-a"]);
    expect(monthView.company).toBe("446.34");
  });
});
