import { describe, expect, it } from "vitest";
import {
  buildDiscountInput,
  buildDiscountTitle,
  formatMinimumSubtotal,
  type DiscountSettings,
} from "./discountInput";

const BASE: DiscountSettings = {
  title: "Workbench — SUMMER-",
  firstCode: "SUMMER-AB12CD34",
  percentage: 10,
  appliesTo: "all",
  collectionIds: [],
  minimumSubtotal: 0,
  usageLimit: 0,
  oncePerCustomer: false,
  startsAt: "2026-07-01T00:00:00Z",
  endsAt: null,
};

describe("buildDiscountInput", () => {
  it("builds the whole input for a plain all-products discount", () => {
    expect(buildDiscountInput(BASE)).toStrictEqual({
      title: "Workbench — SUMMER-",
      code: "SUMMER-AB12CD34",
      startsAt: "2026-07-01T00:00:00Z",
      customerGets: { value: { percentage: 0.1 }, items: { all: true } },
      customerSelection: { all: true },
      appliesOncePerCustomer: false,
      combinesWith: {
        orderDiscounts: false,
        productDiscounts: true,
        shippingDiscounts: true,
      },
    });
  });

  it("divides the percentage by 100", () => {
    expect(buildDiscountInput({ ...BASE, percentage: 25 }).customerGets.value.percentage).toBe(
      0.25,
    );
    expect(buildDiscountInput({ ...BASE, percentage: 7.5 }).customerGets.value.percentage).toBe(
      0.075,
    );
  });

  it("applies to chosen collections, given as ready-made ids", () => {
    const input = buildDiscountInput({
      ...BASE,
      appliesTo: "collection",
      collectionIds: ["gid://shopify/Collection/111", "gid://shopify/Collection/222"],
    });

    expect(input.customerGets.items).toStrictEqual({
      collections: { add: ["gid://shopify/Collection/111", "gid://shopify/Collection/222"] },
    });
  });

  it("turns numeric ids into collection ids, numbers and digit strings alike", () => {
    const input = buildDiscountInput({
      ...BASE,
      appliesTo: "collection",
      collectionIds: [111, "222", "gid://shopify/Collection/333"],
    });

    expect(input.customerGets.items).toStrictEqual({
      collections: {
        add: [
          "gid://shopify/Collection/111",
          "gid://shopify/Collection/222",
          "gid://shopify/Collection/333",
        ],
      },
    });
  });

  it("ignores the chosen collections when it applies to all products", () => {
    const input = buildDiscountInput({ ...BASE, collectionIds: [111] });

    expect(input.customerGets.items).toStrictEqual({ all: true });
  });

  it("falls back to all products when collections are chosen but none is picked", () => {
    // The old app did this; the screen has to stop it before it reaches here.
    const input = buildDiscountInput({ ...BASE, appliesTo: "collection", collectionIds: [] });

    expect(input.customerGets.items).toStrictEqual({ all: true });
  });

  it("combines with product and shipping discounts, never another order discount", () => {
    expect(buildDiscountInput(BASE).combinesWith).toStrictEqual({
      orderDiscounts: false,
      productDiscounts: true,
      shippingDiscounts: true,
    });
  });

  it("passes the once-per-customer flag through", () => {
    expect(buildDiscountInput({ ...BASE, oncePerCustomer: true }).appliesOncePerCustomer).toBe(
      true,
    );
  });

  it("adds a usage limit only when it is above zero", () => {
    expect(buildDiscountInput({ ...BASE, usageLimit: 0 })).not.toHaveProperty("usageLimit");
    expect(buildDiscountInput({ ...BASE, usageLimit: 1 }).usageLimit).toBe(1);
  });

  it("adds a minimum subtotal only when it is above zero, with two decimals", () => {
    expect(buildDiscountInput({ ...BASE, minimumSubtotal: 0 })).not.toHaveProperty(
      "minimumRequirement",
    );
    expect(buildDiscountInput({ ...BASE, minimumSubtotal: 150 }).minimumRequirement).toStrictEqual({
      subtotal: { greaterThanOrEqualToSubtotal: "150.00" },
    });
    expect(buildDiscountInput({ ...BASE, minimumSubtotal: 99.9 }).minimumRequirement).toStrictEqual(
      { subtotal: { greaterThanOrEqualToSubtotal: "99.90" } },
    );
  });

  it("adds an end date only when one is set", () => {
    expect(buildDiscountInput({ ...BASE, endsAt: null })).not.toHaveProperty("endsAt");
    expect(buildDiscountInput({ ...BASE, endsAt: "" })).not.toHaveProperty("endsAt");
    expect(buildDiscountInput({ ...BASE, endsAt: "2026-07-31T23:59:59Z" }).endsAt).toBe(
      "2026-07-31T23:59:59Z",
    );
  });
});

describe("formatMinimumSubtotal", () => {
  it("writes two decimals", () => {
    expect(formatMinimumSubtotal(150)).toBe("150.00");
    expect(formatMinimumSubtotal(99.9)).toBe("99.90");
    expect(formatMinimumSubtotal(0.01)).toBe("0.01");
  });

  it("rounds an exact half cent to the even cent, like Python's format", () => {
    // 0.125, 0.375, 0.625 and 0.875 are exact in binary: Python gives 0.12, 0.38, 0.62, 0.88,
    // while toFixed(2) would give 0.13, 0.38, 0.63, 0.88.
    expect(formatMinimumSubtotal(0.125)).toBe("0.12");
    expect(formatMinimumSubtotal(0.375)).toBe("0.38");
    expect(formatMinimumSubtotal(0.625)).toBe("0.62");
    expect(formatMinimumSubtotal(100.125)).toBe("100.12");
  });

  it("rounds a value that is not an exact half by its real binary value", () => {
    // 1.005 is stored as 1.00499999999999989..., so it is under the half: Python gives 1.00.
    expect(formatMinimumSubtotal(1.005)).toBe("1.00");
    expect(formatMinimumSubtotal(2.675)).toBe("2.67");
  });
});

describe("buildDiscountTitle", () => {
  it("puts the prefix after the app name", () => {
    expect(buildDiscountTitle("SUMMER-")).toBe("Workbench — SUMMER-");
  });

  it("drops characters other than letters, digits, space, underscore and hyphen", () => {
    expect(buildDiscountTitle("A&B!#_9")).toBe("Workbench — AB_9");
  });

  it("trims the spaces left over", () => {
    expect(buildDiscountTitle(" é Sale ")).toBe("Workbench — Sale");
  });

  it("falls back to the app name when nothing is left", () => {
    expect(buildDiscountTitle("")).toBe("Workbench — Workbench");
    expect(buildDiscountTitle("!!!")).toBe("Workbench — Workbench");
    expect(buildDiscountTitle("   ")).toBe("Workbench — Workbench");
  });
});
