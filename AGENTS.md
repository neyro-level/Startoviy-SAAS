# AMS MicroSaaS Starter — project router

## Scope

`АМС Старт` is a reusable foundation for CRM, analytics workspaces, internal
systems and MicroSaaS. It is a copy-source repository, not a production target.
Read the narrowest applicable source before changing code or documentation.

## Reading order

1. `docs/README.md` — document map;
2. `01_PRD.md`, `02_PRODUCT_STRUCTURE.md`, `03_ARCHITECTURE.md` — only the
   scope-relevant sections;
3. one applicable ADR or detailed extension;
4. `04_BACKLOG.md` and the claimed local Backlog task;
5. `package.json`, lockfile, `.node-version`, Prisma schema/migrations and
   runtime config — actual technical state.

## Local invariants

- Keep the starter neutral: no product/provider vertical, production identity,
  secrets, host or database.
- Authentication does not replace server-side permission and resource checks.
- Business mutation follows action/API/job → command → transaction-bound
  repositories; external side effects are outside the transaction.
- Secrets and PII never enter Git, browser, logs, argv or docs.
- Service worker never caches auth, API or private routes.
- Schema/auth/tenant/runtime/CI changes are RISKY; use the project scripts and
  record only actual evidence.

## Delivery

The repository is a `template` with profile `COMMERCIAL` and GitHub primary;
ADR-015 owns delivery policy. Its final visibility is private. The owner
temporarily authorized public visibility during development to unblock CI;
restore private only after the entire approved program is verified.
The owner authorizes phased autonomous merges for the approved program:
review each bounded epic, require successful GitHub checks on its exact head,
merge through the protected PR, and verify canonical main before downstream
work. Do not ask for merge permission again. No direct main push, force push
or gate bypass. Production requires separate authorization. A derived product
must establish its own delivery profile, permissions and production contract.

## Checks

Use the smallest relevant script from `package.json`; common verification
profiles are `pnpm verify:quick`, `pnpm verify:risky`, `pnpm verify:daily` and
`pnpm verify:release`.
