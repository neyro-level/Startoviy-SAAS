# Architecture — АМС Старт

**Статус:** Active
**Platform contract:** AMS Application Platform Core 3.4 — Solo Minimal

## Delivery and project profile

```text
REPOSITORY_ROLE = template
DELIVERY_PROFILE = COMMERCIAL
CANONICAL_PROVIDER = github
REPOSITORY_VISIBILITY = private
TENANCY = multi-tenant
ASYNC = outbox-plus-queue
DATA = pii
DELIVERY = own-saas
PLATFORM_ADMIN = enabled
```

This repository is a copy-source starter. It has no production users, host,
database, secrets or release authority. A pull request is never a release and
the hardening program authorizes `PR_ONLY`, not automatic merge or production.

## Source of truth

| Area | Authoritative source |
| --- | --- |
| Product scope | `01_PRD.md` |
| Screens, routes and flows | `02_PRODUCT_STRUCTURE.md` |
| Architecture, profile, security and data policy | this file and ADRs |
| Current schema and migrations | `prisma/schema.prisma`, `prisma.config.ts`, `prisma/migrations/` |
| Current work | `04_BACKLOG.md`; execution state is local Backlog, excluded from product copies |
| Release template | `05_RELEASE_CHECKLIST.md`, Docker/Compose and `ops/` |
| Final conformance and derived handover | `HANDOVER.md` and ADR-014 |
| Exact versions | `package.json`, `pnpm-lock.yaml`, `.node-version`, Dockerfile |

The detailed `AUTH.md`, `DATA_MODEL.md`, `SECURITY.md`, `ENVIRONMENT.md`,
`RUNBOOK_DEPLOY.md`, `ops/*` and two design-system documents remain justified
extensions. They refine the area named here and cannot override it.

## GitHub delivery contract

The owner approved `template` and `COMMERCIAL` as independent classifications.
GitHub is primary, canonical branch is `main`; SourceCraft is an optional
one-way mirror with no independent CI or release authority. See ADR-015.
Legacy SourceCraft/EXPERIMENT decisions are superseded for current delivery.

Runtime is Node **24.20.0** and pnpm **11.5.1**, installed from the frozen
lockfile. The private reusable verifier is pinned to reviewed
`neyro-level/AMS_DELIVERY_CORE` revision
`a39227c11a017bf126d3ba416f8dd5da7ff24449`. The consumer binds `expected_sha`
to the current PR head (or canonical push SHA); it must check out that exact
commit with read-only permissions and no inherited secrets. Required context
is `commercial-gate / verify`, including an always-running failure gate.

The project contract preserves quick/config/architecture checks, unit and
security tests, secret scanning, native PostgreSQL 18 foundation/auth/RLS/
atomicity/outbox proof, worker build/smoke, browser checks and build. Security
and dependency scans remain relevant proof for shipped artifacts. Disposable
test resources use literal loopback and dedicated test identities; production
credentials, managed databases and production runners are excluded. A static
SourceCraft policy PASS or local build does not satisfy this provider gate.
Protection and successful provider runs require actual API readback; workflow
presence is not evidence. This contract grants no automatic merge or deploy.

Permanent template docs retain architecture, security, UI, derivation and
technical acceptance instructions. Task queues, master-plans, wave inventories
and execution snapshots are not inherited product content. Unique long-term
decisions must be preserved here or in ADRs before legacy history is removed.
Client facts, offers, SEO and production identity belong to each derived product.

## Modular monolith

| Module | Owns | Public boundary |
| --- | --- | --- |
| `identity-access` | users, memberships, auth administration | server facade and contracts |
| `project-registry` | neutral tenant project registry | server facade and DTOs |
| `platform-operations` | audit, idempotency, outbox, jobs, readiness | server facade and worker contracts |
| `notifications` | notification feed/read state | server facade and DTOs |
| `platform-admin` | platform-wide summaries and operations UI | explicit admin presentation boundary |
| `platform/*` | database, commands, auth, authorization, config, observability | platform-owned server APIs |

Presentation calls a module facade. Application code uses ports and DTOs;
Prisma stays in `platform/database` and module infrastructure. External side
effects stay outside a business transaction.

## Data, tenancy and async direction

The selected profile is intentional: a shared deployment can serve independent
organizations and needs an explicit tenant principal, server-owned organization
context, scoped repositories, tenant-aware constraints and isolation tests.
RLS is an additional PostgreSQL protection layer, not a replacement for
authorization; its policy and runtime-role design are implemented in E03.

`outbox-plus-queue` is retained because durable business delivery, replay and
integration journaling are target guarantees. The starter ships a neutral,
disabled-by-deployment worker foundation; a derived product enables it only
after adding an owned async consumer contract. Outbox payloads are minimal,
versioned and secret/PII-safe; external delivery is after commit.

## PII lifecycle

| Concern | Starter policy | Derived product obligation |
| --- | --- | --- |
| Inventory | account, membership, audit, notification and configured contact data are PII candidates | add domain fields before production |
| Access | server authorization; Platform Admin is explicit | define role/resource policy |
| Masking and logs | no secrets in browser/logs; avoid unnecessary PII in events | define field-level masking |
| Retention | operation records have retention boundary | set lawful durations and job policy |
| Export/deletion | no generic export/delete API is implied | define product flow and legal basis |
| Audit | security and significant admin operations are auditable | extend action taxonomy |
| Backup | starter has no production backup | define backup retention, restore owner and proof |

Legal requirements remain `REQUIRES_CHECK`; this matrix is an engineering
contract, not legal advice.

## Version matrix and verified exceptions

| Area | Installed exact version | Decision |
| --- | --- | --- |
| Node.js | 24.20.0 | Node 24 line; project exact version is pinned |
| Next.js | 16.3.8 | App Router 16.x; use `proxy.ts` semantics when needed |
| React | 19.2.8 | compatible project line |
| Prisma / adapter | 7.10.0 / `@prisma/adapter-pg` 7.10.0 | supported PostgreSQL adapter pattern |
| PostgreSQL target | 18 | target line; local/integration proof is introduced by E00A |
| Better Auth | 1.7.2 | 2FA plugin supports TOTP and recovery codes; E02 owns enforcement |
| pg-boss | 12.30.0 | PostgreSQL queue; schema migration/runtime privileges stay separate |
| TypeScript | 6.0.3 | explicit project exception to Core 3.4's 5.9.x hold; no upgrade is implied |

Official compatibility checked on 2026-09-24:

- Next.js 16 upgrade/proxy guidance: <https://nextjs.org/docs/app/guides/upgrading/version-16>;
- Prisma 7 PostgreSQL adapter: <https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql>;
- Better Auth two-factor plugin: <https://better-auth.com/docs/plugins/2fa>;
- PostgreSQL 18 row security policies: <https://www.postgresql.org/docs/18/ddl-rowsecurity.html>;
- pg-boss runtime and queue contract: <https://github.com/timgit/pg-boss>;
- TypeScript 6 release notes: <https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html>.

The TypeScript 6 exception is observational: it is retained because the exact
project toolchain is already pinned and no incompatible API has been found in
this scope. A downgrade or further major migration is a separate RISKY task,
not an incidental hardening change.

## ADRs and revisit triggers

- ADR-001 fixes the application-platform profile.
- ADR-002 fixes the neutral hardening boundary and traceability.
- Revisit tenancy/RLS after E03 proof; revisit queue deployment after E05;
  revisit TypeScript only through a separately approved version task.

Dependency security pins: `fast-uri` 3.1.8 and `source-map-js` 1.2.2 patch
their audited URI/source-map defects. `sharp` 0.35.5 pins Next's optional
0.35 range to obtain patched librsvg; its Node requirement remains compatible.
Frozen installation, build and image-transform regression must prove this
bounded patch override before the updated artifact is accepted. Next and
`eslint-config-next` move together to 16.3.8; other direct runtime pins stay.
