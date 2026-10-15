import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    setupFiles: ["./test/setup.ts"],
    fileParallelism: false,
    exclude: ["e2e/**", "node_modules/**"],
  },
});
