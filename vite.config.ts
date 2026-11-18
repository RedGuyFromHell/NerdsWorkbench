import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// WHY: Tauri's devUrl in tauri.conf.json is http://localhost:1420, so the port is fixed
// and Vite must fail instead of picking another one.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
});
