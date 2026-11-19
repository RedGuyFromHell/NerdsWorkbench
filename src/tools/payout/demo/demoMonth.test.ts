import { describe, expect, it } from "vitest";
import { add, compare, fromBani, ZERO_AMOUNT } from "../core/exactAmount";
import { calculateLine } from "../core/payoutMath";
import { buildMonthView } from "../core/monthView";
import { monthFileSchema } from "../storage/monthSchema";
import { planClose } from "../core/closeMonth";
import {
  createDemoBundle,
  createDemoStore,
  DEMO_CARRY_MONTH,
  DEMO_CLOSED_MONTH,
  DEMO_MONTH,
} from "./demoMonth";

// The demo month is made up and only a dev build shows it. This test keeps it from rotting: it
// runs the whole path (orders, planned lines, the file, the maths, the view) on every change.

const bundle = createDemoBundle();

describe("the demo month", () => {
  it("is a valid month file for the month it names", () => {
    expect(monthFileSchema.parse(bundle.month).month).toBe(DEMO_MONTH);
    expect(bundle.month.status).toBe("open");
  });

  it("counts, and leaves out, the orders and lines it was built to show", () => {
    expect(bundle.month.lines).toHaveLength(11);
    expect(bundle.plan.leftOut).toMatchObject({
      "other-month": 1,
      cancelled: 1,
      "not-payout-line": 1,
    });
  });

  it("shows every tag of the month screen at least once", () => {
    const view = buildMonthView(bundle.month, bundle.settings, bundle.people);
    const tagIds = new Set(
      view.orders.flatMap((order) => order.lines).flatMap((row) => row.tags.map((tag) => tag.id)),
    );
    expect([...tagIds].sort()).toEqual([
      "cost-from-table",
      "loss",
      "min-drybrush",
      "needs-choice",
      "negative-paint",
      "no-cost",
      "no-primed-price",
      "stays-in-company",
    ]);
    expect(view.orders.some((order) => order.notPaidYet)).toBe(true);
    expect(view.orders.some((order) => order.warning !== null)).toBe(true);
    expect(view.blockedLines).toBe(2);
    expect(view.needsChoiceLines).toBe(1);
  });

  it("gives every line that is not blocked the exact identity: fee + cost + shares + company = paid", () => {
    let checked = 0;
    for (const line of bundle.month.lines) {
      const result = calculateLine(
        { ...line.facts, printedBy: line.printedBy, paintedBy: line.paintedBy },
        bundle.settings.rates,
        bundle.people.people,
      );
      if (result.status === "blocked") continue;
      const shares = result.shares.reduce((sum, share) => add(sum, share.amount), ZERO_AMOUNT);
      const everything = add(
        add(result.fee, fromBani(result.costBani)),
        add(shares, result.company),
      );
      expect(compare(everything, fromBani(result.paidBani))).toBe(0);
      checked += 1;
    }
    expect(checked).toBe(9);
  });

  it("names every person it uses", () => {
    const view = buildMonthView(bundle.month, bundle.settings, bundle.people);
    const names = view.orders
      .flatMap((order) => order.lines)
      .flatMap((row) => [row.printedByName, row.paintedByName]);
    expect(names).not.toContain("Unknown person");
  });
});

describe("the earlier months of the demo", () => {
  const [closed, carry] = bundle.earlierMonths;

  it("are a closed month and an open one that carries its two late refunds", () => {
    expect(bundle.earlierMonths.map((file) => monthFileSchema.parse(file).month)).toEqual([
      DEMO_CLOSED_MONTH,
      DEMO_CARRY_MONTH,
    ]);
    expect(closed?.status).toBe("closed");
    expect(carry?.status).toBe("open");
    expect(carry?.corrections?.map((correction) => correction.reason)).toEqual([
      "removed",
      "reduced",
    ]);
  });

  it("show the corrections in the box, and no line that blocks the close", () => {
    if (carry === undefined) throw new Error("The demo has no open earlier month.");
    const view = buildMonthView(carry, bundle.settings, bundle.people);
    expect(view.corrections).toHaveLength(2);
    expect(view.blockedLines + view.needsChoiceLines).toBe(0);
    // The troll line of January, taken back: the printer had 60% of (88.00 − 2.64 − 16.00) = 41.616.
    expect(view.corrections[0]).toMatchObject({
      title: "#901 · Demo Troll",
      people: [{ name: "Printer A", amount: "−41.62" }],
    });
  });
});

describe("the demo store", () => {
  it("holds the three months, in memory, with one person marked paid", async () => {
    const store = await createDemoStore();
    expect(await store.listMonthKeys()).toEqual([DEMO_CLOSED_MONTH, DEMO_CARRY_MONTH, DEMO_MONTH]);
    expect((await store.readPaidMarks()).marks).toEqual([
      { month: DEMO_CLOSED_MONTH, personId: "demo-printer-a", paidOn: "2031-02-05" },
    ]);
  });

  it("lets the carry month close, and keeps the month with blocked lines open", async () => {
    const store = await createDemoStore();
    const [, carry] = bundle.earlierMonths;
    if (carry === undefined) throw new Error("The demo has no open earlier month.");
    const input = {
      settings: bundle.settings,
      people: bundle.people,
      months: [
        { month: DEMO_CLOSED_MONTH, status: "closed" as const },
        { month: DEMO_CARRY_MONTH, status: "open" as const },
        { month: DEMO_MONTH, status: "open" as const },
      ],
      closedAt: "2031-03-02T09:00:00Z",
    };
    expect(planClose({ ...input, file: bundle.month }).kind).toBe("refused");
    const plan = planClose({ ...input, file: carry });
    if (plan.kind === "refused") throw new Error("The carry month was refused.");
    await store.writeMonth(DEMO_CARRY_MONTH, monthFileSchema, plan.closed);
    await expect(store.writeMonth(DEMO_CARRY_MONTH, monthFileSchema, carry)).rejects.toThrow(
      "closed",
    );
  });
});
