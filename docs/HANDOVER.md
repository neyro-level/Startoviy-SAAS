# Final Conformance And Derived-Product Handover

**Status:** Active extension. [05_RELEASE_CHECKLIST.md](05_RELEASE_CHECKLIST.md)
owns acceptance/status; this file maps guarantees to source/proof and transfer.
**Repository role:** neutral copy-source template; no production target.
No historical run verdict or task status is inherited as current product proof.

## Guarantee-to-proof matrix

| Guarantee | Runtime/source owner | Executable proof / missing target | Boundary |
| --- | --- | --- | --- |
| neutral identity and factual inputs | PRD facts, starter.identity.json, DERIVATION | verify:config, derive:verify, derive:smoke and legal/identity negatives | template demo only; real facts require derived owner source |
| docs/navigation/requirement consistency | docs/README, numbered canon, ADRs | docs:check/link negatives, REQ/PAGE/FLOW source review | local Backlog/plans/history excluded, no duplicate canon |
| guarded PostgreSQL target | database-target guard and integration runner | test:integration clean/repeated-reverse, test-database-guard | dedicated literal loopback `_test`, no production fallback |
| auth, persisted principal and tenant/project boundary | AUTH, DATA_MODEL,03, identity/database modules | auth/principal tests, native setup/isolation and full browser flows; project-grant targets need own tests | TOTP retained; tenant coverage alone does not prove cross-project denies |
| atomic mutation/audit/idempotency | define-command, scoped repositories, ADR-007 | command-contract/native atomicity rollback/conflict tests | external effects after commit |
| outbox/queue optional reliability | platform-operations/worker, ADR-008 | outbox-worker/native reliability; restart/disabled target proof | no live consumer/provider inherited |
| safe secret/log/outbound boundary | SECURITY and ENVIRONMENT, platform adapters | runtime-safety tests; SecretRef/SSRF/DNS/rebinding/timeout targets need adversarial proof | explicit existing redaction is not universal coverage |
| opt-in object storage |03 project/storage target | scoped contract/native deny/disabled tests after implementation | no bucket/endpoint/credentials assumed |
| commercial exact-head delivery | GitHub workflow/vendor/provenance, ADR-015 | verify:delivery-policy + actual commercial-gate / verify on current exact SHA/protection API | static configuration PASS never provider attestation |
| immutable runtime/recovery | Docker/Compose/release/ops recipes | release-template/contracts, actual non-root image/scans, disposable backup/restore/rollback | no starter host, registry, production artifacts or release authority |
| UI/PWA/safe errors |02/06, routes/primitives/SW, ADR-012 | security/unit/build/E2E, authenticated/offline/cache/a11y matrix | all enabled states require matching proof |
| independent copy-source / generator | DERIVATION and disposable derived repository | derive:smoke; deterministic generator and independent CRM pilot target proof | own GitHub/profile/facts, no SourceCraft prerequisite or history cleanup |
| final source/runtime agreement | this map,05, conformance verifier | verify:conformance with clean final main + all required actual runs | exact SHA/tree, no combined stale branch evidence |

## Verify command matrix

| Intent | Command | Evidence and limitation |
| --- | --- | --- |
| canonical docs/navigation | `pnpm docs:check` | role/source/link static proof; manual semantic/source review also required |
| fast contracts | `pnpm verify:quick` | policy/config/UI/type/lint/architecture, not full security/runtime proof |
| unit/security | `pnpm test:unit`, `pnpm test:security` | relevant positive/negative behaviors; unimplemented tests cannot be counted |
| native database composition | `pnpm test:integration` | guarded two clean runs/reverse order and local safe JSON summary |
| browser regression | `pnpm test:e2e:run` | guarded database lifecycle and built app; actual defined scenarios/widths only |
| local release-equivalent candidate | `pnpm verify:release` | daily suite then static conformance/runtime; no rollout/publish |
| independent copied product | `pnpm derive:smoke` | disposable frozen install/quick/unit/build; copy deleted, not published |
| static artifact contract | `pnpm verify:release-template` | example connection budget, not provider backup/live image proof |

`verify:release` does not publish/deploy or implicitly start Docker. Actual
container/backup/restore/rollback inspection is separate disposable proof when
in scope. Full evidence is stored in tracker/PR or derived operations storage,
not in template documentation. A script name is not an executed result.

## Known bounded exceptions

- Starter has no production domain/server/registry/Secret Master project/database,
  provider account, real legal operator, production backup or release authority.
- COMMERCIAL is mandatory; actual successful required checks belong to the exact
  head/main SHA. Local/static conformance leaves providerGate REQUIRES CHECK.
- Final visibility is private; temporary owner-authorized public access during
  development and final restoration follow ADR-015. Shared Core stays private.
- Baseline image/package findings require fresh scans on the real rebuilt
  candidate; historical findings/verdicts are preserved in Git/tracker, not
  permission to publish. Unfixed risk requires explicit bounded product decision.
- Setup/selection UI, project grants, safe adapters, generator/pilot and full
  recovery targets remain unproved until their implementations/checks complete.
  The presence of this document asserts none of those outcomes.
- Nonempty identity replacements do not prove real legal/fact/media readiness.

## Derived-product handover

1. Create a new repository from an accepted clean template SHA using the actual
   [DERIVATION](DERIVATION.md) interface; no local tasks/plans/run artifacts,
   secrets, database or production identity are transferred.
2. Supply owned identity/facts/legal/origin/optional-module/migration decisions,
   run derive:verify and independent clean-room proof. Review actual copy contents.
3. Choose own COMMERCIAL/CRITICAL profile, GitHub gate/protected main and merge
   permissions. Template program authorization is not inherited release authority.
4. Configure owned auth/TOTP, tenant/project policy, database/runtime/migrator/
   backup identities, secrets/proxy/connection budget and recovery evidence.
5. Add domain modules and opt-in integrations through established facades,
   commands/repositories/worker/adapter boundaries, with native negative tests.
6. Complete05 before any separately authorized release: immutable images/digests,
   legal/public readiness, backup/restore/rollback and actual live/user-flow proof.
7. Future Starter updates are reviewed source/migration changes in the derived
   repository; no bulk reverse-sync or inherited historical PASS is implied.

## Final-main closure

After all required epics pass review and their protected PR merges under ADR-015:

1. Read clean canonical main SHA/tree; do not use an obsolete branch candidate.
2. Verify the whole revised REQ/PAGE/FLOW scope, relevant native/security/browser/
   recovery and clean-room proof; keep unresolved required obligations open.
3. Run verify:release and derive:smoke in guarded disposable contexts;
   verify:conformance must print the same exact main SHA/tree.
4. Read actual required GitHub checks/protection on that SHA; record verdicts,
   commands, PR/merge/run identity in tracker/PR. Configuration is not attestation.
5. Restore Starter private after full-program completion and verify visibility/
   protection. Assign only the status supported by05, never DEPLOYED.

No step in this handover authorizes production.
