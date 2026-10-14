import "server-only";

import { Prisma } from "../../generated/prisma/client.ts";
import { isClientAccessEnabled } from "../config/server-environment.ts";
import { createIdentityDatabaseAuthorizationContext, runInAuthorizedDatabaseTransaction } from "../database/transaction.ts";
import { createPublicErrorResponse } from "../http/error-envelope.ts";
import { appendLoginAudit, type LoginAuditAction } from "./login-audit.ts";
import {
  clearedLoginLockoutSnapshot,
  isLoginLocked,
  loginInvalidPublicError,
  nextLoginFailureSnapshot,
  type LoginLockoutSnapshot,
} from "./login-lockout-policy.ts";

export type LoginIdentity = { username: string } | { email: string };

type AuthHttpHandler = { GET: (request: Request) => Promise<Response>; POST: (request: Request) => Promise<Response> };

export async function getLoginIdentityFromRequest(request: Request): Promise<LoginIdentity | null> {
  if (request.method !== "POST") return null;
  const pathname = new URL(request.url).pathname.replace(/\/$/u, "");
  const field = pathname.endsWith("/sign-in/username") ? "username"
    : pathname.endsWith("/sign-in/email") ? "email" : null;
  if (!field) return null;
  try {
    const body: unknown = await request.clone().json();
    if (!body || typeof body !== "object") return null;
    const value = (body as Record<string, unknown>)[field];
    if (typeof value !== "string" || !value.trim()) return null;
    const normalized = value.trim().toLowerCase();
    return field === "email" ? { email: normalized } : { username: normalized };
  } catch {
    return null;
  }
}

async function findLoginUser(identity: LoginIdentity, correlationId: string) {
  return runInAuthorizedDatabaseTransaction(
    createIdentityDatabaseAuthorizationContext({
      userId: "username" in identity ? `login:${identity.username}` : `login:${identity.email}`,
      correlationId,
    }),
    (transaction) => transaction.user.findUnique({
      where: identity,
      select: {
        id: true,
        systemRole: true,
        disabledAt: true,
        failedLoginCount: true,
        loginLockedUntil: true,
        setupTokens: {
          where: { consumedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
          select: { id: true },
          take: 1,
        },
      },
    }),
  );
}

function invalidLoginResponse(correlationId: string) {
  return createPublicErrorResponse({ ...loginInvalidPublicError, correlationId }, 401);
}

async function withLockedUser(
  userId: string,
  correlationId: string,
  mutate: (snapshot: LoginLockoutSnapshot) => LoginLockoutSnapshot,
  audits: (current: LoginLockoutSnapshot, next: LoginLockoutSnapshot) => readonly LoginAuditAction[],
) {
  await runInAuthorizedDatabaseTransaction(
    createIdentityDatabaseAuthorizationContext({ userId, correlationId }),
    async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ id: string; failedLoginCount: number; loginLockedUntil: Date | null }>>(Prisma.sql`
        SELECT id, "failedLoginCount", "loginLockedUntil"
        FROM "User"
        WHERE id = ${userId}
        FOR UPDATE
      `);
      const current = rows[0];
      if (!current) return;
      const snapshot = { failedLoginCount: current.failedLoginCount, loginLockedUntil: current.loginLockedUntil };
      const next = mutate(snapshot);
      if (next.failedLoginCount !== current.failedLoginCount
        || (next.loginLockedUntil?.getTime() ?? 0) !== (current.loginLockedUntil?.getTime() ?? 0)) {
        await transaction.user.update({
          where: { id: userId },
          data: { failedLoginCount: next.failedLoginCount, loginLockedUntil: next.loginLockedUntil },
        });
      }
      for (const action of audits(snapshot, next)) {
        await appendLoginAudit(transaction, {
          userId,
          action,
          correlationId,
          afterMarker: action === "login.locked" ? { locked: true } : action === "login.unlocked" ? { locked: false } : null,
        });
      }
    },
  );
}

export async function denyLockedLogin(identity: LoginIdentity | null, correlationId: string, now = new Date()): Promise<Response | null> {
  if (!identity) return null;
  const user = await findLoginUser(identity, correlationId);
  if (!user) return null;
  const denied = user.disabledAt || user.setupTokens.length > 0
    || (user.systemRole === "MEMBER" && !isClientAccessEnabled())
    || isLoginLocked(user, now);
  if (!denied) return null;
  await runInAuthorizedDatabaseTransaction(
    createIdentityDatabaseAuthorizationContext({ userId: user.id, correlationId }),
    (transaction) => appendLoginAudit(transaction, { userId: user.id, action: "login.failed", correlationId }),
  );
  return invalidLoginResponse(correlationId);
}

export async function recordLoginResult(input: { identity: LoginIdentity | null; status: number; correlationId: string; now?: Date }) {
  if (!input.identity) return;
  const user = await findLoginUser(input.identity, input.correlationId);
  if (!user) return;
  const now = input.now ?? new Date();
  if (input.status >= 200 && input.status < 300) {
    await withLockedUser(
      user.id,
      input.correlationId,
      clearedLoginLockoutSnapshot,
      (current) => current.failedLoginCount > 0 || current.loginLockedUntil
        ? ["login.password-verified", "login.unlocked"]
        : ["login.password-verified"],
    );
    return;
  }
  if (input.status !== 401) return;
  await withLockedUser(
    user.id,
    input.correlationId,
    (snapshot) => nextLoginFailureSnapshot(snapshot, now),
    (current, next) => isLoginLocked(current, now) ? [] : isLoginLocked(next, now)
      ? ["login.failed", "login.locked"]
      : ["login.failed"],
  );
}

export async function handleAuthHttpRequest(input: {
  method: "GET" | "POST";
  request: Request;
  auth: { handler: (request: Request) => Promise<Response> } | null;
  correlationId: string;
  createHandlers: (auth: { handler: (request: Request) => Promise<Response> }) => AuthHttpHandler;
}): Promise<Response> {
  if (!input.auth) {
    return createPublicErrorResponse({
      code: "AUTH_UNAVAILABLE",
      message: "Сервис авторизации временно недоступен.",
      correlationId: input.correlationId,
    }, 503);
  }
  const identity = input.method === "POST" ? await getLoginIdentityFromRequest(input.request) : null;
  const locked = await denyLockedLogin(identity, input.correlationId);
  if (locked) {
    locked.headers.set("X-Correlation-ID", input.correlationId);
    return locked;
  }
  const handlers = input.createHandlers(input.auth);
  const response = await (input.method === "GET" ? handlers.GET : handlers.POST)(input.request);
  if (input.method === "POST") await recordLoginResult({ identity, status: response.status, correlationId: input.correlationId });
  if (input.method === "POST" && identity && response.status === 401) {
    const neutralized = invalidLoginResponse(input.correlationId);
    neutralized.headers.set("X-Correlation-ID", input.correlationId);
    return neutralized;
  }
  response.headers.set("X-Correlation-ID", input.correlationId);
  if (input.request.headers.get("x-correlation-id") !== input.correlationId) {
    response.headers.set("Vary", "X-Correlation-ID");
  }
  return response;
}
