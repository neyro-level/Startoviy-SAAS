import "server-only";
import { symmetricDecrypt } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";
import { createIdentityDatabaseAuthorizationContext, runInAuthorizedDatabaseTransaction } from "../database/transaction.ts";
import { appendLoginAudit } from "./login-audit.ts";
import { createMfaFactorProof } from "./mfa-session-proof.ts";

// Better Auth owns authentication. This supplemental authority check binds a
// successful verification to the factor still current when proof is recorded.
export async function recordTotpSessionProof(input: { sessionId: string; userId: string; code: unknown }, key: string): Promise<boolean> {
  if (typeof input.code !== "string" || !/^[0-9]{6}$/u.test(input.code)) return false;
  const code = input.code;
  return runInAuthorizedDatabaseTransaction(createIdentityDatabaseAuthorizationContext({ userId: input.userId, correlationId: `totp-proof-${input.sessionId}` }), async (transaction) => {
    const now = new Date();
    const session = await transaction.session.findUnique({ where: { id: input.sessionId }, select: { id: true, userId: true, expiresAt: true } });
    const user = await transaction.user.findUnique({ where: { id: input.userId }, select: { disabledAt: true, twoFactorEnabled: true } });
    const factors = await transaction.twoFactor.findMany({ where: { userId: input.userId }, take: 2, select: { id: true, userId: true, secret: true, verified: true } });
    if (!session || session.userId !== input.userId || session.expiresAt <= now || !user?.twoFactorEnabled || user.disabledAt || factors.length !== 1 || !factors[0].verified) return false;
    let secret: string;
    try { secret = await symmetricDecrypt({ key, data: factors[0].secret }); } catch { return false; }
    if (!await createOTP(secret).verify(code)) return false;
    const changed = await transaction.session.updateMany({ where: { id: session.id, userId: input.userId, expiresAt: { gt: now } }, data: { twoFactorVerifiedAt: now, twoFactorProof: createMfaFactorProof(factors[0], session.id, key) } });
    if (changed.count !== 1) return false;
    await appendLoginAudit(transaction, {
      userId: input.userId,
      action: "login.mfa",
      correlationId: `totp-proof-${input.sessionId}`,
      afterMarker: { factorVerified: true },
    });
    return true;
  });
}
