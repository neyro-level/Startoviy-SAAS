# ADR-002: Strong starter hardening boundary

**Status:** Accepted architecture boundary; historical delivery premises superseded by ADR-015

The EXPERIMENT/SourceCraft/manual-gate and original no-generator/merge premises
below describe the earlier program. ADR-015 and the current canon own
COMMERCIAL/GitHub, derivation and owner-authorized phased protected merge.
Security and isolation boundaries remain applicable.

## Context

`АМС Старт` is a reusable copy-source foundation, not a product reference or a
production application. Its baseline already includes organizations, roles,
audit, a transactional outbox and a worker boundary, but it does not yet prove
the stronger guarantees required before a derived product is trusted with real
users or data.

The approved program `AMS-MICROSAAS-HARDENING-2026-01 v3` must improve those
platform guarantees without importing provider-specific modules, production
identity, credentials or deployment state from another application.

## Decision

The starter remains an `EXPERIMENT` copy-source and keeps this platform profile:

```text
TENANCY = multi-tenant
ASYNC = outbox-plus-queue
DATA = pii
DELIVERY = own-saas
PLATFORM_ADMIN = enabled
```

The hardening program is limited to neutral platform foundations:

- explicit server-owned tenant context and default-deny tenant access;
- PostgreSQL-backed isolation, command transaction boundaries and durable audit;
- transactional outbox plus queue, lease, retry, dead-letter and retention
  evidence;
- secure identity provisioning, Platform Admin MFA/recovery and server-side
  rate limiting;
- reproducible test, artifact, derivation and manual-gate templates.

The following remain outside the starter: a product domain, provider
integrations, production secrets, a production database or host, and an
automatic production release.

## Traceability boundary

Current lasting guarantees belong to01/03, the detailed security ADRs and
HANDOVER guarantee-to-proof map. Original task graphs, audit/approval records
and run verdicts remain in Git/tracker; they are not inherited documentation.
ADR-015 owns current protected-PR merge authority and no-production boundary.

## Consequences

- `outbox-plus-queue` is retained as a tested optional foundation; a derived
  product does not need to run a worker until it introduces an async contract.
- A derived product must select `COMMERCIAL` or `CRITICAL`, its own secrets,
  database topology and release identity before production.
- The program may add neutral contracts and evidence, but it must not turn the
  starter into a generator or a second product.
