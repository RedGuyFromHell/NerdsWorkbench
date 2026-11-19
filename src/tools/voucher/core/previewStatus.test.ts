import { describe, expect, it } from "vitest";
import { formatPreviewStatus } from "./previewStatus";

const TEMPLATE = { width: 1000, height: 800 };

describe("formatPreviewStatus", () => {
  it("shows the code area as a percentage of the template, then the sample", () => {
    const selection = { x: 100, y: 100, width: 400, height: 160 };
    expect(formatPreviewStatus(selection, TEMPLATE, "SUMMER-ABC")).toBe(
      "▭ 40% × 20%   ↳ sample: SUMMER-ABC",
    );
  });

  it("shows only the sample when nothing is selected", () => {
    expect(formatPreviewStatus(null, TEMPLATE, "SUMMER-ABC")).toBe("↳ sample: SUMMER-ABC");
  });

  it("shows only the sample when there is no template", () => {
    const selection = { x: 0, y: 0, width: 10, height: 10 };
    expect(formatPreviewStatus(selection, null, "X")).toBe("↳ sample: X");
  });

  it("rounds an exact half to the even percent, as Python does", () => {
    // 125 of 1000 is exactly 12.5 %, and 100 of 800 is exactly 12.5 %: both give 12.
    const selection = { x: 0, y: 0, width: 125, height: 100 };
    expect(formatPreviewStatus(selection, TEMPLATE, "X")).toBe("▭ 12% × 12%   ↳ sample: X");
  });
});
