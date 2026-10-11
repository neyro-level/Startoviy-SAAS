import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { createLocalAccountIssuer } from "better-auth/db";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { createPrismaContext } from "../../src/platform/database/prisma/context.ts";

// Auth material must never enter screenshots, traces, videos or test reports.
test.use({ trace: "off", screenshot: "off", video: "off" });

test("browser admin authority requires current TOTP and disappears after factor disable", async ({ page }, testInfo) => {
  if (process.env.APP_ENV !== "test" || !process.env.DATABASE_NAME?.endsWith("_test")
    || process.env.DATABASE_NAME !== process.env.TEST_DATABASE_NAME
    || process.env.DATABASE_USER !== process.env.TEST_DATABASE_USER
    || !["127.0.0.1", "::1"].includes(process.env.DATABASE_HOST ?? "")) {
    throw new Error("Isolated E2E database required");
  }
  const post = (route: string, data: Record<string, unknown>) => page.request.post(route, { data, headers: { origin: String(testInfo.project.use.baseURL) } });
  const database = createPrismaContext(process.env);
  const id = randomUUID();
  const username = `totp_${id.replaceAll("-", "").slice(0, 20)}`;
  const password = "Synthetic-browser-fixture-only-0000";
  try {
    await database.prisma.user.create({ data: {
      id, name: "Synthetic Browser Admin", username, email: `${username}@fixture.test`, systemRole: "PLATFORM_ADMIN",
      accounts: { create: { id: randomUUID(), issuer: createLocalAccountIssuer("credential"), accountId: id, providerId: "credential", password: await hashPassword(password) } },
    } });
    // The official runner owns this isolated database; sequential cases start
    // with a fresh bucket so unrelated shell tests cannot mask this contract.
    await database.prisma.rateLimit.deleteMany();
    const login = await post("/api/auth/sign-in/username", { username, password, twoFactorProof: "0".repeat(64), twoFactorVerifiedAt: new Date().toISOString() });
    expect(login.status()).toBe(200);
    await page.goto("/admin/organizations/");
    await expect(page).toHaveURL(/\?login=1$/);

    const enrollment = await post("/api/auth/two-factor/enable", { password });
    expect(enrollment.status()).toBe(200);
    const uri: string = (await enrollment.json()).totpURI;
    const generator = createOTP(new TextDecoder().decode(base32.decode(new URL(uri).searchParams.get("secret")!)));
    let invalid = "000000";
    while (await generator.verify(invalid)) invalid = String(Number(invalid) + 1).padStart(6, "0");
    const denied = await post("/api/auth/two-factor/verify-totp", { code: invalid });
    expect(denied.status()).toBeGreaterThanOrEqual(400);
    await page.goto("/admin/organizations/");
    await expect(page).toHaveURL(/\?login=1$/);

    const verified = await post("/api/auth/two-factor/verify-totp", { code: await generator.totp(), trustDevice: false });
    expect(verified.status()).toBe(200);
    await page.goto("/admin/organizations/");
    await expect(page).toHaveURL(/\/admin\/organizations\/?$/);
    await expect(page.getByRole("heading", { name: "Организации", exact: true })).toBeVisible();
    const publicSession = await page.request.get("/api/auth/get-session");
    const data = await publicSession.json();
    expect(Object.hasOwn(data.session, "twoFactorProof")).toBe(false);
    expect(Object.hasOwn(data.session, "twoFactorVerifiedAt")).toBe(false);

    const disabled = await post("/api/auth/two-factor/disable", { password });
    expect(disabled.status()).toBe(200);
    await page.goto("/admin/organizations/");
    await expect(page).toHaveURL(/\?login=1$/);
  } finally {
    try {
      await database.prisma.user.deleteMany({ where: { id } });
      await database.prisma.rateLimit.deleteMany();
    }
    finally { await database.close(); }
  }
});
