import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3005";

test.describe("agents-web smoke tests", () => {
  test("page loads and shows header", async ({ page }) => {
    await page.goto(BASE);
    // The header "agents-web" span is in the top bar
    await expect(page.locator("header").getByText("agents-web")).toBeVisible();
  });

  test("agents API returns discovered agents", async ({ request }) => {
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

  test("skills API returns installed skills for claude-code", async ({ request }) => {
    const r = await request.get(`${BASE}/api/skills?agent=claude-code`);
    expect(r.ok()).toBeTruthy();

    const data = await r.json();
    expect(data.results).toBeDefined();
    const cc = data.results.find((r: { agentId: string }) => r.agentId === "claude-code");
    expect(cc).toBeDefined();
    expect(cc.skills.length).toBeGreaterThan(100);
  });

  test("skills marketplace search works", async ({ request }) => {
    const r = await request.get(`${BASE}/api/skills?q=design&agent=claude-code`);
    expect(r.ok()).toBeTruthy();

    const data = await r.json();
    expect(data.marketplace).toBeDefined();
    expect(data.marketplace.length).toBeGreaterThan(0);
  });

  test("settings modal opens when clicking gear icon", async ({ page }) => {
    await page.goto(BASE);

    // Click the gear button in the sidebar
    const gearBtn = page.getByTitle("Settings");
    await gearBtn.click();

    // Modal should appear with Skills and General tabs
    await expect(page.getByText("Skills").first()).toBeVisible();
    await expect(page.getByText("General").first()).toBeVisible();

    // Close by clicking backdrop
    await page.locator(".fixed.inset-0").first().click({ position: { x: 10, y: 10 } });
    await expect(page.getByText("Skills").first()).not.toBeVisible();
  });

  test("agent switcher shows Claude Code", async ({ page }) => {
    await page.goto(BASE);
    // The model switcher select or text should mention Claude Code
    await expect(page.locator("header")).toContainText("Claude Code");
  });
});
