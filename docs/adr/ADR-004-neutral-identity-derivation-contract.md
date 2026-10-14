# ADR-004: Neutral identity and copy-source derivation contract

**Status:** accepted; original copy-only premise superseded by the typed generator.

## Decision

`АМС Старт` remains a copy-source starter. A derived repository receives its
identity through one project-owned manifest and a deterministic interface.
The local generator uses exact clean source SHA, a validated typed manifest,
dry-run and matching-hash apply. It creates an independent unpublished local
repository; no distribution service, task history or release authority transfers.

The product uses one readable identity contract and one
fail-closed verifier. They are the only authoritative inventory of values that
must change before a copied project is prepared for commercial use.

## Required identity surface

| Surface | Starter placeholder class | Derived-project requirement | Evidence owner |
| --- | --- | --- | --- |
| Product identity | app name, slug and package/service label | one product name and slug replace the neutral starter identity | static identity test |
| Public origin | example origin, sitemap, robots and trusted origin | explicit production origin; loopback origins stay development-only | derivation verifier |
| Runtime service | health service ID, worker ID, database application names | one bounded service namespace without source identity residue | static identity test |
| Database and queue | database role/name examples, pg-boss schema and queue labels | project-specific names with no inherited database or credential | manifest validation |
| Artifact and operations | image, compose, systemd, Nginx, backup and registry labels | project-owned artifact and deployment identifiers | derivation verifier |
| Legal and operator data | `TODO:` records and neutral legal copy | real operator data before public release | derivation verifier |
| Visual assets | icon, favicon, manifest and cache labels | product-owned assets and cache namespace | static identity test |

## Fail-closed rules

- The verifier must report every required unresolved starter token, example
  origin and legal `TODO:` record together; it must not silently accept a
  partially derived copy.
- Verifier, tests, documents, assets, SQL/env/ops and tracked paths are all
  scanned. One exact upstream-reference line under this ADR's historical
  heading is the immutable exception; no whole-file or folder exemption exists.
  A derived product has no editable allowlist for runtime, operation or legal files.
- It operates on local source files and credential-free repository metadata;
  it never reads secrets, database URLs or production configuration.
- The starter's ordinary checks remain neutral. The derived-copy check runs
  explicitly in the derivation workflow so the reusable source can retain its
  documented placeholders.

## Delivery contract

The manifest, derivation interface and independent copied proof belong to
[DERIVATION](../DERIVATION.md). Restored source/donor markers, missing identity,
wrong origin and inherited local/execution material must fail before release.
Authentication, tenant isolation and active worker proof remain separate
runtime requirements; static conformance is not their execution evidence.

## Consequences

- A new product receives a single auditable substitution list instead of a
  manual search across application, runtime and operations files.
- The deliberate source namespace must never become a hidden production
  dependency inherited by a derived project.
- The original deferred-generator premise is superseded by the approved current
  program/ADR-015. The generator must preserve this manifest/fail-closed proof,
  omit execution inputs and require no manual history cleanup. A mechanical
  copy smoke alone is not proof of the actual generator or release readiness.

## Historical upstream reference

Historical upstream reference only: https://github.com/neyro-level/Startoviy-SAAS

This provenance link is historical context, never a runtime origin, repository
permission, configuration value or product identity.
