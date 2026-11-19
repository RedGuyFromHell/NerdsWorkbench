import { describe, expect, it } from "vitest";
import { describeRun } from "./runSummary";
import { defaultVoucherSettings, type VoucherSettings } from "./voucherSettings";

function settingsFor(patch: Partial<VoucherSettings>): VoucherSettings {
  return {
    ...defaultVoucherSettings(new Date(2026, 10, 19)),
    prefix: "SUMMER-",
    savePath: "D:\vouchers",
    ...patch,
  };
}

describe("describeRun", () => {
  it("lists what the run will create, in the order of the screen", () => {
    expect(describeRun(settingsFor({ voucherCount: 100, percentage: 10, usageLimit: 1 }))).toEqual([
      { label: "Codes", value: "100, starting with SUMMER-" },
      { label: "Discount", value: "10 % off" },
      { label: "Applies to", value: "all products" },
      { label: "Min. order", value: "none" },
      { label: "Usage limit", value: "1 per code" },
      { label: "Starts", value: "2026-11-19" },
      { label: "Ends", value: "2026-12-19" },
      { label: "Save folder", value: "D:\vouchers" },
    ]);
  });

  // WARNING: this is money. The window is the last look at the percentage before a live discount.
  it("shows the percentage exactly as it will be sent", () => {
    const valueOf = (percentage: number) =>
      describeRun(settingsFor({ percentage })).find((line) => line.label === "Discount")?.value;

    expect(valueOf(100)).toBe("100 % off");
    expect(valueOf(12.5)).toBe("12.5 % off");
  });

  it("counts the collections when the discount is for specific ones", () => {
    const valueOf = (collectionIds: string[]) =>
      describeRun(settingsFor({ appliesTo: "collection", collectionIds })).find(
        (line) => line.label === "Applies to",
      )?.value;

    expect(valueOf(["gid://shopify/Collection/1"])).toBe("1 collection");
    expect(valueOf(["gid://shopify/Collection/1", "gid://shopify/Collection/2"])).toBe(
      "2 collections",
    );
  });

  it("ignores picked collections when the discount is for all products", () => {
    const lines = describeRun(
      settingsFor({ appliesTo: "all", collectionIds: ["gid://shopify/Collection/1"] }),
    );

    expect(lines.find((line) => line.label === "Applies to")?.value).toBe("all products");
  });

  it("names a minimum order and an unlimited usage", () => {
    const lines = describeRun(settingsFor({ minimumSubtotal: 49.5, usageLimit: 0 }));

    expect(lines.find((line) => line.label === "Min. order")?.value).toBe("49.50 RON");
    expect(lines.find((line) => line.label === "Usage limit")?.value).toBe("unlimited");
  });
});
