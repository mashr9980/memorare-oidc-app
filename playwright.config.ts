import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const MOCK_PORT = 9100;
const baseURL = `http://localhost:${PORT}`;

const env = {
  AUTH_BASE: `http://127.0.0.1:${MOCK_PORT}`,
  MEMORARE_CLIENT_ID: "e2e-client",
  MEMORARE_CLIENT_SECRET: "e2e-secret-value-not-a-real-credential",
  MEMORARE_REDIRECT_URI: `${baseURL}/auth/callback`,
  APP_URL: baseURL,
  SESSION_SECRET: "e2e-session-secret-at-least-32-characters-long",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "line",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `node mock/idp.js`,
      port: MOCK_PORT,
      reuseExistingServer: !process.env.CI,
      env: { MOCK_PORT: String(MOCK_PORT), MOCK_CLIENT_ID: env.MEMORARE_CLIENT_ID, MOCK_CLIENT_SECRET: env.MEMORARE_CLIENT_SECRET },
    },
    {
      command: `npx next start -p ${PORT}`,
      port: PORT,
      reuseExistingServer: !process.env.CI,
      env,
    },
  ],
});
