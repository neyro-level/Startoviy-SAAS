# Environment

**Status:** Active extension. Value-free variable registry under
[03_ARCHITECTURE.md](03_ARCHITECTURE.md); [.env.example](../.env.example) owns
neutral example names, source consumers own validation/defaults. No credential
value or production target belongs here. VERIFIED means consumer inspected;
missing guards are explicit REQUIRES CHECK, not promised validation.

## Profiles and loading

Starter preview/build can run without auth/database; auth remains unavailable
and readiness fails safely. A usable local authenticated app requires owned
loopback PostgreSQL18 and complete auth configuration. Runtime app reads
process environment; CLI/local commands may explicitly load `.env.local`.
`APP_ENV=test` plus dedicated TEST_DATABASE inputs is mandatory for destructive
test lifecycle. A derived production product creates separate web/worker,
migrator and backup env files and uses its own secret scope; no inherited file.

## Database and application registry

| Name | Required-if / safe default | Scope / secrecy | Actual source / validation |
| --- | --- | --- | --- |
| APP_ENV | choose development/test/production; example development | server/test/ops; nonsecret | database-target resolves APP_ENV before NODE_ENV; integration runner forces test then preflight |
| NODE_ENV | framework/runtime selected | server/build; nonsecret | Next/DB resolver; not authority to mutate an unknown target |
| DATABASE_URL | alternative to complete components, no secret default | server or migrator per separate role; SECRET | server-environment + pool-config/Prisma config; PostgreSQL URL, credential-bearing, never print |
| DATABASE_HOST | component mode requires | server/migrator; topology private | exact target guard; no default production host |
| DATABASE_PORT | component mode optional;5432 default | server/migrator; nonsecret | integer1…65535; URL/component targets must agree |
| DATABASE_USER | component mode requires | server/migrator; identity private | runtime role differs from DDL/backup/test; database-target naming guards |
| DATABASE_PASSWORD | component mode requires, blank not accepted | server/migrator; SECRET | complete config validated, never reuse Starter/demo credential |
| DATABASE_NAME | component mode requires | server/migrator; topology private | dev `_dev`, test `_test`, production neither; unknown target refused |
| DATABASE_SSLMODE | optional; disable only for owned local tests | server/migrator; nonsecret | pg pool reads disable; no universal TLS/CA validation is claimed, product topology needs proof |
| LOCAL_POSTGRES_USER | required test guard reference to dev identity | local/test; identity private | verify-test-database-env rejects identical test role |
| LOCAL_POSTGRES_PORT | example5435, legacy helper metadata | local; nonsecret | current local-postgres reads DATABASE_PORT instead; no effective runtime setting claimed |
| LOCAL_POSTGRES_PASSWORD | blank legacy helper input | local; SECRET | current local-postgres reads DATABASE_PASSWORD; unused example, do not treat as a second runtime password |

Complete URL and component mode may coexist only for the same target. Runtime
web and worker must be configured non-owner NOBYPASSRLS; migrator alone owns DDL.
Configuration checks do not themselves prove actual DB role attributes/ACL.

## Guarded test registry

| Name | Required-if / default | Scope / secrecy | Validation owner |
| --- | --- | --- | --- |
| TEST_DATABASE_HOST | mandatory literal127.0.0.1 or::1 | local disposable test only | verify-test-database-env; localhost/remote/managed/production names rejected |
| TEST_DATABASE_PORT | optional;5432 (example5435) | local test | integer valid port |
| TEST_DATABASE_USER | mandatory dedicated test role | local test; identity private | test marker, different LOCAL_POSTGRES_USER and development identity |
| TEST_DATABASE_PASSWORD | mandatory, no default | local test; SECRET | preflight required; not production credential |
| TEST_DATABASE_NAME | mandatory ending `_test` | local test | distinct development target; rejected before reset otherwise |
| TEST_DATABASE_SSLMODE | optional disable | local test | DSN constructed only for accepted target; never printed |

`test:integration` and guarded E2E reset/seed only the accepted isolated target.
Native PG18 version/schema/runtime role attributes are checked by their scripts/
fixtures. No Docker/production fallback is implied. Local evidence is ignored,
secret-free and invalidated before a new run; successful provider CI requires
its own exact-SHA readback. [ADR-003](adr/ADR-003-safe-postgresql-test-foundation.md)
and [ADR-009](adr/ADR-009-postgresql-security-evidence.md) own the safety contract.

## Auth, public form and logging

| Name | Required-if / safe default | Scope / secrecy | Actual source / validation |
| --- | --- | --- | --- |
| BETTER_AUTH_SECRET | when auth enabled in any environment; ≥32 chars, no default | auth server; SECRET | readAuthEnvironment; it is not production-only |
| BETTER_AUTH_URL | when auth enabled, exact app origin | server/public origin; nonsecret | valid URL; HTTPS outside loopback development; trustedOrigins exact |
| BETTER_AUTH_TRUSTED_PROXY_CIDRS | required production auth; absent local means no forwarded-IP trust | auth server; topology private | valid IP/CIDR list; production startup rejects absent trusted boundary |
| CLIENT_ACCESS_ENABLED | optional; fail-closed unless the exact value `true` | auth server; nonsecret | MEMBER login/principal denied when unset/false; PLATFORM_ADMIN/STAFF unchanged |
| NEXT_PUBLIC_CONTACT_API_URL | all CONTACT fields required only to enable contact delivery; absent disables | browser; PUBLIC | public-leads-environment URL schema; ownership/receiver/SSRF policy not proven by this alone |
| NEXT_PUBLIC_CONTACT_PROJECT_ID | enabled receiver routing identifier | browser; PUBLIC | lowercase/digit/hyphen3…64 |
| NEXT_PUBLIC_CONTACT_SITE_KEY | enabled receiver public routing key | browser; PUBLIC, never a secret credential |16…128 chars; must not hold private API key |
| LOG_LEVEL | optional info | server/worker; nonsecret | logger reads value, Pino validates supported level |
| RELEASE_SHA | optional local; required release proof | server; nonsecret | full lowercase40-char Git SHA; live/release manifest must match |

## Worker and pg-boss

| Name | Required-if / safe default | Scope | Actual source / gap |
| --- | --- | --- | --- |
| OUTBOX_WORKER_ID | unique per product worker replica | worker; nonsecret | example name only; current entrypoint uses optional argv worker-id or pid-based default, does not read this env; wiring TARGET |
| OUTBOX_POLL_DELAY_MS | optional code1000ms; example5000ms | worker; nonsecret | worker/main converts Number; bounds/invalid handling must be verified against lifecycle |
| OUTBOX_SHUTDOWN_DRAIN_TIMEOUT_MS | optional30000ms | worker; nonsecret | bounded active-handler drain; invalid Number/restart proof requires tests |
| PGBOSS_SCHEMA | pg-boss migration/runtime; default pgboss | migrator/worker; nonsecret | pg-boss scripts/config schema; controlled migration step, runtime migrate:false |
| PGBOSS_RUNTIME_ROLE | optional role grants during pg-boss migration | migrator; identity private | pgboss-migrate script identifier escaping, runtime role receives DML/function privileges, not DDL |

A product with no owned async consumer does not need to start a production worker.
Explicit optional decisions belong to manifest; disabled consumer/readiness
behavior remains a tested contract rather than inference from blank env fields.

## Backup and release recipe registry

These variables configure reusable operations only in an explicitly owned
context; they are not core app/S3-adapter configuration.

| Name | Required-if / safe default | Scope / secrecy | Source / validation boundary |
| --- | --- | --- | --- |
| S3_BUCKET | required by current offsite backup recipe when invoked | backup; topology private | backup.sh requires offsite selection; no Starter bucket |
| S3_ENDPOINT | required by offsite backup recipe | backup; topology private | backup.sh checks nonempty; safe adapter/endpoint policy TARGET, not assumed |
| S3_REGION | optional recipe ru-1; product chooses actual region | backup; nonsecret | backup.sh/AWS CLI; not a verified provider account |
| REQUIRE_OFFSITE | must be true for current backup.sh | backup; nonsecret | explicit guard before dump/upload; local/offsite disabled modes require later recovery hardening |
| AWS_ACCESS_KEY_ID | required by offsite recipe | backup; SECRET | dedicated owned credential, not browser/app env |
| AWS_SECRET_ACCESS_KEY | required by offsite recipe | backup; SECRET | required guard; no value in docs/argv/logs |
| DB_NAME, BACKUP_ROOT, KEEP_DAILY, KEEP_WEEKLY, KEEP_MONTHLY | product-owned backup target/path/retention | backup; topology private | backup.sh currently has defaults; unknown-target/path/retention validation needs disposable recovery proof |
| BACKUP_FILE, MIN_PROJECT_COUNT, POSTGRES_IMAGE | explicit restore fixture/owned backup and inspection inputs | recovery; private paths | restore-smoke creates Docker disposable DB; defaults are recipes, not permission to restore real data |
| AMS_START_PREVIOUS_RELEASE_MANIFEST | prior artifact record; alternative explicit first-release | build ops; private path | build-release validates prior manifest/digests; owned durable storage |
| AMS_START_FIRST_RELEASE | explicit true only if no prior release exists | build ops; nonsecret | build-release rejects neither/invalid prior contract |
| AMS_START_DEPLOY_HOST, AMS_START_ROOT | only authorized derived rollout | deploy ops; private target/path | deploy script requires clean main/artifact/SHA and owned host; no Starter target/default activation |
| AMS_START_WEB_IMAGE, AMS_START_WORKER_IMAGE, AMS_START_MIGRATOR_IMAGE | generated current image identities | release runtime; nonsecret | manifest/build/deploy exact digests; optional inspection inputs select real locally built artifact |
| AMS_START_WEB_IMAGE_DIGEST, AMS_START_WORKER_IMAGE_DIGEST, AMS_START_MIGRATOR_IMAGE_DIGEST | generated current digests | release ops; nonsecret | inspect/load must match manifest; no hand-edited guessed digest |
| PREVIOUS_RELEASE_SHA, PREVIOUS_WEB_IMAGE, PREVIOUS_WORKER_IMAGE, PREVIOUS_MIGRATOR_IMAGE | generated rollback identity | release ops; nonsecret | rollback.sh requires explicit prior record |
| PREVIOUS_WEB_IMAGE_DIGEST, PREVIOUS_WORKER_IMAGE_DIGEST, PREVIOUS_MIGRATOR_IMAGE_DIGEST | generated prior digests | release ops; nonsecret | actual local image inspect match before rollout rollback |

Unknown/secret inputs stop the applicable operation. [05](05_RELEASE_CHECKLIST.md)
owns acceptance; [RUNBOOK](RUNBOOK_DEPLOY.md)/[RECOVERY](ops/RECOVERY.md) own
procedures. No provider credentials are populated or product infrastructure
required to use static template proof. New variables require actual consumer,
required-if/default/scope/validation documentation in the same PR.
