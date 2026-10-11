# ADR-004: Neutral identity and copy-source derivation contract

**Status:** accepted

## Decision

`АМС Старт` remains a copy-source starter. A derived repository receives its
identity through one project-owned manifest and a deterministic interface.
The baseline implements copy-source plus verifier/smoke. The approved current
program adds a deterministic neutral generator as TARGET under ADR-015; it
does not introduce a template distribution service or inherited task history.

E01 implementation must create one readable identity contract and one
fail-closed verifier. They are the only authoritative inventory of values that
must change before a copied project is prepared for commercial use.

## Required identity surface

| Surface | Starter placeholder class | Derived-project requirement | Evidence owner |
| --- | --- | --- | --- |
| Product identity | app name, slug and package/service label | one product name and slug replace the neutral starter identity | static identity test |
| Public origin | example origin, sitemap, robots and trusted origin | explicit production origin; loopback origins stay development-only | derivation verifier |
| Runtime service | health service ID, worker ID, database application names | one bounded service namespace without `ams-start` residue | static identity test |
| Database and queue | database role/name examples, pg-boss schema and queue labels | project-specific names with no inherited database or credential | manifest validation |
| Artifact and operations | image, compose, systemd, Nginx, backup and registry labels | project-owned artifact and deployment identifiers | derivation verifier |
| Legal and operator data | `TODO:` records and neutral legal copy | real operator data before public release | derivation verifier |
| Visual assets | icon, favicon, manifest and cache labels | product-owned assets and cache namespace | static identity test |

## Fail-closed rules

- The verifier must report every required unresolved starter token, example
  origin and legal `TODO:` record together; it must not silently accept a
  partially derived copy.
- It may skip only its own verifier, test and contract documents, which are an
  explicit fixed allowlist in the verifier. A derived product has no editable
  or implicit allowlist for application, runtime, operation or legal files.
- It operates on local source files and credential-free repository metadata;
  it never reads secrets, database URLs or production configuration.
- The starter's ordinary checks remain neutral. The derived-copy check runs
  explicitly in the derivation workflow so the reusable source can retain its
  documented placeholders.

## Delivery contract

E01 implementation adds the inventory, manifest, verifier and copy-source
checklist. E01 verification performs a clean-room copy, substitutes the
required identity values, proves success, then proves that one restored token
fails. Auth, tenant, RLS, command and asynchronous behavior stay outside this
epic.

## Consequences

- A new product receives a single auditable substitution list instead of a
  manual search across application, runtime and operations files.
- `ams-start` is a deliberate source identity, never a hidden production
  dependency inherited by a derived project.
- The original deferred-generator premise is superseded by the approved current
  program/ADR-015. The generator must preserve this manifest/fail-closed proof,
  omit execution inputs and require no manual history cleanup; until implemented
  and independently tested, existing copy-source smoke is not generator proof.
