import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../storage/schemas";
import {
  addCostRow,
  removeCostRow,
  settingsFromDraft,
  settingsToDraft,
  type SettingsDraft,
} from "./settingsForm";

/** The defaults as a draft with a rule that counts something, then the changes of the test. */
function draft(overrides: Partial<SettingsDraft> = {}): SettingsDraft {
  return { ...settingsToDraft(DEFAULT_SETTINGS), ...overrides };
}

function built(overrides: Partial<SettingsDraft>) {
  const result = settingsFromDraft(draft(overrides));
  if (!result.ok) throw new Error(`expected settings, got: ${result.issues.join(" | ")}`);
  return result.settings;
}

function issuesOf(overrides: Partial<SettingsDraft>): readonly string[] {
  const result = settingsFromDraft(draft(overrides));
  return result.ok ? [] : result.issues;
}

describe("settingsToDraft and settingsFromDraft", () => {
  it("round-trips the defaults", () => {
    const result = settingsFromDraft(settingsToDraft(DEFAULT_SETTINGS));
    expect(result).toEqual({ ok: true, settings: DEFAULT_SETTINGS });
  });

  it("round-trips a full set of settings", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      rates: { feeBp: 250, splitBp: 3333, drybrushBp: 1000, drybrushMinBani: 1250 },
      rule: {
        includeTags: ["alpha", "beta gamma"],
        excludeTags: ["delta"],
        extraProductTitles: ["Product One, large"],
      },
      costTable: [
        { productTitle: "Product Two", sizeValue: "Size X", unitCostBani: 805 },
        { productTitle: "Product Two", sizeValue: null, unitCostBani: 0 },
      ],
      firstMonth: "2030-04",
    };
    expect(settingsFromDraft(settingsToDraft(settings))).toEqual({ ok: true, settings });
  });
});

describe("rates", () => {
  it("turns percent text into basis points and the minimum into bani", () => {
    const settings = built({
      feeText: "2,5",
      splitText: "33.33",
      drybrushText: "10",
      drybrushMinText: "12.5",
    });
    expect(settings.rates).toEqual({
      feeBp: 250,
      splitBp: 3333,
      drybrushBp: 1000,
      drybrushMinBani: 1250,
    });
  });

  it("accepts the ends of the range: 0 and 100", () => {
    expect(built({ splitText: "0" }).rates.splitBp).toBe(0);
    expect(built({ splitText: "100" }).rates.splitBp).toBe(10_000);
  });

  it("refuses a split above 100", () => {
    expect(issuesOf({ splitText: "100.5" })).toEqual([
      "Printer's share must be a percent from 0 to 100, for example 70 or 12.5.",
    ]);
  });

  it("refuses a negative rate and text that is not a number", () => {
    expect(issuesOf({ feeText: "-1" })).toEqual([
      "Payment fee must be a percent from 0 to 100, for example 70 or 12.5.",
    ]);
    expect(issuesOf({ drybrushText: "ten" })).toHaveLength(1);
    expect(issuesOf({ feeText: "" })).toHaveLength(1);
  });

  it("refuses a negative or unreadable drybrush minimum", () => {
    expect(issuesOf({ drybrushMinText: "-5" })).toEqual([
      "Drybrush minimum must be an amount in lei, for example 12 or 12.50.",
    ]);
    expect(issuesOf({ drybrushMinText: "" })).toHaveLength(1);
  });

  it("reports every bad rate, not only the first", () => {
    expect(issuesOf({ feeText: "x", splitText: "y" })).toHaveLength(2);
  });
});

describe("first month", () => {
  it("accepts a month as yyyy-mm, or nothing yet", () => {
    expect(built({ firstMonth: "2031-12" }).firstMonth).toBe("2031-12");
    expect(built({ firstMonth: " 2031-01 " }).firstMonth).toBe("2031-01");
    expect(built({ firstMonth: "" }).firstMonth).toBe("");
  });

  it("refuses anything else", () => {
    for (const text of ["2031-13", "2031-00", "2031-1", "31-01", "2031/01", "january"]) {
      expect(issuesOf({ firstMonth: text })).toEqual([
        "First month must be a month written yyyy-mm, for example 2031-01.",
      ]);
    }
  });
});

describe("the product rule", () => {
  it("reads the two tag lists and the extra products", () => {
    const settings = built({
      includeTagsText: "Alpha, beta",
      excludeTagsText: "",
      extraProductsText: "Product One\nProduct Two",
    });
    expect(settings.rule).toEqual({
      includeTags: ["alpha", "beta"],
      excludeTags: [],
      extraProductTitles: ["Product One", "Product Two"],
    });
  });

  it("refuses no include tag and no extra product together: no line would count", () => {
    expect(issuesOf({ includeTagsText: "", extraProductsText: "" })).toEqual([
      "Add at least one tag or one extra product, or no line will count.",
    ]);
  });

  it("is fine with no tags when an extra product is named", () => {
    expect(issuesOf({ includeTagsText: "", extraProductsText: "Product One" })).toEqual([]);
  });
});

describe("the cost table", () => {
  it("reads rows: title, optional size, cost in lei", () => {
    const settings = built({
      costRows: [
        { productTitle: " Product Two ", sizeValue: " Size X ", costText: "8,05" },
        { productTitle: "Product Two", sizeValue: "", costText: "9" },
      ],
    });
    expect(settings.costTable).toEqual([
      { productTitle: "Product Two", sizeValue: "Size X", unitCostBani: 805 },
      { productTitle: "Product Two", sizeValue: null, unitCostBani: 900 },
    ]);
  });

  it("skips a row left completely blank", () => {
    const blank = { productTitle: "", sizeValue: "", costText: " " };
    expect(built({ costRows: [blank] }).costTable).toEqual([]);
  });

  it("accepts a cost of 0: a free item is a cost", () => {
    const settings = built({
      costRows: [{ productTitle: "Product Two", sizeValue: "", costText: "0" }],
    });
    expect(settings.costTable[0]?.unitCostBani).toBe(0);
  });

  it("asks for a title, naming the row by its position among all rows", () => {
    expect(
      issuesOf({
        costRows: [
          { productTitle: "Product Two", sizeValue: "", costText: "1" },
          { productTitle: "  ", sizeValue: "Size X", costText: "1" },
        ],
      }),
    ).toEqual(["Cost row 2 needs a product title."]);
  });

  it("refuses a missing, negative or unreadable cost", () => {
    for (const costText of ["", "-1", "abc", "1.234"]) {
      expect(
        issuesOf({ costRows: [{ productTitle: "Product Two", sizeValue: "", costText }] }),
      ).toEqual(["Cost row 1 needs a cost in lei, for example 12 or 12.50."]);
    }
  });

  it("refuses two rows for the same product and size, whatever the case and spaces", () => {
    expect(
      issuesOf({
        costRows: [
          { productTitle: "Product Two", sizeValue: "Size X", costText: "1" },
          { productTitle: " product  two", sizeValue: "size x", costText: "2" },
        ],
      }),
    ).toEqual(['Cost rows 1 and 2 are the same product and size ("Product Two", "Size X").']);
  });

  it("allows a row for every size beside a row for one size of the same product", () => {
    expect(
      issuesOf({
        costRows: [
          { productTitle: "Product Two", sizeValue: "Size X", costText: "1" },
          { productTitle: "Product Two", sizeValue: "", costText: "2" },
        ],
      }),
    ).toEqual([]);
  });

  it("refuses two rows for every size of one product", () => {
    expect(
      issuesOf({
        costRows: [
          { productTitle: "Product Two", sizeValue: "", costText: "1" },
          { productTitle: "Product Two", sizeValue: "", costText: "2" },
        ],
      }),
    ).toEqual(['Cost rows 1 and 2 are the same product and size ("Product Two", every size).']);
  });
});

describe("addCostRow and removeCostRow", () => {
  const rows = [
    { productTitle: "Product One", sizeValue: "", costText: "1" },
    { productTitle: "Product Two", sizeValue: "", costText: "2" },
  ];

  it("adds a blank row at the end", () => {
    expect(addCostRow(rows)).toEqual([...rows, { productTitle: "", sizeValue: "", costText: "" }]);
  });

  it("removes the row at the position", () => {
    expect(removeCostRow(rows, 0)).toEqual([rows[1]]);
    expect(removeCostRow(rows, 1)).toEqual([rows[0]]);
  });

  it("throws for a position that is not a row", () => {
    expect(() => removeCostRow(rows, 2)).toThrow(RangeError);
    expect(() => removeCostRow(rows, -1)).toThrow(RangeError);
  });
});
