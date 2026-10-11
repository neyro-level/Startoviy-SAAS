import { createHash, randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "better-auth/crypto";
import { createLocalAccountIssuer } from "better-auth/db";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { auth } from "../../src/platform/auth/auth.ts";
import { getPrismaClient } from "../../src/platform/database/prisma/client.ts";
import { getPrincipalStateByUserId } from "../../src/platform/authorization/principal-factories.ts";
import { completePlatformRecovery } from "../../src/modules/identity-access/server.ts";

const password = "Synthetic-totp-fixture-only-0000";
const base = process.env.BETTER_AUTH_URL!;
const ownedUsers: string[] = [];
const ownedOrganizations: string[] = [];
const prisma = getPrismaClient();
type Jar = Map<string, string>;
const headers = (jar: Jar) => new Headers({ cookie: [...jar].map(([a, b]) => `${a}=${b}`).join("; ") });
async function post(jar: Jar, path: string, body: unknown) {
  const response = await auth!.handler(new Request(`${base}/api/auth${path}`, { method: "POST", headers: { ...Object.fromEntries(headers(jar)), "content-type": "application/json", origin: base }, body: JSON.stringify(body) }));
  for (const cookie of response.headers.getSetCookie()) {
    const first = cookie.split(";")[0]; const split = first.indexOf("=");
    jar.set(first.slice(0, split), first.slice(split + 1));
  }
  return response;
}
const session = (jar: Jar) => auth!.api.getSession({ headers: headers(jar), query: { disableCookieCache: true } });
async function principal(userId: string, jar: Jar) {
  const current = await session(jar);
  return current ? getPrincipalStateByUserId(userId, { authenticatedSessionId: current.session.id }) : null;
}
function otp(uri: string) { return createOTP(new TextDecoder().decode(base32.decode(new URL(uri).searchParams.get("secret")!))); }
async function fixture() {
  const id = randomUUID(); const username = `totp_${id.replaceAll("-", "").slice(0, 20)}`; const jar: Jar = new Map(); ownedUsers.push(id);
  await prisma.user.create({ data: { id, name: "Synthetic TOTP", username, email: `${username}@fixture.test`, systemRole: "PLATFORM_ADMIN", accounts: { create: { id: randomUUID(), issuer: createLocalAccountIssuer("credential"), accountId: id, providerId: "credential", password: await hashPassword(password) } } } });
  const response = await post(jar, "/sign-in/username", { username, password, twoFactorVerifiedAt: new Date(), twoFactorProof: "0".repeat(64) });
  expect(response.status).toBe(200);
  return { id, username, jar };
}
async function enroll(jar: Jar) {
  const response = await post(jar, "/two-factor/enable", { password }); expect(response.status).toBe(200);
  return response.json() as Promise<{ totpURI: string; backupCodes: string[] }>;
}
async function verify(jar: Jar, uri: string) {
  const response = await post(jar, "/two-factor/verify-totp", { code: await otp(uri).totp(), trustDevice: false }); expect(response.status).toBe(200);
}
beforeEach(async () => { expect(auth).not.toBeNull(); await prisma.rateLimit.deleteMany(); });
afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: ownedUsers.splice(0) } } });
  await prisma.organization.deleteMany({ where: { id: { in: ownedOrganizations.splice(0) } } });
});

describe("actual Better Auth current-session TOTP authority", () => {
  it("denies a live authenticated member immediately after membership removal", async () => {
    const f = await fixture();
    await prisma.user.update({ where: { id: f.id }, data: { systemRole: "MEMBER" } });
    const organizationId = randomUUID(); ownedOrganizations.push(organizationId);
    await prisma.organization.create({ data: { id: organizationId, slug: `fixture-${organizationId}`, name: "Synthetic Membership", members: { create: { userId: f.id, tenantRole: "ORG_MEMBER" } } } });
    expect(await principal(f.id, f.jar)).toMatchObject({ principal: { kind: "tenant-user", organizationId } });
    await prisma.member.deleteMany({ where: { organizationId, userId: f.id } });
    expect(await session(f.jar)).not.toBeNull();
    expect(await principal(f.id, f.jar)).toBeNull();
  });
  it("denies password-only/body spoof and grants only a real successful current TOTP", async () => {
    const f = await fixture(); const initial = await session(f.jar); expect(initial).not.toBeNull();
    const row = await prisma.session.findUniqueOrThrow({ where: { id: initial!.session.id } });
    expect(row.twoFactorVerifiedAt).toBeNull(); expect(row.twoFactorProof).toBeNull();
    expect(await principal(f.id, f.jar)).toBeNull();
    const enrollment = await enroll(f.jar);
    const generator = otp(enrollment.totpURI); let badCode = "000000";
    while (await generator.verify(badCode)) badCode = String(Number(badCode) + 1).padStart(6, "0");
    expect((await post(f.jar, "/two-factor/verify-totp", { code: badCode, twoFactorVerifiedAt: new Date(), twoFactorProof: "0".repeat(64) })).status).toBeGreaterThanOrEqual(400);
    expect(await principal(f.id, f.jar)).toBeNull();
    await verify(f.jar, enrollment.totpURI);
    expect(await principal(f.id, f.jar)).toMatchObject({ principal: { kind: "platform-admin", userId: f.id } });
    const current = await session(f.jar);
    expect(current!.session).not.toHaveProperty("twoFactorProof"); expect(current!.session).not.toHaveProperty("twoFactorVerifiedAt");
  });

  it("clears inherited proof on factor disable/re-issued session and requires new enrollment", async () => {
    const f = await fixture(); const enrollment = await enroll(f.jar); await verify(f.jar, enrollment.totpURI);
    const oldJar = new Map(f.jar); const old = await session(oldJar);
    expect(await principal(f.id, oldJar)).not.toBeNull();
    expect((await post(f.jar, "/two-factor/disable", { password })).status).toBe(200);
    expect(await principal(f.id, f.jar)).toBeNull(); expect(await session(oldJar)).toBeNull();
    const next = await session(f.jar); expect(next!.session.id).not.toBe(old!.session.id);
    const row = await prisma.session.findUniqueOrThrow({ where: { id: next!.session.id } });
    expect(row.twoFactorVerifiedAt).toBeNull(); expect(row.twoFactorProof).toBeNull();
    const replacement = await enroll(f.jar); await verify(f.jar, replacement.totpURI);
    expect(await principal(f.id, f.jar)).not.toBeNull(); expect(await session(oldJar)).toBeNull();
  });

  it("denies a rotated factor until actual TOTP verifies the already-authenticated session", async () => {
    const f = await fixture(); const enrollment = await enroll(f.jar); await verify(f.jar, enrollment.totpURI);
    const before = await session(f.jar); const replacement = await enroll(f.jar);
    expect(await principal(f.id, f.jar)).toBeNull();
    await verify(f.jar, replacement.totpURI);
    expect((await session(f.jar))!.session.id).toBe(before!.session.id);
    expect(await principal(f.id, f.jar)).not.toBeNull();
    const passwordOnly: Jar = new Map();
    const challenge = await post(passwordOnly, "/sign-in/username", { username: f.username, password });
    expect(challenge.status).toBe(200); expect((await challenge.json()).twoFactorRedirect).toBe(true);
    expect(await session(passwordOnly)).toBeNull();
    await verify(passwordOnly, replacement.totpURI);
    expect(await principal(f.id, passwordOnly)).not.toBeNull();
  });

  it("does not promote backup-code login to a verified TOTP session", async () => {
    const f = await fixture(); const enrollment = await enroll(f.jar); await verify(f.jar, enrollment.totpURI);
    const jar: Jar = new Map(); expect((await post(jar, "/sign-in/username", { username: f.username, password })).status).toBe(200);
    expect((await post(jar, "/two-factor/verify-backup-code", { code: enrollment.backupCodes[0] })).status).toBe(200);
    expect(await session(jar)).not.toBeNull(); expect(await principal(f.id, jar)).toBeNull();
    await verify(jar, enrollment.totpURI);
    expect(await principal(f.id, jar)).not.toBeNull();
  });

  it("denies disabled identities, revoked sessions and stale recovery cookies", async () => {
    const f = await fixture(); const enrollment = await enroll(f.jar); await verify(f.jar, enrollment.totpURI);
    await prisma.user.update({ where: { id: f.id }, data: { disabledAt: new Date() } }); expect(await principal(f.id, f.jar)).toBeNull();
    await prisma.user.update({ where: { id: f.id }, data: { disabledAt: null } });
    const current = await session(f.jar); const revoked = new Map(f.jar);
    expect((await post(f.jar, "/revoke-session", { token: current!.session.token })).status).toBe(200);
    expect(await session(revoked)).toBeNull(); expect(await getPrincipalStateByUserId(f.id, { authenticatedSessionId: current!.session.id })).toBeNull();
    const freshJar: Jar = new Map(); expect((await post(freshJar, "/sign-in/username", { username: f.username, password })).status).toBe(200); await verify(freshJar, enrollment.totpURI);
    const recovery = `synthetic-recovery-${randomUUID()}`;
    await prisma.platformRecoveryToken.create({ data: { userId: f.id, tokenHash: createHash("sha256").update(recovery).digest("hex"), expiresAt: new Date(Date.now() + 60_000) } });
    expect(await completePlatformRecovery({ token: recovery, password: "Synthetic-recovered-only-0000" })).toEqual({ userId: f.id });
    expect(await session(freshJar)).toBeNull(); expect(await principal(f.id, freshJar)).toBeNull();
    expect(await prisma.twoFactor.count({ where: { userId: f.id } })).toBe(0);
  });
});
