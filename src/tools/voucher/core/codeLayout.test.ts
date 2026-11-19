import { describe, expect, it } from "vitest";
import { layoutCode } from "./codeLayout";

describe("layoutCode", () => {
  it("places each glyph after the previous one plus the letter spacing", () => {
    const layout = layoutCode({
      glyphAdvances: [10, 20, 30],
      letterSpacing: 2,
      area: { x: 0, y: 0, width: 100, height: 50 },
      ascent: 30,
      descent: 10,
    });

    // total = 60 + 2 * 2 = 64, left edge = (100 - 64) // 2 = 18
    expect(layout.totalWidth).toBe(64);
    expect(layout.glyphX).toEqual([18, 30, 52]);
  });

  it("starts from the left edge of the area", () => {
    const layout = layoutCode({
      glyphAdvances: [10, 10],
      letterSpacing: 0,
      area: { x: 200, y: 0, width: 40, height: 20 },
      ascent: 10,
      descent: 0,
    });

    // total = 20, left edge = 200 + (40 - 20) // 2
    expect(layout.glyphX).toEqual([210, 220]);
  });

  it("floors the horizontal centre like Python //, not rounds it", () => {
    // (101 - 100) / 2 = 0.5: floor gives 0, Math.round would give 1.
    const layout = layoutCode({
      glyphAdvances: [100],
      letterSpacing: 0,
      area: { x: 0, y: 0, width: 101, height: 20 },
      ascent: 10,
      descent: 0,
    });

    expect(layout.glyphX).toEqual([0]);
  });

  it("floors towards minus infinity when the text is wider than the area", () => {
    // (100 - 125) / 2 = -12.5: floor gives -13, truncating or rounding would give -12.
    const layout = layoutCode({
      glyphAdvances: [125],
      letterSpacing: 0,
      area: { x: 0, y: 0, width: 100, height: 20 },
      ascent: 10,
      descent: 0,
    });

    expect(layout.glyphX).toEqual([-13]);
  });

  it("puts the baseline at y + (height + ascent - descent) / 2", () => {
    const layout = layoutCode({
      glyphAdvances: [10],
      letterSpacing: 0,
      area: { x: 0, y: 100, width: 50, height: 60 },
      ascent: 40,
      descent: 10,
    });

    // (60 + 40 - 10) // 2 = 45
    expect(layout.baselineY).toBe(145);
  });

  it("floors the baseline like Python //, not rounds it", () => {
    // (50 + 33 - 8) / 2 = 37.5: floor gives 37, Math.round would give 38.
    const layout = layoutCode({
      glyphAdvances: [10],
      letterSpacing: 0,
      area: { x: 0, y: 0, width: 50, height: 50 },
      ascent: 33,
      descent: 8,
    });

    expect(layout.baselineY).toBe(37);
  });

  it("measures a single glyph with no spacing", () => {
    const layout = layoutCode({
      glyphAdvances: [20],
      letterSpacing: 5,
      area: { x: 0, y: 0, width: 100, height: 20 },
      ascent: 10,
      descent: 0,
    });

    expect(layout.totalWidth).toBe(20);
    expect(layout.glyphX).toEqual([40]);
  });

  it("gives no glyphs and a zero width for an empty code", () => {
    const layout = layoutCode({
      glyphAdvances: [],
      letterSpacing: 5,
      area: { x: 0, y: 0, width: 100, height: 20 },
      ascent: 10,
      descent: 0,
    });

    expect(layout.totalWidth).toBe(0);
    expect(layout.glyphX).toEqual([]);
  });
});
