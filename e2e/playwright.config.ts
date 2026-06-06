import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: "http://localhost:3005",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3005",
    reuseExistingServer: true,
  },
});
