import { describe, expect, it } from "vitest";
import { saveChoice } from "./saveChoice";
import { monthFileSchema } from "./storage/monthSchema";
import type { MonthFile } from "./storage/monthSchema";
import { createMemoryStore } from "./storage/payoutStore";

// Every person and product here is made up.

const FILE: MonthFile = {
  version: 1,
  month: "2031-03",
  status: "open",
  timeZone: "UTC",
  loadedAt: "2031-03-20T12:30:00Z",
  lines: [
    {
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
      printedBy: "farm",
      paintedBy: null,
    },
  ],
};

describe("saveChoice: what a menu change writes", () => {
  it("writes the month file with the new choice", async () => {
    const store = createMemoryStore();
    await saveChoice(store, FILE, "owl", "printedBy", "farm");
    const saved = await store.readMonth("2031-03", monthFileSchema);
    expect(saved?.lines[0]?.printedBy).toBe("farm");
  });

  it("remembers the choice for the product", async () => {
    const store = createMemoryStore();
    await saveChoice(store, FILE, "owl", "printedBy", "farm");
    expect((await store.readChoices()).byProduct).toEqual({
      owl: { printedBy: "farm", paintedBy: null },
    });
  });

  it("keeps what was remembered for the other part and the other products", async () => {
    const store = createMemoryStore();
    await saveChoice(store, FILE, "owl", "printedBy", "farm");
    await saveChoice(store, FILE, "bear", "printedBy", "printer-a");
    await saveChoice(store, FILE, "owl", "paintedBy", "painter-b");
    expect((await store.readChoices()).byProduct).toEqual({
      owl: { printedBy: "farm", paintedBy: "painter-b" },
      bear: { printedBy: "printer-a", paintedBy: null },
    });
  });

  it("remembers nothing for a line with no product, and still writes the month", async () => {
    const store = createMemoryStore();
    await saveChoice(store, FILE, null, "printedBy", "farm");
    expect((await store.readChoices()).byProduct).toEqual({});
    expect(await store.listMonthKeys()).toEqual(["2031-03"]);
  });
});
