import "server-only";
import { projectIdentity } from "../config/project-identity.ts";

import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { recordTotpSessionProof } from "./record-totp-proof.ts";
import { successfulTotpToken } from "./mfa-session-proof.ts";
import { appendLoginAudit } from "./login-audit.ts";
import {
  createIdentityDatabaseAuthorizationContext,
  runInAuthorizedDatabaseTransaction,
} from "../database/transaction.ts";
import { twoFactor, username } from "better-auth/plugins";
import {
  hasDatabaseConfiguration,
  readAuthEnvironment,
} from "../config/server-environment.ts";
import { getPrismaClient } from "../database/prisma/client.ts";
import {
  createAuthIpAddressConfig,
  createAuthRateLimitConfig,
  createEmailPasswordConfig,
  isTotpVerificationPath,
} from "./security-config.ts";

const authEnvironment = readAuthEnvironment();
const isProductionRuntime = process.env.APP_ENV === "production";

export function hasAuthConfiguration() {
  return authEnvironment !== null && hasDatabaseConfiguration();
}

export const auth =
  hasAuthConfiguration() && authEnvironment
      ? betterAuth({
        secret: authEnvironment.secret,
        baseURL: authEnvironment.baseUrl,
        appName: projectIdentity.identity.productName,
        session: {
          additionalFields: {
            twoFactorVerifiedAt: {
              type: "date",
              required: false,
              input: false,
              returned: false,
            },
            twoFactorProof: { type: "string", required: false, input: false, returned: false },
          },
        },
        trustedOrigins: [
          authEnvironment.baseUrl,
          ...(process.env.NODE_ENV === "production"
            ? []
            : ["http://127.0.0.1:3000", "http://localhost:3000"]),
        ],
        database: prismaAdapter(getPrismaClient(), {
          provider: "postgresql",
        }),
        emailAndPassword: createEmailPasswordConfig(),
        rateLimit: createAuthRateLimitConfig(),
        advanced: {
          ipAddress: createAuthIpAddressConfig({
            trustedProxyCidrs: authEnvironment.trustedProxyCidrs,
            isProduction: isProductionRuntime,
          }),
          useSecureCookies: isProductionRuntime,
        },
        databaseHooks: {
          session: {
            create: {
              before: async (session) => ({ data: { ...session, twoFactorVerifiedAt: null, twoFactorProof: null } }),
            },
          },
        },
        hooks: {
          after: createAuthMiddleware(async (context) => {
            if (context.path === "/sign-out") {
              const session = context.context.session;
              if (!session) return;
              await runInAuthorizedDatabaseTransaction(
                createIdentityDatabaseAuthorizationContext({
                  userId: session.user.id,
                  correlationId: `login-sign-out-${session.session.id}`,
                }),
                (transaction) => appendLoginAudit(transaction, {
                  userId: session.user.id,
                  action: "login.session-revoke",
                  correlationId: `login-sign-out-${session.session.id}`,
                  afterMarker: { sessionsRevoked: true },
                }),
              );
              return;
            }
            if (!isTotpVerificationPath(context.path)) return;
            const current = context.context.newSession ?? context.context.session;
            const returnedToken = successfulTotpToken(context.context.returned);
            // Enrollment replaces the cookie/session before the SDK returns its
            // original session token. Both identities come from server context;
            // proof always targets the new live session, never the old token.
            if (!current || !returnedToken || (returnedToken !== current.session.token && returnedToken !== context.context.session?.session.token)) return;
            if (context.context.session && context.context.session.user.id !== current.user.id) return;
            await recordTotpSessionProof({ sessionId: current.session.id, userId: current.user.id, code: context.body?.code }, authEnvironment.secret);
          }),
        },
        plugins: [
          twoFactor(),
          username({
            displayUsername: false,
            immutableUsername: true,
            minUsernameLength: 3,
            maxUsernameLength: 30,
          }),
        ],
      })
    : null;
