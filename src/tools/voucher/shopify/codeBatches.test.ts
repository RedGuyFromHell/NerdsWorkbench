import { describe, expect, it } from "vitest";
import { BULK_ADD_CODE_LIMIT, planCodeBatches } from "./codeBatches";

function makeCodes(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `CODE-${index}`);
}

describe("planCodeBatches", () => {
  it("allows 250 codes per bulk-add call", () => {
    expect(BULK_ADD_CODE_LIMIT).toBe(250);
  });

  it("sends a single code to the create call and nothing to bulk add", () => {
    expect(planCodeBatches(["ONLY"])).toEqual({ firstCode: "ONLY", remainingBatches: [] });
  });

  it("sends the first code to the create call and the rest to one batch", () => {
    expect(planCodeBatches(["A", "B", "C"])).toEqual({
      firstCode: "A",
      remainingBatches: [["B", "C"]],
    });
  });

  it("fills one batch exactly at the limit", () => {
    const plan = planCodeBatches(makeCodes(1 + BULK_ADD_CODE_LIMIT));

    expect(plan.remainingBatches.map((batch) => batch.length)).toEqual([BULK_ADD_CODE_LIMIT]);
  });

  it("starts a second batch one code over the limit", () => {
    const plan = planCodeBatches(makeCodes(1 + BULK_ADD_CODE_LIMIT + 1));

    expect(plan.remainingBatches.map((batch) => batch.length)).toEqual([BULK_ADD_CODE_LIMIT, 1]);
  });

  it("keeps every code once and in order", () => {
    const codes = makeCodes(1 + 2 * BULK_ADD_CODE_LIMIT + 7);

    const plan = planCodeBatches(codes);

    expect([plan.firstCode, ...plan.remainingBatches.flat()]).toEqual(codes);
    expect(plan.remainingBatches.map((batch) => batch.length)).toEqual([
      BULK_ADD_CODE_LIMIT,
      BULK_ADD_CODE_LIMIT,
      7,
    ]);
  });

  it("refuses an empty list, because a discount needs a first code", () => {
    expect(() => planCodeBatches([])).toThrow("at least one code");
  });
});
