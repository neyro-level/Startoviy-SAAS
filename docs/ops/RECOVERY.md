# Recovery

**Status:** Active extension. A derived product must add its own data and
integration recovery contract before production.

Derived-product incident procedure (requires owned target and authorization):

1. confirm exact commit SHA and branch;
2. confirm database target is not unknown;
3. check `/api/health/live`;
4. check `/api/health/ready`;
5. confirm worker heartbeat and outbox health;
6. restore from latest verified PostgreSQL backup if data corruption is confirmed;
7. rotate affected secrets outside Git.

The reusable material includes:

- `ops/release/rollback.sh` for exact previously recorded image identities;
- `ops/postgres/restore-smoke.sh` for an isolated disposable restore;
- `ops/postgres/provider-proof.example.json` for managed-provider evidence.

Artifact rollback does not reverse schema or data. A derived product must prove
forward-compatible migrations or document its own reviewed data rollback path.

Derived products must add their own integration and business-data recovery steps.

## Evidence boundary

[05](../05_RELEASE_CHECKLIST.md) owns readiness, [HANDOVER](../HANDOVER.md) maps
proof. Restore smoke uses a Docker disposable database from an explicitly
selected backup; its existing script currently has default paths/container
names. Guarded fixture/unknown-target checks and cleanup need actual testing
before any owned backup is used. No starter production backup/restore is
implied. Successful pg_restore alone is insufficient: verify migrations/data
sanity, non-owner runtime roles, readiness and applicable user/worker flows.
Record source SHA, backup identity/checksum/freshness, restore verdict and
rollback image digests outside template docs, with no credentials/PII.
Unknown target, missing/mismatched artifact or failed probe stops the operation.
