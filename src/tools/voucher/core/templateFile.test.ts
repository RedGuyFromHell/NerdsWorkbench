import { describe, expect, it } from "vitest";
import { isTemplateFileName } from "./templateFile";

describe("isTemplateFileName", () => {
  it("takes jpg, jpeg, png and webp in any case", () => {
    for (const name of ["a.jpg", "a.JPEG", "a.png", "b.c.WebP"]) {
      expect(isTemplateFileName(name), name).toBe(true);
    }
  });

  it("refuses other files and names with no extension", () => {
    for (const name of ["a.gif", "a.svg", "a", "png", ".png", "a.png.txt"]) {
      expect(isTemplateFileName(name), name).toBe(false);
    }
  });
});
