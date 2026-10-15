import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// In the sandbox Chromium is pre-installed; elsewhere Playwright uses its own.
const sandboxChromium = "/opt/pw-browsers/chromium";

// E2E_PROD=1 runs the suite against `next start` (build first) instead of the dev server,
// which exercises production-only behaviour such as Secure cookies and compiled output.
const prod = Boolean(process.env.E2E_PROD);

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: existsSync(sandboxChromium) ? { executablePath: sandboxChromium } : {},
  },
  webServer: {
    command: prod ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
