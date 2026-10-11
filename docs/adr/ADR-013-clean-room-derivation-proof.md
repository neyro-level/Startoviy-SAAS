# ADR-013: Clean-Room Product Derivation Proof

**Status:** Accepted derivation proof contract

A derived product starts as a disposable copy of the starter, never by mutating the starter repository. The clean-room procedure creates a new Git identity, applies one sample neutral product identity, replaces every required placeholder through the E01 manifest, and verifies that no starter or legacy-product token, source remote, domain, runtime/service or migration identity remains outside the narrow verifier implementation fixtures; execution history is never inherited.

The smoke validates: copy-source checklist; product name/slug/origin/health service identifiers; environment registry; fresh migration ownership; branch policy; selected `DELIVERY_PROFILE`; optional-module decisions; Prisma generation; quick/unit/build checks. It then stops before domain, secrets, server, production database, publication or release setup.

| Guarantee | Required proof |
| --- | --- |
| no hidden source identity | tracked path/content scan and derivation verifier |
| independently owned repository | remote/branch/migration ownership assertions |
| installable foundation | disposable-directory install, Prisma generate, quick/unit/build |
| explicit product decisions | checklist for optional modules and delivery profile |
| no accidental production | guard confirms no secrets/host/deploy actions and records handoff boundary |

The derivation directory is disposable and never committed; the test avoids machine-specific paths. E10 is `RISKY` if identity automation mutates repository metadata, otherwise its contract remains PR-only and does not publish a template service or product.
