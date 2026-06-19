import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: "http://127.0.0.1:31508",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:31508",
    reuseExistingServer: true,
    cwd: "..",
  },
});
