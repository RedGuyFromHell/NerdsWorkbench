import { defineConfig } from "@playwright/test";

// WHY: channel "msedge" runs the Edge installed on the machine: WebView2, the engine of the app,
// is Edge's Chromium, so pixels here are the pixels the app draws. No browser is downloaded.
// Port 1420 is the app's own dev server (tauri.conf.json), so the parity page gets 1421.
const PARITY_PORT = 1421;

export default defineConfig({
  testDir: "tests/disc-parity",
  testMatch: "*.spec.ts",
  timeout: 60_000,
  use: { channel: "msedge", baseURL: `http://localhost:${PARITY_PORT}` },
  webServer: {
    command: `corepack pnpm exec vite --port ${PARITY_PORT} --strictPort`,
    url: `http://localhost:${PARITY_PORT}/tests/disc-parity/parity.html`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
