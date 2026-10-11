# ADR-015: Commercial template and GitHub delivery

**Status:** Accepted by owner, 2026-10-11.

## Context and decision

This repository supplies a neutral reusable foundation; it is not a production
application. The owner approved role `template`, profile `COMMERCIAL`, private
visibility and GitHub primary. Role describes purpose; profile sets acceptance
requirements. Neither grants production authority. The project remains
protected-PR delivery: commit, push and reviewable checkpoints are authorized.
The owner subsequently gave the separate command authorizing phased autonomous
merge for the whole approved program. Each bounded epic requires review,
successful required GitHub checks on its exact head, protected merge and
verification of canonical main before dependent work. No repeated owner merge
approval is required; no direct-main push, force push or gate bypass is allowed.
Production remains separately authorized. Derived products establish their own
permissions rather than inheriting this program-specific authorization.
SourceCraft may mirror accepted GitHub refs
without owning delivery or becoming a prerequisite for GitHub verification.

The active exact-head contract is owned by `03_ARCHITECTURE.md`. Shared workflow
revisions are immutable reviewed SHAs. Checks must reject stale heads, missing
reports, skipped contracts and failures; existing stricter protection stays.
When caller visibility prevents access to the private shared workflow, use
Delivery Core's byte-exact vendor with source SHA/checksum provenance lock.
Validate provenance as part of the project gate; retain the same readonly
exact-head checks and required context. Do not publish the shared repository.
Onboarding may apply the approved required context to main after it succeeds on
the candidate PR, before merge. This avoids an unprotected bootstrap merge.
The central portfolio records this template contract through its own reviewed PR;
classification alone is not permission to reconcile arbitrary repositories.

The final visibility contract is private. The owner temporarily authorized
public visibility during development because the GitHub quota blocked checks.
Restore private after the entire approved program is verified, then read back
visibility and required protection. The shared Delivery Core stays private.

## Security and reuse boundaries

Better Auth stays the sole auth framework. TOTP and persisted fresh-session MFA
stay mandatory for platform administration; donor auth without these protections
cannot replace Starter auth. There is no public signup or billing in the base.
Organization and project authorization are separate server/transaction/RLS
concerns. Project grants and neutral capabilities require additive Starter-owned
migrations and native negative tests, not donor domain roles or migrations.

Reuse donor mechanisms selectively. Outbound HTTP and S3 remain opt-in with safe
disabled behavior, bounded calls and project isolation. No provider, tenant data,
runtime secret, production endpoint or donor release adapter is inherited.
Auth, schema, RLS, worker and recovery tests remain required regardless of the
COMMERCIAL label. Local proof never substitutes for the provider exact-head gate.

## Documentation and derivation

Preserve the numbered documentation convention. Permanent instructions own
requirements, page/flow structure, design, architecture, neutral facts/placeholder
policy and technical acceptance. Derived products define real legal/commercial
facts, SEO and production topology; the template does not contain empty dossiers
for these future decisions. Local queues, supplied plans, historical program
inventories and execution snapshots are excluded automatically from generated
copies. Preserve unique decisions in permanent owners before removing legacy
planning files; execution history stays in the tracker, PRs and Git.

ADR-010's SourceCraft-only, zero-CI and EXPERIMENT premises are superseded.
Existing security, transaction, worker and recovery ADRs remain applicable.
Full canon reconciliation and generator implementation have their own tasks;
this ADR records the required contract, not a claim that those tasks have passed.

## Acceptance

Review README, Architecture, consumer configuration and central registry together.
Verify frozen tooling, safe disposable PG18/browser bootstrap, scoped negative
config cases, actual GitHub checks on the candidate SHA and main protection
readback. Runtime runs and PR/SHA history belong to task/PR evidence, not a
second permanent execution report. Production remains separately authorized.
