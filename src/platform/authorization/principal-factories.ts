import { hasCurrentMfaProof } from "../auth/mfa-session-proof.ts";
import { readAuthEnvironment } from "../config/server-environment.ts";
import { createCorrelationId } from "../http/correlation.ts";
import {
  createIdentityDatabaseAuthorizationContext,
  runInAuthorizedDatabaseTransaction,
} from "../database/transaction.ts";
import type {
  PlatformAdminPrincipal,
  PlatformStaffPrincipal,
  PrincipalContext,
  TenantRole,
  TenantUserPrincipal,
} from "./principal.ts";

export interface PrincipalFactoryOptions {
  correlationId?: string;
  selectedOrganizationId?: string | null;
  authenticatedSessionId?: string;
}

export interface PrincipalState {
  principal: PrincipalContext;
  displayName: string;
}

function parseTenantRole(value: string): TenantRole {
  if (value === "ORG_OWNER" || value === "ORG_MEMBER" || value === "VIEWER") {
    return value;
  }
  throw new Error(`Unsupported tenant role: ${value}`);
}

export async function getPrincipalStateByUserId(
  userId: string,
  options: PrincipalFactoryOptions = {},
): Promise<PrincipalState | null> {
  const now = new Date();
  const correlationId = options.correlationId ?? createCorrelationId();
  const user = await runInAuthorizedDatabaseTransaction(
    createIdentityDatabaseAuthorizationContext({ userId, correlationId }),
    (transaction) => transaction.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        systemRole: true,
        disabledAt: true,
        twoFactorEnabled: true,
        twoFactors: { take: 2, select: { id: true, userId: true, secret: true, verified: true } },
        sessions: { where: { id: options.authenticatedSessionId ?? "", expiresAt: { gt: now } }, take: 1,
          select: { id: true, userId: true, expiresAt: true, twoFactorVerifiedAt: true, twoFactorProof: true } },
        setupTokens: {
          where: { consumedAt: null, revokedAt: null, expiresAt: { gt: now } },
          select: { id: true },
          take: 1,
        },
        members: {
          orderBy: { organizationId: "asc" },
          select: { id: true, organizationId: true, tenantRole: true },
        },
      },
    }),
  );
  if (!user || user.disabledAt || user.setupTokens.length > 0) return null;
  if (options.authenticatedSessionId && user.sessions.length !== 1) return null;

  let principal: PrincipalContext;
  if (user.systemRole === "PLATFORM_ADMIN") {
    if (!hasCurrentMfaProof({ session: user.sessions[0], enabled: user.twoFactorEnabled, factors: user.twoFactors, key: readAuthEnvironment()?.secret, now })) return null;
    principal = {
      kind: "platform-admin",
      userId: user.id,
      correlationId,
    } satisfies PlatformAdminPrincipal;
  } else if (user.systemRole === "STAFF") {
    principal = { kind: "platform-staff", userId: user.id, correlationId } satisfies PlatformStaffPrincipal;
  } else {
    const selectedMembership = options.selectedOrganizationId
      ? user.members.find((membership) => membership.organizationId === options.selectedOrganizationId)
      : user.members.length === 1 ? user.members[0] : null;
    if (!selectedMembership) return null;
    principal = {
      kind: "tenant-user",
      userId: user.id,
      organizationId: selectedMembership.organizationId,
      membershipId: selectedMembership.id,
      role: parseTenantRole(selectedMembership.tenantRole),
      correlationId,
    } satisfies TenantUserPrincipal;
  }

  return {
    principal,
    displayName: user.name,
  };
}

export function createJobPrincipal(input: {
  jobName: string;
  organizationId?: string | null;
  correlationId?: string;
}): PrincipalContext {
  return {
    kind: "job",
    jobName: input.jobName,
    organizationId: input.organizationId ?? null,
    correlationId: input.correlationId ?? createCorrelationId(),
  };
}

export function requirePlatformAdmin(principal: PrincipalContext): PlatformAdminPrincipal {
  if (principal.kind !== "platform-admin") {
    throw new Error("PLATFORM_ADMIN_REQUIRED");
  }
  return principal;
}

export function requirePlatformStaff(principal: PrincipalContext): PlatformStaffPrincipal {
  if (principal.kind !== "platform-staff") {
    throw new Error("PLATFORM_STAFF_REQUIRED");
  }
  return principal;
}

export function requireTenantUser(principal: PrincipalContext): TenantUserPrincipal {
  if (principal.kind !== "tenant-user") {
    throw new Error("TENANT_USER_REQUIRED");
  }
  return principal;
}
