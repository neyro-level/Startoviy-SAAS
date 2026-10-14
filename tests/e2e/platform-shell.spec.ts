import { expect, test } from "@playwright/test";
import { optionalModules, publicProjectIdentity } from "../../src/platform/config/project-identity.ts";
import { isModuleEnabled } from "../../src/platform/config/optional-modules.ts";
import { createPrismaContext } from "../../src/platform/database/prisma/context.ts";

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

test.describe("authentication throttle", () => {
  test.describe.configure({ retries: 0 });
  test("authentication endpoint throttles repeated invalid credentials", async ({ page }, testInfo) => {
    if (process.env.APP_ENV !== "test" || !process.env.DATABASE_NAME?.endsWith("_test")
      || process.env.DATABASE_NAME !== process.env.TEST_DATABASE_NAME
      || process.env.DATABASE_USER !== process.env.TEST_DATABASE_USER
      || !["127.0.0.1", "::1"].includes(process.env.DATABASE_HOST ?? "")) {
      throw new Error("Isolated E2E database required");
    }
    const projectIndex = Math.max(0, ["mobile-375", "tablet-768", "desktop-1280", "desktop-1440"].indexOf(testInfo.project.name));
    const forwarded = `198.51.100.${10 + projectIndex}`;
    const username = `missing_${testInfo.project.name.replace(/[^a-z0-9]/gi, "_")}`;
    const database = createPrismaContext(process.env);
    try {
      await database.prisma.rateLimit.deleteMany();
      const responses = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        responses.push(await page.request.post("/api/auth/sign-in/username", {
          data: { username, password: "not-a-real-password" },
          headers: { "x-forwarded-for": forwarded },
        }));
      }
      expect(responses.map((response) => response.status())).toEqual([401, 401, 401, 401, 401, 429]);
    } finally {
      await database.prisma.rateLimit.deleteMany();
      await database.close();
    }
  });
});
