import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// In the sandbox Chromium is pre-installed; elsewhere Playwright uses its own.
const sandboxChromium = "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: existsSync(sandboxChromium) ? { executablePath: sandboxChromium } : {},
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
