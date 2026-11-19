import { describe, expect, it } from "vitest";
import {
  applyChoice,
  blockingLines,
  defaultChoices,
  listMissingChoices,
  mergeReload,
  menuOptions,
  peopleForMenu,
  rememberChoice,
} from "./choices";
import { buildMonthView } from "./monthView";
import type { MonthFile, MonthLine } from "../storage/monthSchema";
import type { PayoutSettings, StoredChoices, StoredPeople } from "../storage/schemas";

// Every person, product and amount here is made up. Money is in bani: 90.00 is 9000.

const PEOPLE: StoredPeople = {
  version: 1,
  people: [
    {
      id: "printer-a",
      name: "Printer A",
      prints: true,
      paints: false,
      getsPaid: true,
      defaultFor: ["printing"],
    },
    {
      id: "painter-b",
      name: "Painter B",
      prints: false,
      paints: true,
      getsPaid: true,
      defaultFor: ["painting"],
    },
    {
      id: "painter-d",
      name: "Painter D",
      prints: false,
      paints: true,
      getsPaid: true,
      defaultFor: ["drybrush"],
    },
    { id: "farm", name: "Farm", prints: true, paints: false, getsPaid: false, defaultFor: [] },
    {
      id: "both-e",
      name: "Both E",
      prints: true,
      paints: true,
      getsPaid: true,
      defaultFor: [],
    },
  ],
};

const NO_DEFAULTS: StoredPeople = {
  version: 1,
  people: PEOPLE.people.map((person) => ({ ...person, defaultFor: [] })),
};

const NOTHING_REMEMBERED: StoredChoices = { version: 1, byProduct: {} };

const SETTINGS: PayoutSettings = {
  version: 1,
  rates: { feeBp: 300, splitBp: 6000, drybrushBp: 1200, drybrushMinBani: 2000 },
  rule: { includeTags: ["mini"], excludeTags: [], extraProductTitles: [] },
  costTable: [],
  firstMonth: "2031-03",
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
    facts: {
      paidBani: 9000,
      listBani: 9000,
      qty: 1,
      paintOption: "none",
      primedUnitBani: null,
      costBani: 2000,
    },
    tags: [],
    orderWarning: null,
    printedBy: "printer-a",
    paintedBy: null,
    ...overrides,
  };
}

function withPaint(
  paintOption: "primed" | "partial" | "complete",
  overrides: Partial<MonthLine> = {},
) {
  const facts = { ...line({}).facts, paintOption, primedUnitBani: 5000 };
  return line({ facts, ...overrides });
}

function remembering(byProduct: StoredChoices["byProduct"]): StoredChoices {
  return { version: 1, byProduct };
}

describe("defaultChoices: the Settings defaults", () => {
  it("gives the printing default to a plain line and no painter", () => {
    expect(defaultChoices(line({}), PEOPLE.people, NOTHING_REMEMBERED)).toEqual({
      printedBy: "printer-a",
      paintedBy: null,
    });
  });

  it("gives a painted line the painting default", () => {
    const choice = defaultChoices(withPaint("complete"), PEOPLE.people, NOTHING_REMEMBERED);
    expect(choice.paintedBy).toBe("painter-b");
    expect(defaultChoices(withPaint("partial"), PEOPLE.people, NOTHING_REMEMBERED).paintedBy).toBe(
      "painter-b",
    );
  });

  it("gives a primed line the drybrush default, not the painting one", () => {
    const choice = defaultChoices(withPaint("primed"), PEOPLE.people, NOTHING_REMEMBERED);
    expect(choice.paintedBy).toBe("painter-d");
  });

  it("leaves a choice empty when no default is set", () => {
    expect(defaultChoices(withPaint("complete"), NO_DEFAULTS.people, NOTHING_REMEMBERED)).toEqual({
      printedBy: null,
      paintedBy: null,
    });
  });

  it("never gives a painter to a line with no paint option", () => {
    const remembered = remembering({ owl: { printedBy: null, paintedBy: "painter-b" } });
    expect(defaultChoices(line({}), PEOPLE.people, remembered).paintedBy).toBeNull();
  });

  it("ignores a default whose person no longer does the job", () => {
    const stale = PEOPLE.people.map((person) =>
      person.id === "printer-a" ? { ...person, prints: false } : person,
    );
    expect(defaultChoices(line({}), stale, NOTHING_REMEMBERED).printedBy).toBeNull();
  });
});

describe("defaultChoices: remembered per product", () => {
  const remembered = remembering({
    owl: { printedBy: "farm", paintedBy: "both-e" },
    bear: { printedBy: "both-e", paintedBy: null },
  });

  it("beats the Settings default", () => {
    expect(defaultChoices(withPaint("complete"), PEOPLE.people, remembered)).toEqual({
      printedBy: "farm",
      paintedBy: "both-e",
    });
  });

  it("applies to the same product only", () => {
    const other = withPaint("complete", { productId: "stag" });
    expect(defaultChoices(other, PEOPLE.people, remembered)).toEqual({
      printedBy: "printer-a",
      paintedBy: "painter-b",
    });
  });

  it("is used for each part on its own: a part never remembered falls to the default", () => {
    const choice = defaultChoices(
      withPaint("complete", { productId: "bear" }),
      PEOPLE.people,
      remembered,
    );
    expect(choice).toEqual({ printedBy: "both-e", paintedBy: "painter-b" });
  });

  it("falls back when the remembered person was removed", () => {
    const gone = remembering({ owl: { printedBy: "removed", paintedBy: "removed" } });
    expect(defaultChoices(withPaint("complete"), PEOPLE.people, gone)).toEqual({
      printedBy: "printer-a",
      paintedBy: "painter-b",
    });
  });

  it("falls back when the remembered person no longer prints", () => {
    const stopped = PEOPLE.people.map((person) =>
      person.id === "farm" ? { ...person, prints: false } : person,
    );
    expect(defaultChoices(line({}), stopped, remembered).printedBy).toBe("printer-a");
  });

  it("is not used for a line with no product", () => {
    const choice = defaultChoices(line({ productId: null }), PEOPLE.people, remembered);
    expect(choice.printedBy).toBe("printer-a");
  });
});

describe("rememberChoice", () => {
  it("stores the person for the product and the part, keeping the other part", () => {
    const first = rememberChoice(NOTHING_REMEMBERED, "owl", "printedBy", "farm");
    const second = rememberChoice(first, "owl", "paintedBy", "both-e");
    expect(second.byProduct).toEqual({ owl: { printedBy: "farm", paintedBy: "both-e" } });
  });

  it("changes nothing for a line with no product", () => {
    expect(rememberChoice(NOTHING_REMEMBERED, null, "printedBy", "farm")).toEqual(
      NOTHING_REMEMBERED,
    );
  });

  it("does not change the object it was given", () => {
    const before = remembering({ owl: { printedBy: "farm", paintedBy: null } });
    rememberChoice(before, "owl", "printedBy", "both-e");
    expect(before.byProduct.owl?.printedBy).toBe("farm");
  });

  it("forgets a part when it is set to nobody", () => {
    const before = remembering({ owl: { printedBy: "farm", paintedBy: "both-e" } });
    const after = rememberChoice(before, "owl", "printedBy", null);
    expect(after.byProduct.owl).toEqual({ printedBy: null, paintedBy: "both-e" });
  });
});

describe("applyChoice", () => {
  const lines = [line({}), line({ lineId: "line-2", orderId: "order-2" })];

  it("changes the one line named and no other", () => {
    const next = applyChoice(lines, "line-2", "printedBy", "farm");
    expect(next.map((entry) => entry.printedBy)).toEqual(["printer-a", "farm"]);
  });

  it("sets the painter of a painted line", () => {
    const painted = [withPaint("complete")];
    expect(applyChoice(painted, "line-1", "paintedBy", "both-e")[0]?.paintedBy).toBe("both-e");
  });

  it("refuses a painter on a line with no paint option", () => {
    expect(applyChoice(lines, "line-1", "paintedBy", "both-e")[0]?.paintedBy).toBeNull();
  });

  it("can clear a choice", () => {
    expect(applyChoice(lines, "line-1", "printedBy", null)[0]?.printedBy).toBeNull();
  });

  it("throws for a line that is not there", () => {
    expect(() => applyChoice(lines, "nope", "printedBy", "farm")).toThrow("nope");
  });

  it("does not change the lines it was given", () => {
    applyChoice(lines, "line-1", "printedBy", "farm");
    expect(lines[0]?.printedBy).toBe("printer-a");
  });
});

describe("peopleForMenu and menuOptions: who a menu lists", () => {
  it("lists the people who print in Printed by, in the order of the people", () => {
    expect(peopleForMenu("printedBy", PEOPLE.people).map((person) => person.id)).toEqual([
      "printer-a",
      "farm",
      "both-e",
    ]);
  });

  it("lists the people who paint in Painted by", () => {
    expect(peopleForMenu("paintedBy", PEOPLE.people).map((person) => person.id)).toEqual([
      "painter-b",
      "painter-d",
      "both-e",
    ]);
  });

  it("starts with an empty choice and then the names", () => {
    expect(menuOptions("paintedBy", null, PEOPLE.people)).toEqual([
      { value: "", label: "Choose..." },
      { value: "painter-b", label: "Painter B" },
      { value: "painter-d", label: "Painter D" },
      { value: "both-e", label: "Both E" },
    ]);
  });

  it("keeps a chosen person who no longer does the job, and says so", () => {
    const options = menuOptions("printedBy", "painter-b", PEOPLE.people);
    expect(options.at(-1)).toEqual({ value: "painter-b", label: "Painter B (does not print now)" });
  });

  it("does not list a removed person: the menu shows the empty choice", () => {
    const options = menuOptions("printedBy", "removed", PEOPLE.people);
    expect(options.some((option) => option.value === "removed")).toBe(false);
  });

  it("gives a person with no name a readable label", () => {
    const blank = [{ ...PEOPLE.people[0]!, name: "" }];
    expect(menuOptions("printedBy", null, blank)[1]?.label).toBe("(no name)");
  });
});

describe("listMissingChoices: needs a choice", () => {
  it("is empty when both parts are chosen", () => {
    const painted = withPaint("complete", { paintedBy: "painter-b" });
    expect(listMissingChoices(painted, PEOPLE.people)).toEqual([]);
  });

  it("names Printed by when it is empty", () => {
    expect(listMissingChoices(line({ printedBy: null }), PEOPLE.people)).toEqual(["printedBy"]);
  });

  it("names Painted by for a painted line only", () => {
    expect(listMissingChoices(line({ printedBy: "farm" }), PEOPLE.people)).toEqual([]);
    const painted = withPaint("partial", { printedBy: "farm", paintedBy: null });
    expect(listMissingChoices(painted, PEOPLE.people)).toEqual(["paintedBy"]);
  });

  it("counts a removed person as no choice", () => {
    expect(listMissingChoices(line({ printedBy: "removed" }), PEOPLE.people)).toEqual([
      "printedBy",
    ]);
  });
});

describe("mergeReload: a fresh load over an open month", () => {
  const defaulted = (overrides: Partial<MonthLine>) =>
    line({ printedBy: "printer-a", ...overrides });

  it("keeps the choices of lines that are still there, by line id", () => {
    const old = [line({ printedBy: "farm" })];
    const fresh = [defaulted({})];
    expect(mergeReload(old, fresh, PEOPLE.people)[0]?.printedBy).toBe("farm");
  });

  it("takes the new facts but the old choices", () => {
    const old = [line({ printedBy: "farm" })];
    const fresh = [defaulted({ facts: { ...line({}).facts, paidBani: 4000 } })];
    const merged = mergeReload(old, fresh, PEOPLE.people)[0];
    expect(merged?.facts.paidBani).toBe(4000);
    expect(merged?.printedBy).toBe("farm");
  });

  it("gives a new line the default it came with", () => {
    const old = [line({ printedBy: "farm" })];
    const fresh = [defaulted({}), defaulted({ lineId: "line-2", orderId: "order-2" })];
    const merged = mergeReload(old, fresh, PEOPLE.people);
    expect(merged.map((entry) => entry.printedBy)).toEqual(["farm", "printer-a"]);
  });

  it("drops a line that is gone from the fresh load", () => {
    const old = [line({}), line({ lineId: "gone", orderId: "order-9" })];
    const merged = mergeReload(old, [defaulted({})], PEOPLE.people);
    expect(merged.map((entry) => entry.lineId)).toEqual(["line-1"]);
  });

  it("ignores an old choice that points at a removed person", () => {
    const old = [line({ printedBy: "removed" })];
    expect(mergeReload(old, [defaulted({})], PEOPLE.people)[0]?.printedBy).toBe("printer-a");
  });

  it("gives a part that was never chosen the fresh default", () => {
    const old = [line({ printedBy: null })];
    expect(mergeReload(old, [defaulted({})], PEOPLE.people)[0]?.printedBy).toBe("printer-a");
  });

  it("keeps the fresh order of the lines", () => {
    const old = [
      line({ lineId: "b", printedBy: "farm" }),
      line({ lineId: "a", printedBy: "farm" }),
    ];
    const fresh = [defaulted({ lineId: "a" }), defaulted({ lineId: "b" })];
    expect(mergeReload(old, fresh, PEOPLE.people).map((entry) => entry.lineId)).toEqual(["a", "b"]);
  });
});

describe("blockingLines", () => {
  function viewOf(lines: MonthLine[]) {
    const file: MonthFile = {
      version: 1,
      month: "2031-03",
      status: "open",
      timeZone: "UTC",
      loadedAt: "2031-03-20T12:30:00Z",
      lines,
    };
    return buildMonthView(file, SETTINGS, PEOPLE);
  }

  it("counts nothing when every line is fine", () => {
    expect(blockingLines(viewOf([line({})]))).toEqual({ blocked: 0, needsChoice: 0, total: 0 });
  });

  it("counts a blocked line", () => {
    const noCost = line({ facts: { ...line({}).facts, costBani: null } });
    expect(blockingLines(viewOf([noCost]))).toEqual({ blocked: 1, needsChoice: 0, total: 1 });
  });

  it("counts a line that needs a choice", () => {
    const view = viewOf([line({ printedBy: null })]);
    expect(blockingLines(view)).toEqual({ blocked: 0, needsChoice: 1, total: 1 });
  });

  it("counts a line that is both once in the total", () => {
    const both = line({ printedBy: null, facts: { ...line({}).facts, costBani: null } });
    expect(blockingLines(viewOf([both]))).toEqual({ blocked: 1, needsChoice: 1, total: 1 });
  });

  it("counts the two kinds together", () => {
    const noCost = line({ facts: { ...line({}).facts, costBani: null } });
    const empty = line({ lineId: "line-2", orderId: "order-2", printedBy: null });
    const fine = line({ lineId: "line-3", orderId: "order-3" });
    expect(blockingLines(viewOf([noCost, empty, fine]))).toEqual({
      blocked: 1,
      needsChoice: 1,
      total: 2,
    });
  });
});

describe("a changed choice changes the totals", () => {
  const painted = withPaint("complete", {
    facts: {
      paidBani: 62000,
      listBani: 62000,
      qty: 1,
      paintOption: "complete",
      primedUnitBani: 23000,
      costBani: 5300,
    },
    printedBy: "printer-a",
    paintedBy: "painter-b",
  });

  function totalsOf(lines: MonthLine[]) {
    const file: MonthFile = {
      version: 1,
      month: "2031-03",
      status: "open",
      timeZone: "UTC",
      loadedAt: "2031-03-20T12:30:00Z",
      lines,
    };
    const view = buildMonthView(file, SETTINGS, PEOPLE);
    return {
      people: Object.fromEntries(view.people.map((person) => [person.personId, person.total])),
      company: view.company,
    };
  }

  it("pays the new painter and not the old one (the spec's painted figurine)", () => {
    const before = totalsOf([painted]);
    expect(before.people).toEqual({ "printer-a": "102.06", "painter-b": "378.30" });
    expect(before.company).toBe("68.04");
    const after = totalsOf(applyChoice([painted], "line-1", "paintedBy", "both-e"));
    expect(after.people).toEqual({ "printer-a": "102.06", "both-e": "378.30" });
    expect(after.company).toBe("68.04");
  });

  it("moves the print profit to the company when a person who is not paid prints", () => {
    const after = totalsOf(applyChoice([painted], "line-1", "printedBy", "farm"));
    expect(after.people).toEqual({ "painter-b": "378.30" });
    expect(after.company).toBe("170.10");
  });
});
