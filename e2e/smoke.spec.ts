import { test, expect } from "@playwright/test";

const BASE = "http://127.0.0.1:31508";

test.describe("Pi Workspace smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => {
      console.log(`[browser ${msg.type()}] ${msg.text()}`);
    });
    page.on("pageerror", (err) => {
      console.error(`[browser uncaught] ${err.message}`);
    });
  });
  test("page loads and shows header with sidebar toggle", async ({ page }) => {
    await page.goto(BASE);
    // Wait for page to render
    await expect(page.locator("header")).toBeVisible({ timeout: 15000 });
    // Header should have a sidebar toggle button
    await expect(page.locator("header button").first()).toBeVisible();
  });

  test("agents API returns Pi", async ({ request }) => {
    const r = await request.get(`${BASE}/api/agents`);
    expect(r.ok()).toBeTruthy();

    const data = await r.json();
    expect(data.agents).toBeDefined();
    expect(data.agents.length).toBeGreaterThan(0);

    for (const a of data.agents) {
      expect(a.id).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.capabilities).toBeDefined();
    }
  });

  test("skills API returns installed skills", async ({ request }) => {
    const r = await request.get(`${BASE}/api/skills`);
    expect(r.ok()).toBeTruthy();

    const data = await r.json();
    expect(data.skills).toBeDefined();
    expect(Array.isArray(data.skills)).toBeTruthy();
  });

  test("settings modal opens when clicking gear icon", async ({ page }) => {
    await page.goto(BASE);

    // Wait for the input box to ensure client-side hydration is complete
    await expect(page.getByPlaceholder(/Ask pi/i)).toBeVisible({ timeout: 15000 });

    // Click the gear button in the sidebar
    const gearBtn = page.getByTitle("Settings");
    await gearBtn.click();

    // Modal should appear with General tab (locale-independent match for General / 通用)
    await expect(page.getByText(/General|通用/i).first()).toBeVisible();

    // Close by pressing Escape
    await page.keyboard.press("Escape");
    await expect(page.getByText(/General|通用/i).first()).not.toBeVisible();
  });

  test("model API returns default model", async ({ request }) => {
    const r = await request.get(`${BASE}/api/pi/model`);
    expect(r.ok()).toBeTruthy();

    const data = await r.json();
    // May return {} if no default set; just check it doesn't error
    expect(typeof data === "object").toBeTruthy();
  });

  test("models API lists available models", async ({ request }) => {
    const r = await request.get(`${BASE}/api/pi/models`);
    expect(r.ok()).toBeTruthy();

    const data = await r.json();
    expect(data.models).toBeDefined();
    expect(Array.isArray(data.models)).toBeTruthy();
    if (data.models.length > 0) {
      const m = data.models[0];
      expect(m.id).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.provider).toBeTruthy();
    }
  });

  test("Pi version API works", async ({ request }) => {
    const r = await request.get(`${BASE}/api/pi/version`);
    expect(r.ok()).toBeTruthy();

    const data = await r.json();
    // Should at least have currentVersion
    expect(data.currentVersion).toBeDefined();
  });

  test("conversations are scoped to the active workspace", async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("pi-plus-plus-workspace", "/tmp/project-a");
      localStorage.setItem("pi-plus-plus-conversations", JSON.stringify([
        {
          id: "project-a-conv",
          title: "Project A chat",
          agentId: "pi",
          workspace: "/tmp/project-a",
          messages: [{ role: "user", content: "Project A chat", id: "a-msg" }],
          createdAt: Date.now(),
        },
        {
          id: "project-b-conv",
          title: "Project B chat",
          agentId: "pi",
          workspace: "/tmp/project-b",
          messages: [{ role: "user", content: "Project B chat", id: "b-msg" }],
          createdAt: Date.now() - 1,
        },
      ]));
    });
    await page.reload();
    await expect(page.getByRole("button", { name: "Project A chat", exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Project B chat", exact: false })).not.toBeVisible();

    await page.evaluate(() => localStorage.setItem("pi-plus-plus-workspace", "/tmp/project-b"));
    await page.reload();
    // Wait for the input box to ensure client-side hydration is complete
    await expect(page.getByPlaceholder(/Ask pi/i)).toBeVisible({ timeout: 15000 });

    await expect(page.getByRole("button", { name: "Project B chat", exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Project A chat", exact: false })).not.toBeVisible();
  });

  // Integration test: requires Pi CLI + API key configured
  // test("typing in the input area and clicking send sends a message", async ({ page }) => {
  //   ...
  // });
});
