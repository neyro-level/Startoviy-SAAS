import { expect, test } from "@playwright/test";
import { optionalModules, publicProjectIdentity } from "../../src/platform/config/project-identity.ts";
import { isModuleEnabled } from "../../src/platform/config/optional-modules.ts";

test("public starter page has no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: publicProjectIdentity.productName })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("legal pages stay available", async ({ page }) => {
  for (const route of ["/politika/", "/soglasie/", "/cookies/", "/terms/"]) {
    await page.goto(route);
    await expect(page.locator("header").getByRole("link", { name: `${publicProjectIdentity.productName} - на главную` })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  }
});

test("PWA manifest is available", async ({ page }) => {
  const response = await page.request.get("/manifest.webmanifest");
  expect(response.status()).toBe(isModuleEnabled(optionalModules, "pwa") ? 200 : 404);
  if (response.ok()) expect(await response.json()).toMatchObject({ name: publicProjectIdentity.productName });
});

test("offline page is available", async ({ page }) => {
  const response = await page.goto("/offline/");
  if (isModuleEnabled(optionalModules, "pwa")) await expect(page.getByRole("heading", { name: /Откройте страницу снова/ })).toBeVisible();
  else expect(response?.status()).toBe(404);
});

test("API responses are not cacheable", async ({ page }) => {
  const response = await page.request.get("/api/health/live");
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("authentication endpoint throttles repeated invalid credentials", async ({ page }, testInfo) => {
  const username = `missing_${testInfo.project.name.replace(/[^a-z0-9]/gi, "_")}`;
  const responses = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    responses.push(await page.request.post("/api/auth/sign-in/username", {
      data: { username, password: "not-a-real-password" },
    }));
  }
  expect(responses.map((response) => response.status())).toEqual([401, 401, 401, 401, 401, 429]);
});
