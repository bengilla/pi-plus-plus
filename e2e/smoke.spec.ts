import { test, expect } from "@playwright/test";

const BASE = "http://localhost:31508";

test.describe("agents-web smoke tests", () => {
  test("page loads and shows sidebar", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByText("Agents")).toBeVisible();
    await expect(page.getByRole("button", { name: /claude/ })).toBeVisible();
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

  test("agent switcher shows claude", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole("button", { name: /claude/ })).toBeVisible();
  });

  test("conversations are scoped to the active workspace", async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => {
      localStorage.setItem("agents-web-workspace", "/tmp/project-a");
      localStorage.setItem("agents-web-conversations", JSON.stringify([
        {
          id: "project-a-conv",
          title: "Project A chat",
          agentId: "claude-code",
          workspace: "/tmp/project-a",
          messages: [{ role: "user", content: "Project A chat", id: "a-msg" }],
          createdAt: Date.now(),
        },
        {
          id: "project-b-conv",
          title: "Project B chat",
          agentId: "claude-code",
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

  test("first message from an empty conversation receives an agent reply", async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => localStorage.removeItem("agents-web-conversations"));
    await page.reload();

    const textarea = page.locator("textarea");
    await textarea.fill("Say OK only");
    await page.locator("button", { hasText: "Send" }).click();

    await expect(page.getByText("Generating…")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Generating…")).not.toBeVisible({ timeout: 60000 });

    await expect(page.getByText("OK", { exact: true })).toBeVisible();
    await expect(page.getByText(/\d+ out/).first()).toBeVisible();
  });
});
