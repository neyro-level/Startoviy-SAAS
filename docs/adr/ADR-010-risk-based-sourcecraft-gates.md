# ADR-010: Historical SourceCraft gate decision

**Status:** HISTORICAL; active delivery superseded by
[ADR-015](ADR-015-commercial-template-github-delivery.md).

The earlier copy-source program used dormant manual SourceCraft gates under
EXPERIMENT and separate per-PR merge commands. The owner replaced those
premises with COMMERCIAL/GitHub primary, SourceCraft optional mirror and
phased protected merge authorization. No old provider access or paid/manual
SourceCraft run is required to verify or derive the template.

The enduring safeguards are retained in03/ADR-015: exact reviewed head,
failed/stale/missing proof rejection, relevant risk-scoped checks, readonly
verification, secret-safe evidence and no implicit deployment. Actual current
GitHub required checks/protection are mandatory. Risk classification remains
an attention hint, not permission to bypass a gate. This ADR preserves the
ID/decision context; original provider templates and execution history remain
in Git rather than a second active delivery contract.
