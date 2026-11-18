import { describe, expect, it } from "vitest";
import { getOutputFile, getOutputFileName } from "./outputFile";

describe("getOutputFile", () => {
  it("gives JPG at quality 0.95 for a .jpg template", () => {
    expect(getOutputFile("C:\\art\\voucher.jpg")).toEqual({
      format: "JPG",
      mimeType: "image/jpeg",
      extension: ".jpg",
      quality: 0.95,
    });
  });

  it("gives JPG with the .jpg extension for a .jpeg template", () => {
    const output = getOutputFile("voucher.jpeg");

    expect(output.format).toBe("JPG");
    expect(output.extension).toBe(".jpg");
    expect(output.quality).toBe(0.95);
  });

  it("gives PNG with no quality for a .png template", () => {
    expect(getOutputFile("voucher.png")).toEqual({
      format: "PNG",
      mimeType: "image/png",
      extension: ".png",
      quality: undefined,
    });
  });

  it("gives PNG for a .webp template", () => {
    expect(getOutputFile("voucher.webp").format).toBe("PNG");
  });

  it("ignores the case of the extension", () => {
    expect(getOutputFile("VOUCHER.JPG").format).toBe("JPG");
    expect(getOutputFile("Voucher.JpEg").format).toBe("JPG");
  });

  it("reads only the last extension of the file name", () => {
    expect(getOutputFile("voucher.jpg.png").format).toBe("PNG");
  });

  it("does not read an extension from a folder name", () => {
    expect(getOutputFile("C:\\art.jpg\\voucher").format).toBe("PNG");
    expect(getOutputFile("/art.jpg/voucher").format).toBe("PNG");
  });

  it("gives PNG when the name has no extension, as Python's Path.suffix is empty", () => {
    expect(getOutputFile("voucher").format).toBe("PNG");
    expect(getOutputFile(".jpg").format).toBe("PNG");
    expect(getOutputFile("voucher.").format).toBe("PNG");
  });
});

describe("getOutputFileName", () => {
  it("is the code plus the output extension", () => {
    expect(getOutputFileName("SUMMER-AB12CD34", getOutputFile("voucher.jpeg"))).toBe(
      "SUMMER-AB12CD34.jpg",
    );
    expect(getOutputFileName("SUMMER-AB12CD34", getOutputFile("voucher.webp"))).toBe(
      "SUMMER-AB12CD34.png",
    );
  });
});
