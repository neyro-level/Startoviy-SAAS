# Security

**Status:** Active extension. [03_ARCHITECTURE.md](03_ARCHITECTURE.md) owns
architecture/profile; this file details trust boundaries and security proof.
`VERIFIED` is a current source fact; security targets require actual adversarial
evidence on the candidate SHA, not a blanket compliance claim.

## Trust boundaries

Required contract: browser/UI input is untrusted; authentication does not
replace server permission and resource checks. No secret reaches Git, docs,
argv, browser or logs. Avoid unnecessary PII in DTOs/events/audit/logs; derived
products define legitimate PII access, lawful retention/export/deletion.
Platform authority is explicit and never represented as a fake organization.
External HTTP/email/storage/AI effects are outside the business transaction.

`VERIFIED`: fresh persisted session/user/membership/MFA principal resolution,
admin-kind authorization and tenant transactions are implemented. Query/mutation
permission scope is server-owned; client organizationId/projectId is not proof.
TOTP remains mandatory for Platform Admin authority; current scheme and open
provisioning/reset/UI gaps are described in [AUTH](AUTH.md). Current membership
roles remain unchanged; project grants and stronger per-project policy TARGET.

## Database, commands and jobs

`VERIFIED`: transaction context uses parameterized PostgreSQL set_config(...,
true), limited to one transaction; RLS coverage/policies are source-controlled.
Web/worker identities must be non-owner NOBYPASSRLS, migrator separate. Tests
may use a dedicated guarded loopback `_test` bootstrap owner solely for
reset/seed, then switch to runtime role before assertions. Unknown targets are
rejected before reset; no development/production database is a test fallback.

`VERIFIED`: defineCommand parses/authorizes before a transaction; repositories
bind that same transaction for business/audit/idempotency/outbox. Workers own
post-commit at-least-once leases/retry/dead-letter. Queue payloads are untrusted
and validated/versioned; no raw credential or unnecessary PII belongs there.
`TARGET`: project-scoped contexts, safe optional consumer disable/restart and
new external adapters need their own native denial/adversarial tests.
[ADR-006](adr/ADR-006-postgresql-tenant-isolation.md),
[ADR-007](adr/ADR-007-command-atomicity-and-repository-boundary.md) and
[ADR-008](adr/ADR-008-outbox-plus-queue-reliability.md) own detailed contracts.

## Secrets, PII and errors

`VERIFIED`: Pino still censors explicit password/token/header/database paths.
A single server sanitizer also walks nested objects, arrays, Error
message/stack/cause, URL userinfo, emails and registered resolved SecretRef
values before a line is written. Correlation id and operational `code` stay
visible. The resolved-secret registry is bounded and has no TTL; overflow
fails closed with `SECRET_UNAVAILABLE` instead of forgetting a live value.
Safe API errors expose code/message and correlationId, not persistence detail.
`VERIFIED`: server-only `platform/security/secret-ref.ts` defines frozen,
branded environment references without capturing their values. Resolution reads
the current environment only at the trusted adapter boundary; missing values
produce `SECRET_UNAVAILABLE`, forged references `SECRET_REFERENCE_INVALID`.
JSON, strings and inspect mask the reference; status DTO contains only
`configured` and `[REDACTED]`. The resolved branded string is still a raw secret:
never serialize it into a DTO, queue event, browser response or log.
The architecture guard rejects transitive runtime client imports of SecretRef
and the existing raw server-environment reader, including
reexports, aliases and literal dynamic imports; erased types and genuine
Next server-action RPC boundaries do not ship the server implementation.
No vault, network/API endpoint or client configuration is added by this primitive.
`TARGET / REQUIRES CHECK`: adversarial nested/error/log cases and sensitive-source
lints. Callers never serialize raw secret values; resolve only an owned reference
at the narrow adapter boundary.
Value-free names/required conditions belong to [ENVIRONMENT](ENVIRONMENT.md).
PII inventory and derived retention/legal obligations belong to03; no legal
compliance, current production backup or universal deletion API is claimed.

## HTTP, forms, PWA and public data

`VERIFIED`: opt-in `outboundHttp` exposes a server-only HTTPS adapter with an
exact host allowlist, port 443, DNS resolved twice and pinned, blocked
loopback/RFC1918/IPv6-private/link-local/metadata, redirect revalidation,
timeouts and a byte cap. Credentials are SecretRef, never URL userinfo or a
client-supplied URL. Address checks are not a full network/proxy policy.
Streaming intake remains a later bounded-mode task.
`VERIFIED`: auth uses exact origin and PostgreSQL sign-in rate limit, production
requires trusted proxy CIDRs. Missing auth/readiness config returns safe503.
New setup/TOTP/recovery throttling and successful end-to-end flow need proof.
Public contact form calls an external receiver only when all three public
CONTACT variables are configured; default disabled response is not delivery.
Real receiver/consent policy is product-owned and requires explicit acceptance.

`VERIFIED`: SW bypasses private/API/auth/non-GET, caches public shell/static
assets; private/API HTTP no-store and private noindex policies are specified
in [02](02_PRODUCT_STRUCTURE.md). `TARGET / REQUIRES CHECK`: authenticated
cache inspection, logout/offline, disabled feature behavior and safe404/error
states against the final build. [ADR-012](adr/ADR-012-ui-pwa-error-observability-safety.md)
owns the safety boundary. Public legal/operator fields are demo placeholders;
derived release cannot reuse them. No client database, domain or provider is inherited.

## Evidence and delivery

Unit security/principal/logger tests and native setup/tenant/command/outbox
suites are existing proof sources. They run only in guarded disposable contexts.
Semgrep, dependency and secret scans must reflect real artifacts; scanning
configuration is not a security verdict. COMMERCIAL GitHub exact-head required
checks are mandatory under [ADR-015](adr/ADR-015-commercial-template-github-delivery.md),
in addition to relevant local proof. No stale/missing/failed check, direct main
push or administrative bypass is accepted. Phased protected merge is already
owner-authorized for the current program; production remains separately authorized.
