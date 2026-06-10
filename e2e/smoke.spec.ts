import { test, expect } from "@playwright/test";

const BASE = "http://localhost:31508";

test.describe("Pi Workspace smoke tests", () => {
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

  test("skills API returns installed skills for pi", async ({ request }) => {
    const r = await request.get(`${BASE}/api/skills?agent=pi`);
    expect(r.ok()).toBeTruthy();

    const data = await r.json();
    expect(data.results).toBeDefined();
    const piResult = data.results.find((r: { agentId: string }) => r.agentId === "pi");
    expect(piResult).toBeDefined();
  });

  test("skills marketplace search works", async ({ request }) => {
    const r = await request.get(`${BASE}/api/skills?q=design&agent=pi`);
    expect(r.ok()).toBeTruthy();

    const data = await r.json();
    expect(data.marketplace).toBeDefined();
  });

  test("settings modal opens when clicking gear icon", async ({ page }) => {
    await page.goto(BASE);

    // Click the gear button in the sidebar
    const gearBtn = page.getByTitle("Settings");
    await gearBtn.click();

    // Modal should appear with General tab (Skills tab removed in Pi-only mode)
    await expect(page.getByText("General").first()).toBeVisible();

    // Close by pressing Escape
    await page.keyboard.press("Escape");
    await expect(page.getByText("General").first()).not.toBeVisible();
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
      localStorage.setItem("agents-web-workspace", "/tmp/project-a");
      localStorage.setItem("agents-web-conversations", JSON.stringify([
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

    await expect(page.getByRole("button", { name: "Project A chat" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Project B chat" })).not.toBeVisible();

    await page.evaluate(() => localStorage.setItem("agents-web-workspace", "/tmp/project-b"));
    await page.reload();

    await expect(page.getByRole("button", { name: "Project B chat" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Project A chat" })).not.toBeVisible();
  });

  // Integration test: requires Pi CLI + API key configured
  // test("typing in the input area and clicking send sends a message", async ({ page }) => {
  //   ...
  // });
});
