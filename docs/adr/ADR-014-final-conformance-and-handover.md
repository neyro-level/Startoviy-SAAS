# ADR-014: Final Conformance And Handover Contract

**Status:** Accepted conformance contract; current final-main proof requires actual verification

Final conformance is evaluated at one exact final `main` SHA, not by combining partial branch results. Every target guarantee receives one of: executable proof with exact evidence, explicit bounded exception, or deferred capability with owner/trigger. Docs, schema, code, GitHub contract and runtime template must agree. ADR-015 supersedes the former SourceCraft/EXPERIMENT premises.

The final handover supplies: derivation checklist; the template's `COMMERCIAL` profile and each derived product's explicit `COMMERCIAL | CRITICAL` choice; GitHub exact-head gate; immutable artifact/rollback template; database identity/backup obligations; secret and domain ownership; and a statement that the starter itself is not production.

`docs/HANDOVER.md` is the human-readable matrix. `pnpm verify:conformance`
checks its required links against the runtime template and emits the exact Git
commit/tree identity. This is static contract evidence, not provider attestation;
actual required GitHub success needs a separate exact-SHA readback.
`pnpm verify:release` includes that static conformance
check after the daily proof; `pnpm derive:smoke` remains the independent
copy-source proof.

Final acceptance may close only after: all feature epics have delivered protected-PR evidence; a clean final main has passed the applicable local daily/release-equivalent proof; clean-room derivation repeats successfully; and docs/source-of-truth links reconcile with runtime. Missing guarded PostgreSQL identity, required GitHub checks or other applicable prerequisites remain recorded blockers, never claimed proof. Optional SourceCraft mirror access is not a GitHub delivery prerequisite.

| Conformance item | Evidence owner |
| --- | --- |
| profile, stack and identity | E00/E01 |
| auth, principal and RLS | E02/E03 |
| atomic commands and async | E04/E05 |
| integrated PostgreSQL proof | E00A/E06 |
| CI/runtime/UI safety | E07/E08/E09 |
| derivation and handover | E10/E11 |

Final conformance is RISKY because it validates security/runtime proof. ADR-015
owns the current owner-authorized phased merge procedure. This contract grants
no production release or authorization for a new program.
