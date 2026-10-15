import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// Tests the built artifact page against a fake claude.ai runtime. No server or database needed.
const sandboxChromium = "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "./artifact/e2e",
  workers: 1,
  use: { launchOptions: existsSync(sandboxChromium) ? { executablePath: sandboxChromium } : {} },
});
