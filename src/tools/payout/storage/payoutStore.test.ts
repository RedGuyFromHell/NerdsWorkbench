import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  DEFAULT_CHOICES,
  DEFAULT_PAID_MARKS,
  DEFAULT_PEOPLE,
  DEFAULT_SETTINGS,
  type PayoutSettings,
  type StoredPeople,
} from "./schemas";
import { createMemoryBackend, createMemoryStore, createPayoutStore } from "./payoutStore";

// Made-up values only: the repo is public.
const SETTINGS: PayoutSettings = {
  version: 1,
  rates: { feeBp: 250, splitBp: 6000, drybrushBp: 800, drybrushMinBani: 1200 },
  rule: {
    includeTags: ["mini"],
    excludeTags: ["dice"],
    extraProductTitles: ["Custom resin print"],
  },
  costTable: [
    { productTitle: "Bust", sizeValue: "Large", unitCostBani: 1500 },
    { productTitle: "Statue", sizeValue: null, unitCostBani: 900 },
  ],
  firstMonth: "2026-03",
};

const PEOPLE: StoredPeople = {
  version: 1,
  people: [
    {
      id: "person-a",
      name: "Printer A",
      prints: true,
      paints: false,
      getsPaid: true,
      defaultFor: ["printing"],
    },
    {
      id: "person-b",
      name: "Painter B",
      prints: false,
      paints: true,
      getsPaid: true,
      defaultFor: ["painting", "drybrush"],
    },
  ],
};

const MONTH_SCHEMA = z.object({ version: z.literal(1), status: z.string(), note: z.string() });

describe("the defaults", () => {
  it("hold no rate, no person and no first month, only the spec's tags", () => {
    expect(DEFAULT_SETTINGS.rates).toEqual({
      feeBp: 0,
      splitBp: 0,
      drybrushBp: 0,
      drybrushMinBani: 0,
    });
    expect(DEFAULT_SETTINGS.costTable).toEqual([]);
    expect(DEFAULT_SETTINGS.firstMonth).toBe("");
    expect(DEFAULT_SETTINGS.rule).toEqual({
      includeTags: ["mini", "figurine", "statue", "resin"],
      excludeTags: ["filament", "dice"],
      extraProductTitles: [],
    });
    expect(DEFAULT_PEOPLE.people).toEqual([]);
    expect(DEFAULT_CHOICES.byProduct).toEqual({});
    expect(DEFAULT_PAID_MARKS.marks).toEqual([]);
  });
});

describe("a missing file", () => {
  it("reads as the defaults, for each of the four files", async () => {
    const store = createMemoryStore();
    expect(await store.readSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await store.readPeople()).toEqual(DEFAULT_PEOPLE);
    expect(await store.readChoices()).toEqual(DEFAULT_CHOICES);
    expect(await store.readPaidMarks()).toEqual(DEFAULT_PAID_MARKS);
  });

  it("gives a copy: changing what was read does not change the next default", async () => {
    const store = createMemoryStore();
    const first = await store.readSettings();
    first.rule.includeTags.push("changed");
    expect((await store.readSettings()).rule.includeTags).not.toContain("changed");
  });

  it("reads a month as null", async () => {
    expect(await createMemoryStore().readMonth("2026-03", MONTH_SCHEMA)).toBeNull();
  });
});

describe("a round trip", () => {
  it("brings settings back as written", async () => {
    const store = createMemoryStore();
    await store.writeSettings(SETTINGS);
    expect(await store.readSettings()).toEqual(SETTINGS);
  });

  it("brings people back as written", async () => {
    const store = createMemoryStore();
    await store.writePeople(PEOPLE);
    expect(await store.readPeople()).toEqual(PEOPLE);
  });

  it("brings the remembered choices back as written", async () => {
    const store = createMemoryStore();
    const choices = {
      version: 1 as const,
      byProduct: { "product-1": { printedBy: "person-a", paintedBy: null } },
    };
    await store.writeChoices(choices);
    expect(await store.readChoices()).toEqual(choices);
  });

  it("brings the paid marks back as written", async () => {
    const store = createMemoryStore();
    const marks = {
      version: 1 as const,
      marks: [{ month: "2026-03", personId: "person-a", paidOn: "2026-04-05" }],
    };
    await store.writePaidMarks(marks);
    expect(await store.readPaidMarks()).toEqual(marks);
  });

  it("brings a month back, and lists the months that have a file, oldest first", async () => {
    const store = createMemoryStore();
    const month = { version: 1 as const, status: "open", note: "first" };
    await store.writeMonth("2026-04", MONTH_SCHEMA, month);
    await store.writeMonth("2026-03", MONTH_SCHEMA, { ...month, note: "second" });
    expect(await store.readMonth("2026-03", MONTH_SCHEMA)).toEqual({ ...month, note: "second" });
    expect(await store.listMonthKeys()).toEqual(["2026-03", "2026-04"]);
  });

  it("keeps the files under payout/ in the layout the plan names", async () => {
    const backend = createMemoryBackend();
    const store = createPayoutStore(backend);
    await store.writeSettings(SETTINGS);
    await store.writePeople(PEOPLE);
    await store.writeChoices(DEFAULT_CHOICES);
    await store.writePaidMarks(DEFAULT_PAID_MARKS);
    await store.writeMonth("2026-03", MONTH_SCHEMA, { version: 1, status: "open", note: "" });
    expect([...backend.files.keys()].sort()).toEqual([
      "payout/choices.json",
      "payout/months/2026-03.json",
      "payout/paid-marks.json",
      "payout/people.json",
      "payout/settings.json",
    ]);
  });
});

describe("a file that cannot be trusted", () => {
  it("throws with the file name when the text is not JSON, and keeps the file", async () => {
    const backend = createMemoryBackend({ "payout/settings.json": "{ not json" });
    const store = createPayoutStore(backend);
    await expect(store.readSettings()).rejects.toThrow("payout/settings.json");
    expect(backend.files.get("payout/settings.json")).toBe("{ not json");
  });

  it("throws with the file name when a field has the wrong shape", async () => {
    const wrong = { ...SETTINGS, rates: { ...SETTINGS.rates, feeBp: "two" } };
    const backend = createMemoryBackend({ "payout/settings.json": JSON.stringify(wrong) });
    await expect(createPayoutStore(backend).readSettings()).rejects.toThrow("payout/settings.json");
  });

  it("throws on a version this app does not know, naming the file and the version", async () => {
    const backend = createMemoryBackend({
      "payout/people.json": JSON.stringify({ ...PEOPLE, version: 2 }),
    });
    const failure = createPayoutStore(backend).readPeople();
    await expect(failure).rejects.toThrow("payout/people.json");
    await expect(failure).rejects.toThrow("version 2");
  });

  it("throws on a file with no version at all", async () => {
    const backend = createMemoryBackend({
      "payout/choices.json": JSON.stringify({ byProduct: {} }),
    });
    await expect(createPayoutStore(backend).readChoices()).rejects.toThrow("payout/choices.json");
  });

  it("throws on a month that fails the schema it is read with, naming that month's file", async () => {
    const backend = createMemoryBackend({
      "payout/months/2026-03.json": JSON.stringify({ version: 1, status: 5 }),
    });
    await expect(createPayoutStore(backend).readMonth("2026-03", MONTH_SCHEMA)).rejects.toThrow(
      "payout/months/2026-03.json",
    );
  });

  it("never writes a value that fails its schema", async () => {
    const backend = createMemoryBackend();
    const store = createPayoutStore(backend);
    const broken = { ...SETTINGS, firstMonth: "March" };
    await expect(store.writeSettings(broken)).rejects.toThrow("payout/settings.json");
    expect(backend.files.size).toBe(0);
  });

  it("refuses a month key that is not yyyy-mm, so no odd path is ever built", async () => {
    const store = createMemoryStore();
    const month = { version: 1 as const, status: "open", note: "" };
    await expect(store.readMonth("../settings", MONTH_SCHEMA)).rejects.toThrow("../settings");
    await expect(store.writeMonth("2026-13", MONTH_SCHEMA, month)).rejects.toThrow("2026-13");
  });
});

describe("the settings schema", () => {
  it("accepts an empty first month and a yyyy-mm one", async () => {
    const store = createMemoryStore();
    await store.writeSettings({ ...SETTINGS, firstMonth: "" });
    await store.writeSettings({ ...SETTINGS, firstMonth: "2026-12" });
  });

  it("refuses a rate that is not a whole number of basis points", async () => {
    const store = createMemoryStore();
    await expect(
      store.writeSettings({ ...SETTINGS, rates: { ...SETTINGS.rates, splitBp: 62.5 } }),
    ).rejects.toThrow("payout/settings.json");
  });
});

describe("the lock of a closed month", () => {
  const closed = { version: 1 as const, status: "closed", note: "locked" };

  it("lets an open month be written again, and be closed once", async () => {
    const store = createMemoryStore();
    await store.writeMonth("2026-03", MONTH_SCHEMA, { version: 1, status: "open", note: "a" });
    await store.writeMonth("2026-03", MONTH_SCHEMA, { version: 1, status: "open", note: "b" });
    await store.writeMonth("2026-03", MONTH_SCHEMA, closed);
    expect(await store.readMonth("2026-03", MONTH_SCHEMA)).toEqual(closed);
  });

  it("throws on any write over a closed month, and keeps the file as it was", async () => {
    const backend = createMemoryBackend();
    const store = createPayoutStore(backend);
    await store.writeMonth("2026-03", MONTH_SCHEMA, closed);
    const before = backend.files.get("payout/months/2026-03.json");
    const reopen = store.writeMonth("2026-03", MONTH_SCHEMA, { ...closed, status: "open" });
    await expect(reopen).rejects.toThrow("payout/months/2026-03.json");
    await expect(reopen).rejects.toThrow("closed");
    await expect(store.writeMonth("2026-03", MONTH_SCHEMA, closed)).rejects.toThrow("closed");
    expect(backend.files.get("payout/months/2026-03.json")).toBe(before);
  });

  it("does not lock the other months", async () => {
    const store = createMemoryStore();
    await store.writeMonth("2026-03", MONTH_SCHEMA, closed);
    await store.writeMonth("2026-04", MONTH_SCHEMA, { version: 1, status: "open", note: "" });
    expect(await store.listMonthKeys()).toEqual(["2026-03", "2026-04"]);
  });
});

describe("paid marks", () => {
  async function storeWithMonths() {
    const backend = createMemoryBackend();
    const store = createPayoutStore(backend);
    await store.writeMonth("2026-03", MONTH_SCHEMA, { version: 1, status: "closed", note: "" });
    await store.writeMonth("2026-04", MONTH_SCHEMA, { version: 1, status: "open", note: "" });
    return { backend, store };
  }

  it("marks a person paid for a closed month, with the date", async () => {
    const { store } = await storeWithMonths();
    await store.markPaid("2026-03", "person-a", "2026-04-05");
    await store.markPaid("2026-03", "person-b", "2026-04-06");
    expect((await store.readPaidMarks()).marks).toEqual([
      { month: "2026-03", personId: "person-a", paidOn: "2026-04-05" },
      { month: "2026-03", personId: "person-b", paidOn: "2026-04-06" },
    ]);
  });

  it("keeps one mark per person and month: a second mark replaces the date", async () => {
    const { store } = await storeWithMonths();
    await store.markPaid("2026-03", "person-a", "2026-04-05");
    await store.markPaid("2026-03", "person-a", "2026-04-09");
    expect((await store.readPaidMarks()).marks).toEqual([
      { month: "2026-03", personId: "person-a", paidOn: "2026-04-09" },
    ]);
  });

  it("refuses a mark on an open month and on a month with no file", async () => {
    const { store } = await storeWithMonths();
    await expect(store.markPaid("2026-04", "person-a", "2026-05-02")).rejects.toThrow("2026-04");
    await expect(store.markPaid("2026-05", "person-a", "2026-06-02")).rejects.toThrow("2026-05");
    expect((await store.readPaidMarks()).marks).toEqual([]);
  });

  it("refuses a date that is not yyyy-mm-dd", async () => {
    const { store } = await storeWithMonths();
    await expect(store.markPaid("2026-03", "person-a", "5 April")).rejects.toThrow(
      "payout/paid-marks.json",
    );
    expect((await store.readPaidMarks()).marks).toEqual([]);
  });

  it("clears the mark of one person and leaves the others, and never touches the month", async () => {
    const { backend, store } = await storeWithMonths();
    const monthBefore = backend.files.get("payout/months/2026-03.json");
    await store.markPaid("2026-03", "person-a", "2026-04-05");
    await store.markPaid("2026-03", "person-b", "2026-04-06");
    await store.clearPaid("2026-03", "person-a");
    expect((await store.readPaidMarks()).marks).toEqual([
      { month: "2026-03", personId: "person-b", paidOn: "2026-04-06" },
    ]);
    expect(backend.files.get("payout/months/2026-03.json")).toBe(monthBefore);
  });
});
