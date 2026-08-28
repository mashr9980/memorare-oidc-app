import { defineConfig } from "vitest/config";

// Vitest and Playwright both claim *.spec/*.test files by default, so draw the
// line explicitly: unit tests live in tests/, browser tests in e2e/.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    environment: "node",
  },
});
