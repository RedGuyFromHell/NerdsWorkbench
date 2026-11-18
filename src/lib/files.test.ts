import { describe, expect, it } from "vitest";
import { encodePathHeader, fileNameOf, mimeTypeOf, safeFileName } from "./files";

describe("encodePathHeader", () => {
  it("escapes spaces, backslashes, # and % as percent codes", () => {
    expect(encodePathHeader("D:\\My Files\\disc #1 100%.nerd")).toBe(
      "D%3A%5CMy%20Files%5Cdisc%20%231%20100%25.nerd",
    );
  });

  it("writes ș and ț as UTF-8 percent codes, so the header is plain ASCII", () => {
    const encoded = encodePathHeader("C:\\Users\\Ștefan\\disc ș ț.nerd");
    expect(encoded).toBe("C%3A%5CUsers%5C%C8%98tefan%5Cdisc%20%C8%99%20%C8%9B.nerd");
    expect(encoded).toMatch(/^[\x20-\x7e]*$/);
  });

  it("is undone by decodeURIComponent, the decode the Rust side mirrors", () => {
    const path = "D:\\Proiecte mele\\ghiață #2 (100%) ț+ș.nerd";
    expect(decodeURIComponent(encodePathHeader(path))).toBe(path);
  });
});

describe("fileNameOf", () => {
  it("takes the last part of a Windows or a POSIX path", () => {
    expect(fileNameOf("D:\\Designs\\my disc.disc.json")).toBe("my disc.disc.json");
    expect(fileNameOf("/home/me/logo.svg")).toBe("logo.svg");
    expect(fileNameOf("plain.png")).toBe("plain.png");
  });
});

describe("mimeTypeOf", () => {
  it("knows the image types by extension, in any case", () => {
    expect(mimeTypeOf("a.PNG")).toBe("image/png");
    expect(mimeTypeOf("a.jpg")).toBe("image/jpeg");
    expect(mimeTypeOf("a.JPEG")).toBe("image/jpeg");
    expect(mimeTypeOf("a.svg")).toBe("image/svg+xml");
    expect(mimeTypeOf("a.webp")).toBe("image/webp");
  });

  it("is an empty string for any other file", () => {
    expect(mimeTypeOf("project.nerd")).toBe("");
    expect(mimeTypeOf("noextension")).toBe("");
  });
});

describe("safeFileName", () => {
  it("keeps a normal name, ș and ț included", () => {
    expect(safeFileName("disc-design")).toBe("disc-design");
    expect(safeFileName("ghiață ș ț")).toBe("ghiață ș ț");
  });

  it("replaces the characters Windows does not allow in a file name", () => {
    expect(safeFileName('a/b:c*d?e"f<g>h|i')).toBe("a-b-c-d-e-f-g-h-i");
  });

  it("falls back to disc-design when nothing usable is left", () => {
    expect(safeFileName("")).toBe("disc-design");
    expect(safeFileName("  . ")).toBe("disc-design");
  });
});
