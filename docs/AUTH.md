# Auth

**Status:** Active extension. [03_ARCHITECTURE.md](03_ARCHITECTURE.md) owns
profile/boundaries; this file owns identity/session/MFA implementation detail.
`VERIFIED` denotes current source; current test verdicts require matching SHA.

## VERIFIED framework and login

Better Auth is the sole identity/password/session framework. `auth.ts` uses
Prisma adapter, username and twoFactor plugins, exact configured base origin,
email/password enabled and public signup disabled. Auth is unavailable when
required auth/database configuration is absent; API returns safe503.
Public LoginDialog submits username/password and redirects to dashboard;
invalid login uses a generic error without account enumeration. Full TOTP,
setup and recovery interaction in this dialog is still TARGET.

`security-config.ts` configures PostgreSQL-backed rate limits: baseline100
requests/60s, sign-in username/email5/60s. Production requires explicit trusted
proxy CIDRs; without them startup rejects forwarded-IP trust. Local mode with
no trusted proxy does not trust x-forwarded-for. Rate-limit rules for other
sensitive setup/TOTP/recovery endpoints and distributed adversarial evidence
remain REQUIRES CHECK; do not infer them from the login rule.

## VERIFIED persisted session and authority

`principal-session.ts` disables cookie-cache, then reloads persisted session
user/expiry/activeOrganizationId. Missing, mismatched,
expired or revoked session is denied; user state/membership is read afresh.
`principal-factories.ts` denies disabled user and outstanding live setup token.
Platform Admin requires enabled two-factor authentication, exactly one current
verified factor and a persisted proof bound to that factor, user and session.
The proof is an HMAC over the factor's encrypted secret and server-owned IDs,
using the auth secret; the timestamp alone grants no authority. Only successful
`/two-factor/verify-totp` records it, after rechecking the current factor and code.
New sessions clear both fields. Disable, factor rotation, recovery and session
revocation invalidate authority; backup-code login grants no TOTP proof.
Both fields reject client input and are excluded from public session responses.
The installed Better Auth 1.7.2 enrollment path replaces the session before
returning its old token; the hook uses server context and stamps only the new
live session. Already-authenticated verification can stamp the current session.
There is no separate recent-MFA TTL; session expiry bounds proof lifetime.
Legacy timestamp-only sessions must verify TOTP again after the additive migration.

| Current role | Principal / boundary |
| --- | --- |
| PLATFORM_ADMIN | platform-admin; authority requires MFA; admin mutation/query authorization checks kind |
| STAFF | platform-staff; current permissions include project read-any and operations read-any, not platform management |
| MEMBER | tenant-user; valid membership, ORG_OWNER/ORG_MEMBER/VIEWER; permissions/resource checks still required |

One membership may resolve directly; multiple require explicit active organization,
never the first membership. `setCurrentActiveOrganization` validates persisted
session and membership before update; organization switcher UI is TARGET.
Roles/permission strings are preserved from principal.ts until additive accepted
change. Project-grant permissions are TARGET, not implied by organization role.

## VERIFIED setup/recovery backend; TARGET complete flow

`identity-admin-commands.ts` creates a locked random credential and a one-time
setup token, stores only SHA256 hash with24h expiry, revokes live siblings.
`completeAccountSetup` server service validates token/password12…128, hashes
password with Better Auth and atomically consumes an unexpired/unrevoked token,
updates credential/setupCompletedAt, revokes siblings and all sessions. Replay
returns null; clear token is server-issued capability, never audit/log content.
The create command returns setupToken to its caller; safe delivery and ensuring
it is not exposed by a browser action/log need hardening verification.

Recovery issuance requires existing Platform Admin authority, a non-disabled
Platform Admin target, hashed one-time token and1h expiry. Completion replaces
password, deletes old TwoFactor data, clears enabled flag, revokes sibling
recovery tokens and sessions. It does not manufacture MFA proof: the recovered
administrator must enroll/verify TOTP again. Completion services are exported
by identity server facade; recovery issuance exists in internal runtime but
is not yet exported there. No complete public setup/recovery screen/API is
shipped. A service function is not a usable end-to-end recovery product.

## Legacy operational tooling

`scripts/auth-admin.ts` create/reset still accepts exactly8 printable password
characters through stdin and rejects --password argv; it is a transitional
operator path, not the12…128 setup contract. Admin reset likewise uses the
old fixed8 schema. These paths must be reconciled in identity hardening before
trusted provisioning; CLI existence does not prove setup cannot be bypassed.
Use no real password/token in commands, documentation, logs or Git.
Bootstrap may only target a separately owned local/test environment; derived
production provisioning/recovery follows its reviewed operational contract.

## Verification map

[ADR-005](adr/ADR-005-identity-platform-admin-hardening.md) owns durable identity
invariants. Existing `account-setup.integration.test.ts` and
`principal-runtime-adoption.integration.test.ts` cover setup/recovery/session
and authority denies; `current-session-totp.integration.test.ts` exercises the
actual installed auth handler with enrollment, challenge, disable, rotation,
backup-code, revoke, disabled-user, recovery and forged-field cases;
`auth-security-config.test.ts` covers limits/proxy guards;
principal tests cover role/scope rules. Browser shell suite proves invalid-login
throttling, not successful TOTP/recovery. TARGET proof includes one-time token
expiry/replay/atomicity, disabled/revoked user on next request, fresh org/project
permissions, success and failures for full setup/TOTP/recovery, and safe delivery.
