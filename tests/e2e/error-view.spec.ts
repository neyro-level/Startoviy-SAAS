import { expect, test } from "@playwright/test";
import { isModuleEnabled } from "../../src/platform/config/optional-modules.ts";
import { optionalModules } from "../../src/platform/config/project-identity.ts";

test("auth failures stay in the public envelope without a stack", async ({ page }, testInfo) => {
  const response = await page.request.post("/api/auth/sign-in/username", {
    data: { username: `missing_${testInfo.project.name.replace(/[^a-z0-9]/gi, "_")}`, password: "not-a-real-password" },
  });
  expect(response.status()).toBe(401);
  const body = await response.text();
  expect(body).not.toMatch(/at |postgres:\/\/|SELECT |stack/i);
  expect(response.headers()["x-correlation-id"] ?? "").toMatch(/[0-9a-f-]{16,}/i);
});

test("user-facing failure view does not expose internals", async ({ page }) => {
  const response = await page.goto("/offline/");
  if (isModuleEnabled(optionalModules, "pwa")) {
    await expect(page.getByRole("heading", { name: /Откройте страницу снова/ })).toBeVisible();
    expect(await page.content()).not.toMatch(/at Object\.|postgres:\/\//);
  } else {
    expect(response?.status()).toBe(404);
  }
});
