import { describe, expect, it } from "vitest";
import { createMfaFactorProof, hasCurrentMfaProof, successfulTotpToken, type MfaFactor, type MfaSession } from "../src/platform/auth/mfa-session-proof.ts";
const key = "synthetic-test-only-mfa-key-000000000000";
const now = new Date("2026-10-12T12:00:00Z");
const factor: MfaFactor = { id: "factor", userId: "user", secret: "encrypted-synthetic-only", verified: true };
const session: MfaSession = { id: "current", userId: "user", expiresAt: new Date(now.getTime() + 60000), twoFactorVerifiedAt: now, twoFactorProof: createMfaFactorProof(factor, "current", key) };
describe("current session factor binding", () => {
  it("accepts only the current verified factor and bound live session", () => {
    expect(hasCurrentMfaProof({ session, enabled: true, factors: [factor], key, now })).toBe(true);
    for (const changed of [{ ...factor, secret: "rotated" }, { ...factor, id: "replacement" }, { ...factor, userId: "other" }, { ...factor, verified: false }]) expect(hasCurrentMfaProof({ session, enabled: true, factors: [changed], key, now })).toBe(false);
  });
  it("denies legacy, revoked, transferred, expired and future proofs", () => {
    for (const changed of [undefined, { ...session, twoFactorProof: null }, { ...session, twoFactorVerifiedAt: null }, { ...session, id: "new-session" }, { ...session, userId: "other" }, { ...session, expiresAt: now }, { ...session, expiresAt: new Date(NaN) }, { ...session, twoFactorVerifiedAt: new Date(now.getTime() + 1) }, { ...session, twoFactorProof: "0".repeat(64) }]) expect(hasCurrentMfaProof({ session: changed, enabled: true, factors: [factor], key, now })).toBe(false);
    expect(hasCurrentMfaProof({ session, enabled: false, factors: [factor], key, now })).toBe(false);
    expect(hasCurrentMfaProof({ session, enabled: true, factors: [], key, now })).toBe(false);
    expect(hasCurrentMfaProof({ session, enabled: true, factors: [factor, factor], key, now })).toBe(false);
    expect(hasCurrentMfaProof({ session, enabled: true, factors: [factor], key: undefined, now })).toBe(false);
    expect(hasCurrentMfaProof({ session, enabled: true, factors: [factor], key: "changed-key", now })).toBe(false);
  });
  it("recognizes only a successful endpoint token", () => {
    expect(successfulTotpToken({ token: "synthetic-session-token" })).toBe("synthetic-session-token");
    for (const value of [null, undefined, new Error("failure"), { code: "INVALID_CODE" }, { twoFactorRedirect: true }, { token: 42 }]) expect(successfulTotpToken(value)).toBeNull();
  });
});
