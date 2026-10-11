# ADR-011: Hardened Runtime, Artifact And Release Template

**Status:** Accepted artifact contract; actual image proof required for current SHA
**Scope:** reusable local template only; no registry publish, server mutation, DNS or production credential.

## Decision

A reviewed derived-project SHA produces separate immutable build, runtime-dependency, non-root runtime and migrator artifacts from a digest-pinned Node base. The final runtime excludes package managers, dev tooling, tests, build cache and unnecessary source; writable paths are explicit and bounded.

`web`, `worker`, `migrator` and `backup` have separate environment/permission contracts. Only migrator has controlled migration capability; web/worker are non-owner runtime identities. A release record binds reviewed SHA, image digest and an explicit previous rollback digest. Production remains a derived-product action, never a starter action.

## Required template evidence

| Guarantee | Local template proof |
| --- | --- |
| minimal immutable runtime | `runtime-web` and `runtime-worker` run as `node`; image inspection proves package managers, `tsx`, `tsc`, tests and source are absent |
| separated identities | Compose binds separate web, worker and migrator images and environment files; migrator rejects arbitrary commands |
| deterministic rollback | schema-v2 release manifest requires three current digests and either an explicit previous manifest or an explicit first-release decision |
| safe infrastructure shape | Compose uses read-only filesystems, bounded `/tmp`, dropped capabilities and `no-new-privileges`; Nginx/systemd retain placeholder identity |
| recoverability | logical backup/isolated restore scripts and a managed-provider evidence interface are reusable but not executed against a real provider here |
| bounded database load | checked example allocates 33 of 80 usable connections and leaves 47 unallocated |
| safe live proof | local-only skeleton checks SHA, liveness/readiness, private cache policy and unauthenticated workspace/admin access |

Container vulnerability inspection uses Docker Scout against local image IDs and writes SARIF only to ignored `.local/evidence`; it never publishes an image. The contract stops if artifact proof needs a registry, server or production credentials. E08 remains `RISKY`, PR-only, and a derived product must complete its own release and rollback runbook before use.

Historical image scan verdicts remain in Git/tracker. Every current candidate
requires fresh inspection and an explicit bounded-risk decision if unresolved
findings remain; no historical verdict grants release authority. ADR-015 owns
the current protected merge procedure.
