import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "better-auth/crypto";
import { createLocalAccountIssuer } from "better-auth/db";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "../../src/platform/auth/auth.ts";
import { handleAuthHttpRequest, recordLoginResult } from "../../src/platform/auth/login-security.ts";
import { loginInvalidPublicError, loginLockoutPolicy } from "../../src/platform/auth/login-lockout-policy.ts";
import { getPrismaClient } from "../../src/platform/database/prisma/client.ts";
import {
  createDatabaseAuthorizationContext,
  createIdentityDatabaseAuthorizationContext,
  runInAuthorizedDatabaseTransaction,
} from "../../src/platform/database/transaction.ts";

const password = "Synthetic-lock-fixture-only-0000";
const base = process.env.BETTER_AUTH_URL!;
const ownedUsers: string[] = [];
const prisma = getPrismaClient();

async function post(path: string, body: unknown, correlationId = randomUUID()) {
  return handleAuthHttpRequest({
    method: "POST",
    request: new Request(`${base}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, "x-correlation-id": correlationId },
      body: JSON.stringify(body),
    }),
    auth,
    correlationId,
    createHandlers: toNextJsHandler,
  });
}

async function fixture() {
  const id = randomUUID();
  const username = `lock_${id.replaceAll("-", "").slice(0, 20)}`;
  ownedUsers.push(id);
  await prisma.user.create({
    data: {
      id,
      name: "Synthetic Lockout",
      username,
      email: `${username}@fixture.test`,
      systemRole: "MEMBER",
      accounts: {
        create: {
          id: randomUUID(),
          issuer: createLocalAccountIssuer("credential"),
          accountId: id,
          providerId: "credential",
          password: await hashPassword(password),
        },
      },
    },
  });
  return { id, username };
}

beforeEach(async () => {
  expect(auth).not.toBeNull();
  process.env.CLIENT_ACCESS_ENABLED = "true";
  await prisma.rateLimit.deleteMany();
});
afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: ownedUsers.splice(0) } } });
});

describe("native account login lockout", () => {
  it("serializes parallel failures, refuses the correct password while locked, and unlocks after expiry", async () => {
    const account = await fixture();
    const identity = { username: account.username };
    await Promise.all(Array.from({ length: 12 }, () => recordLoginResult({ identity, status: 401, correlationId: randomUUID() })));
    const locked = await prisma.user.findUniqueOrThrow({ where: { id: account.id } });
    expect(locked.failedLoginCount).toBe(loginLockoutPolicy.failureLimit);
    expect(locked.loginLockedUntil).not.toBeNull();
    const denied = await post("/sign-in/username", { username: account.username, password });
    expect(denied.status).toBe(401);
    const deniedBody = await denied.json() as { error: { code: string; message: string } };
    expect(deniedBody.error).toMatchObject(loginInvalidPublicError);
    const unknown = await post("/sign-in/username", { username: `missing_${randomUUID().slice(0, 8)}`, password: "wrong-pass" });
    expect(unknown.status).toBe(401);
    expect(await unknown.json()).toMatchObject({ error: loginInvalidPublicError });
    await prisma.user.update({
      where: { id: account.id },
      data: { loginLockedUntil: new Date(Date.now() - 1000), failedLoginCount: loginLockoutPolicy.failureLimit },
    });
    const restored = await post("/sign-in/username", { username: account.username, password });
    expect(restored.status).toBe(200);
    const cleared = await prisma.user.findUniqueOrThrow({ where: { id: account.id } });
    expect(cleared.failedLoginCount).toBe(0);
    expect(cleared.loginLockedUntil).toBeNull();
    const adminEvents = await runInAuthorizedDatabaseTransaction(
      createDatabaseAuthorizationContext({
        kind: "platform-admin",
        userId: "audit-admin",
        correlationId: randomUUID(),
      }),
      (transaction) => transaction.auditEvent.findMany({
        where: { entityId: account.id, action: { startsWith: "login." } },
        select: { action: true, actorId: true, afterMarker: true, organizationId: true },
        orderBy: { createdAt: "asc" },
      }),
    );
    expect(adminEvents.map((event) => event.action)).toEqual(expect.arrayContaining([
      "login.failed",
      "login.locked",
      "login.password-verified",
      "login.unlocked",
    ]));
    expect(adminEvents.every((event) => event.actorId === account.id && event.organizationId === null)).toBe(true);
    expect(JSON.stringify(adminEvents.map((event) => event.afterMarker))).not.toMatch(/otp|@fixture\.test|Synthetic-lock|847291|hunter2/i);
    const tenantEvents = await runInAuthorizedDatabaseTransaction(
      createDatabaseAuthorizationContext({
        kind: "tenant-user",
        userId: account.id,
        organizationId: randomUUID(),
        membershipId: randomUUID(),
        role: "ORG_MEMBER",
        correlationId: randomUUID(),
      }),
      (transaction) => transaction.auditEvent.findMany({
        where: { entityId: account.id, action: { startsWith: "login." } },
      }),
    );
    expect(tenantEvents).toEqual([]);
    const forged = await runInAuthorizedDatabaseTransaction(
      createIdentityDatabaseAuthorizationContext({ userId: account.id, correlationId: randomUUID() }),
      (transaction) => transaction.auditEvent.create({
        data: {
          organizationId: null,
          actorType: "USER",
          actorId: account.id,
          action: "login.failed",
          entityType: "User",
          entityId: randomUUID(),
          source: "identity-access",
          correlationId: randomUUID(),
        },
      }).then(() => "wrote", (error) => error),
    );
    expect(forged).not.toBe("wrote");
  });

  it("denies tenant login when client access is unset and still allows platform admin", async () => {
    delete process.env.CLIENT_ACCESS_ENABLED;
    const member = await fixture();
    const denied = await post("/sign-in/username", { username: member.username, password });
    expect(denied.status).toBe(401);
    expect(await denied.json()).toMatchObject({ error: loginInvalidPublicError });
    const adminId = randomUUID();
    const adminUsername = `adm_${adminId.replaceAll("-", "").slice(0, 20)}`;
    ownedUsers.push(adminId);
    await prisma.user.create({
      data: {
        id: adminId, name: "Synthetic Admin", username: adminUsername, email: `${adminUsername}@fixture.test`,
        systemRole: "PLATFORM_ADMIN",
        accounts: { create: { id: randomUUID(), issuer: createLocalAccountIssuer("credential"), accountId: adminId, providerId: "credential", password: await hashPassword(password) } },
      },
    });
    expect((await post("/sign-in/username", { username: adminUsername, password })).status).toBe(200);
  });

  it("denies disabled and setup-pending accounts with the same public envelope", async () => {
    const disabled = await fixture();
    await prisma.user.update({ where: { id: disabled.id }, data: { disabledAt: new Date() } });
    const disabledResponse = await post("/sign-in/username", { username: disabled.username, password });
    expect(disabledResponse.status).toBe(401);
    expect(await disabledResponse.json()).toMatchObject({ error: loginInvalidPublicError });
    const pending = await fixture();
    await prisma.accountSetupToken.create({
      data: { userId: pending.id, tokenHash: `pending-${pending.id}`, expiresAt: new Date(Date.now() + 60_000) },
    });
    const pendingResponse = await post("/sign-in/username", { username: pending.username, password });
    expect(pendingResponse.status).toBe(401);
    expect(await pendingResponse.json()).toMatchObject({ error: loginInvalidPublicError });
  });
});
