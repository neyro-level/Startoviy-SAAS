import { createHmac, timingSafeEqual } from "node:crypto";

export interface MfaFactor { id: string; userId: string; secret: string; verified: boolean; }
export interface MfaSession { id: string; userId: string; expiresAt: Date; twoFactorVerifiedAt: Date | null; twoFactorProof: string | null; }

export function createMfaFactorProof(factor: MfaFactor, sessionId: string, key: string): string {
  return createHmac("sha256", key).update(JSON.stringify([factor.userId, factor.id, factor.secret, sessionId])).digest("hex");
}

export function hasCurrentMfaProof(input: { session: MfaSession | undefined; enabled: boolean; factors: MfaFactor[]; key: string | undefined; now?: Date }): boolean {
  const { session, enabled, factors, key } = input;
  const now = input.now ?? new Date();
  if (!session || !enabled || !key || factors.length !== 1 || !factors[0].verified
    || factors[0].userId !== session.userId || !Number.isFinite(session.expiresAt.getTime()) || session.expiresAt <= now
    || !session.twoFactorVerifiedAt || !Number.isFinite(session.twoFactorVerifiedAt.getTime())
    || session.twoFactorVerifiedAt > now || !/^[0-9a-f]{64}$/u.test(session.twoFactorProof ?? "")) return false;
  return timingSafeEqual(Buffer.from(session.twoFactorProof!, "hex"), Buffer.from(createMfaFactorProof(factors[0], session.id, key), "hex"));
}

export function successfulTotpToken(result: unknown): string | null {
  return result !== null && typeof result === "object" && "token" in result && typeof result.token === "string" ? result.token : null;
}
