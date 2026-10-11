# Data Model

**Status:** Active extension. [03_ARCHITECTURE.md](03_ARCHITECTURE.md) owns
cross-cutting contracts; [schema](../prisma/schema.prisma) and
[migrations](../prisma/migrations/) are the runtime source of truth.
`VERIFIED` map names existing models; a SQL constraint must be checked in
migrations as well as Prisma. Planned models are not schema facts.

## VERIFIED identity models

| Model | Relations / relevant fields | Boundary |
| --- | --- | --- |
| User | sessions/accounts/members/twoFactors/setupTokens/recoveryTokens/notificationReads; systemRole, disabledAt, setupCompletedAt | server-owned identity, fresh principal rereads status |
| Session | User; token unique, expiresAt, activeOrganizationId, twoFactorVerifiedAt, twoFactorProof, setupCompletedAt, legacy activeTeamId | persisted authority; TOTP proof binds current verified factor/user/session, excluded from public session; selection is not permission proof |
| Account | User; credential/provider data, password, token candidates | auth-only; issuer/accountId compound uniqueness |
| Verification | identifier/value/expiresAt | Better Auth verification material, never public DTO |
| TwoFactor | User; secret/backupCodes/verified/failedVerificationCount/lockedUntil | sensitive MFA material; fields alone do not prove every plugin path |
| RateLimit | unique key/count/lastRequest | database auth throttling |
| AccountSetupToken | User; unique tokenHash, expiry/consumedAt/revokedAt | one-time setup; no raw token stored |
| PlatformRecoveryToken | User; unique tokenHash, expiry/consumedAt/revokedAt | recovery, session revocation and MFA reenrollment |

## VERIFIED tenant and operation models

| Model | Relations / relevant constraints | Boundary |
| --- | --- | --- |
| Organization | members/projects/audit/idempotency/outbox/jobRuns/notifications; slug unique, version | tenant boundary |
| Member | User + Organization; unique organizationId/userId; tenantRole, version | organization membership, no project grant implied |
| Project | Organization; unique organizationId/slug and organizationId/id; status, version | neutral registry; project-level capabilities still TARGET |
| Notification | optional Organization/Project; unique dedupKey; visibility/category/severity | current presentation is platform-team/admin-only; composite tenant relation invariants include SQL migrations |
| NotificationRead | Notification + User; compound primary key notificationId/userId | per-user read state |
| AuditEvent | optional Organization; actor/action/entity/markers/correlation | minimal durable audit, markers must omit unnecessary PII/secrets |
| IdempotencyKey | optional Organization/OutboxEvent; unique scope/organizationScope/key, requestHash/status/response/expiry | same key with changed request conflicts; response must be safe |
| OutboxEvent | optional Organization; optional idempotencyKey, jobRuns; topic/version/payload/status/attempts/lease/correlation | durable post-commit delivery |
| JobRun | OutboxEvent + optional Organization; unique outboxEventId/attempt; worker/status/safeErrorCode | leased delivery attempts |
| RuntimeHeartbeat | unique runtime/workerId; heartbeat timestamps | infrastructure liveness, not tenant-owned business data |
| RetentionRun | status/counts/safeErrorCode/timestamps | maintenance evidence, not generic legal-retention policy |

## VERIFIED enums and RLS inventory

SystemRole: PLATFORM_ADMIN/STAFF/MEMBER. MembershipRole:
ORG_OWNER/ORG_MEMBER/VIEWER. ProjectStatus: ACTIVE/PLANNED/DISABLED.
AuditActorType: USER/SYSTEM. IdempotencyStatus: PROCESSING/COMPLETED/FAILED.
OutboxStatus: PENDING/PROCESSING/PROCESSED/DEAD_LETTER.
JobRunStatus and RetentionRunStatus: RUNNING/SUCCESS/FAILED.
NotificationCategory: SYSTEM/PROJECT/ACCESS/QUEUE; NotificationSeverity:
INFO/SUCCESS/WARNING/ERROR; NotificationVisibility:
PLATFORM_TEAM/PLATFORM_ADMIN_ONLY. No new project/billing/provider enum is inferred.

`tenant-owned-models.ts` currently declares exactly Organization, Member,
Project, Notification, NotificationRead, AuditEvent, IdempotencyKey, OutboxEvent
and JobRun. Migrations enable and force RLS on this inventory; authorized
transaction sets local principal/actor/org/correlation context. SQL policy
includes explicit platform and infrastructure contexts, not a fake tenant.
Runtime identities are configured non-owner NOBYPASSRLS; web/worker do not
receive migrator authority. [ADR-006](adr/ADR-006-postgresql-tenant-isolation.md)
owns the role/policy/composite-constraint contract. `verify:rls-coverage` and
native tenant-isolation tests prove declared tenant coverage on their SHA;
they cannot prove future within-org project isolation.

## TARGET additions and migration policy

Neutral project grants/capabilities, project-owned storage/outbound/worker
records and any project DB context require additive Starter-owned migrations,
policy/coverage and cross-project negative tests. No donor domain migration
or role taxonomy is copied. A disabled optional module remains neutral.
Starter has no production database; existing forward migration IDs and security
meaning are preserved. A derived production product never squashes an applied
migration; it owns baseline, runtime roles, secrets and recovery evidence.
[AUTH](AUTH.md) owns identity lifecycle; [SECURITY](SECURITY.md) owns trust/PII;
this map does not assert complete UI or completed new capability tests.
