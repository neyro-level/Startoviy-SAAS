import "server-only";

import { Prisma } from "../../generated/prisma/client.ts";
import type { DatabaseTransaction } from "../database/transaction.ts";

export const loginAuditActions = [
  "login.failed",
  "login.password-verified",
  "login.locked",
  "login.unlocked",
  "login.mfa",
  "login.recovery",
  "login.session-revoke",
] as const;

export type LoginAuditAction = (typeof loginAuditActions)[number];

const allowedMarkerKeys = new Set(["locked", "sessionsRevoked", "factorVerified"]);

export function toLoginAuditMarker(
  input: Readonly<Record<string, unknown>> | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!input) return Prisma.JsonNull;
  const marker: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowedMarkerKeys.has(key) || typeof value !== "boolean") continue;
    marker[key] = value;
  }
  return Object.keys(marker).length ? marker : Prisma.JsonNull;
}

export async function appendLoginAudit(
  transaction: DatabaseTransaction,
  input: {
    userId: string;
    action: LoginAuditAction;
    correlationId: string;
    afterMarker?: Readonly<Record<string, unknown>> | null;
  },
): Promise<void> {
  await transaction.auditEvent.create({
    data: {
      organizationId: null,
      actorType: "USER",
      actorId: input.userId,
      action: input.action,
      entityType: "User",
      entityId: input.userId,
      beforeMarker: Prisma.JsonNull,
      afterMarker: toLoginAuditMarker(input.afterMarker),
      source: "identity-access",
      correlationId: input.correlationId,
    },
  });
}
