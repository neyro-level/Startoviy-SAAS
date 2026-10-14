import "server-only";

import { Prisma } from "../../generated/prisma/client.ts";
import { isClientAccessEnabled } from "../config/server-environment.ts";
import { createIdentityDatabaseAuthorizationContext, runInAuthorizedDatabaseTransaction } from "../database/transaction.ts";
import { getPrismaClient } from "../database/prisma/client.ts";
import { createPublicErrorResponse } from "../http/error-envelope.ts";
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

async function findLoginUser(identity: LoginIdentity) {
  return getPrismaClient().user.findUnique({
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
  });
}

function invalidLoginResponse(correlationId: string) {
  return createPublicErrorResponse({ ...loginInvalidPublicError, correlationId }, 401);
}

async function withLockedUser(userId: string, correlationId: string, mutate: (snapshot: LoginLockoutSnapshot) => LoginLockoutSnapshot) {
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
      const next = mutate({ failedLoginCount: current.failedLoginCount, loginLockedUntil: current.loginLockedUntil });
      if (next.failedLoginCount === current.failedLoginCount
        && (next.loginLockedUntil?.getTime() ?? 0) === (current.loginLockedUntil?.getTime() ?? 0)) return;
      await transaction.user.update({
        where: { id: userId },
        data: { failedLoginCount: next.failedLoginCount, loginLockedUntil: next.loginLockedUntil },
      });
    },
  );
}

export async function denyLockedLogin(identity: LoginIdentity | null, correlationId: string, now = new Date()): Promise<Response | null> {
  if (!identity) return null;
  const user = await findLoginUser(identity);
  if (!user) return null;
  if (user.disabledAt || user.setupTokens.length > 0) return invalidLoginResponse(correlationId);
  if (user.systemRole === "MEMBER" && !isClientAccessEnabled()) return invalidLoginResponse(correlationId);
  if (!isLoginLocked(user, now)) return null;
  return invalidLoginResponse(correlationId);
}

export async function recordLoginResult(input: { identity: LoginIdentity | null; status: number; correlationId: string; now?: Date }) {
  if (!input.identity) return;
  const user = await findLoginUser(input.identity);
  if (!user) return;
  const now = input.now ?? new Date();
  if (input.status >= 200 && input.status < 300) {
    await withLockedUser(user.id, input.correlationId, clearedLoginLockoutSnapshot);
    return;
  }
  if (input.status !== 401) return;
  await withLockedUser(user.id, input.correlationId, (snapshot) => nextLoginFailureSnapshot(snapshot, now));
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
