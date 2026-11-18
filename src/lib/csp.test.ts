// The app's Content Security Policy must let the page reach Tauri's IPC protocol. If it does not,
// Tauri silently falls back to postMessage, which sends every command body as JSON: the raw-body
// file commands (src-tauri/src/files.rs) then fail in the built app, though `tauri dev` may work.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = JSON.parse(
  readFileSync(new URL("../../src-tauri/tauri.conf.json", import.meta.url), "utf8"),
) as { app: { security: { csp: string } } };

function directive(csp: string, name: string): string[] {
  const found = csp
    .split(";")
    .map((part) => part.trim().split(/\s+/))
    .find(([key]) => key === name);
  return found ? found.slice(1) : [];
}

describe("the app CSP", () => {
  it("lets the page call Tauri's IPC protocol on every platform", () => {
    const connect = directive(config.app.security.csp, "connect-src");
    expect(connect).toContain("ipc:");
    expect(connect).toContain("http://ipc.localhost");
  });

  it("still allows the page's own origin", () => {
    expect(directive(config.app.security.csp, "connect-src")).toContain("'self'");
  });
});
