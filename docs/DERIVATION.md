# Copy-source derivation

**Status:** Active extension. PRD owns product/facts; Architecture owns optional
boundaries; this file owns the actual derivation interface and verification.

`VERIFIED`: local generator, typed identity and copy-source disposable smoke.
`TARGET`: complete optional-profile proof and independent pilot proof
remain separate requirements; the existing smoke is not yet the whole generator
proof matrix. No distribution service or production product is created.

## Локальный generator: dry-run → apply

Use `pnpm derive:create` from a clean template checkout on the selected full
commit SHA. The input JSON follows ProjectIdentityV2: own product name/slug,
HTTPS origin, icons/brand labels, service/worker/database/artifact IDs, legal
inputs, GitHub origin, profile COMMERCIAL or CRITICAL and explicit module flags.
`mode` becomes derived; null `sourceRevision` is filled from `--source-sha`,
an explicitly different revision is rejected. Actual legal provenance stays
REQUIRES_CHECK; fixtures never establish release authority. Do not put secrets
or environment values in input JSON or flags.

```bash
pnpm derive:create --source-sha "$TEMPLATE_SHA" --input /path/product.json --target /path/new-product --dry-run
pnpm derive:create --source-sha "$TEMPLATE_SHA" --input /path/product.json --target /path/new-product --apply --plan-hash "$PLAN_HASH"
```

Dry-run writes nothing and returns a deterministic `planHash`, exact source
SHA/tree, every source/destination path and checksum, omitted mirror paths and
byte-exact vendor exceptions. It prints no full legal inputs or source contents;
no snapshot/master-plan is saved. Review that output, then pass its matching
hash to apply. Changed inputs/target/tree invalidate the hash. The parent
directory must exist, the destination must be absent and outside the source;
existing work is never overwritten, including an empty directory.

The generator reads immutable Git blobs, rejects dirty tracked source,
symlinks/submodules, credential/local/execution paths and detected credential
patterns before writing. Required canon/runtime files and original/generated
GitHub profile/provenance are validated. It initializes a new local main with
one commit and own origin; it never pushes, creates a remote repository,
database, bucket or Secret Master project. Git templates/hooks and inherited
commit signing are disabled for this initial synthetic operation. Source
checkout/head/remote/history stay intact. Only a newly created owned target is
removed on failure; source and pre-existing destinations are never cleaned.

Materialization rewrites selected product/runtime/SQL/PWA/operation/asset
names, escapes labels in code/XML, keeps vendor bytes unchanged and excludes
SourceCraft configuration. Pure placeholder policy prose stays policy rather
than becoming a fake operator. Generated AGENTS/architecture/acceptance set
own product authority: Starter's temporary-public and autonomous-merge program
permissions do not transfer. Register/configure actual GitHub protected main
and check API evidence separately before a product merge. Generation alone
does not prove optional-disabled paths or ready-to-release status.

## ProjectIdentityV2: единственный источник identity

### Optional modules: operational meaning

Only explicit `enabled` activates a capability. `disabled` and `not_applicable`
both deny execution; unknown/missing states are rejected by the identity schema.
Dependencies, schema and pure library code remain dormant to preserve the
authentication, permission and tenant-isolation foundations.

| Module | When off | Activation boundary |
| --- | --- | --- |
| `pwa` | No manifest link/install capability; manifest, offline and SW endpoints return404; browser unregisters own previous worker and shell caches | server root metadata, guarded routes and registration |
| `platformAdmin` | Admin routes404, navigation absent, authenticated server actions deny before mutation | admin routes/action executor; permission checks still apply when enabled |
| `outboxPlusQueue` | Queue/retention/start commands deny before DB work; generated Compose omits worker/maintenance and outbox timers; readiness explicitly reports disabled while still probing the core database | worker CLI, queue client, retention and maintenance action |
| `outboundHttp` | No active outbound service or required external environment | explicit capability guard; owned adapter implementation/proof remains a separate task |
| `objectStorage` | No active bucket service and no S3 environment requirement | explicit capability guard; owned adapter implementation/proof remains a separate task |

Module import smoke is a dormant-library check and may run when outbox is off;
it neither starts a worker nor proves delivery. A disabled module is never
reported as a healthy active module. Selecting flags does not authorize
deployment or remove the requirement for own integration/security proof.

### Full residue verification

`pnpm derive:verify` scans indexed files and nonignored local source: every
regular extension, tracked names and UTF-8 asset metadata, including SQL,
Dockerfile, env examples, Nginx/systemd, health/legal/PWA and documents.
Source and donor namespaces are separate fixed deny lists. Private credentials,
execution records, symlinks, missing indexed source and files beyond the bounded
scan size fail closed; credential values and credential-bearing filenames are
never printed. Ignored local credentials are never opened by the verifier.

There is no whole-file/folder exemption, including verifier/tests themselves.
Only one exact upstream-reference line in ADR-004's explicitly historical
section is neutral provenance. Extra text, repeated lines, active configuration
or the same link in another scope are checked normally. This is an immutable
code contract, not an editable product allowlist. When Nginx configs exist,
their server names and HTTPS ports must match the validated product origin.
The verifier reads local sources only and never fetches referenced URLs.

`starter.identity.json` имеет schemaVersion2 и валидируется через
[identity-contract.ts](../src/platform/config/identity-contract.ts).
[project-identity.ts](../src/platform/config/project-identity.ts) читает его
только в Node server/worker/scripts. Клиент получает whitelisted
`PublicProjectIdentity` через server root и типизированный provider: name,
slug, shortName, description, origin, icons и brand labels. Legal fields,
source revision, operational IDs, module choices и environment туда не входят.
Никаких credential fields в манифесте нет; unknown поля блокируются, ошибки
показывают field paths без введённых значений.

Metadata/manifest, auth appName, public/private labels, public origin,
legal operator mapping, health service, worker ID и database application
prefix используют этот источник. Shell/fonts/theme не меняются. Compose,
systemd, Nginx, asset filenames и SQL role names требуют materialization
генератором; переключение JSON не переименовывает файлы и уже существующую БД.
Cookie/session/TOTP contracts остаются существующими auth contracts.

Starter допускает demo legal placeholders и null sourceRevision. Derived
режим требует non-placeholder legal inputs, canonical HTTPS origin без
credentials/path/query, собственный migrationOwner и полный source SHA.
`legalReferences.status = REQUIRES_CHECK` означает необходимость подтвердить
реальные факты; синтаксически полный synthetic fixture не становится legal
approval или release authority. SourceRepository здесь задаёт новый GitHub
origin продукта; sourceRevision — commit шаблона, из которого создана копия.
Core auth/tenant не отключаются. Module states
`enabled/disabled/not_applicable` заданы для outboxPlusQueue, pwa,
platformAdmin, outboundHttp и objectStorage; наличие flags не доказывает
runtime отключение. Принудительные guards/negative profile proof — TARGET
до соответствующей реализации. Web/worker artifacts обязаны содержать свой
validated manifest, не читают файл соседнего продукта.
Identity is selected before build and stays immutable in the artifact; changing
JSON requires rebuilding/rechecking the product, not editing a running image.

## Новый производный repository

1. Создайте новый repository из принятого чистого commit starter с собственной Git identity. Выберите только постоянный tracked source/canon, исключая execution artifacts; не наследуйте его
   production branch, deployment host, database или secrets.
2. Переименуйте файлы и пути, содержащие starter slug, включая Compose,
   systemd, Nginx, backup и asset names.
3. В `starter.identity.json` установите `mode: "derived"` и замените каждое
   поле `identity` значениями нового продукта. Заполните блок `derivation`:
   собственный repository, default branch, `DELIVERY_PROFILE`, владельца
   migration baseline и решение `enabled`/`disabled`/`not_applicable` по каждому optional module.
4. Замените starter identity во всех application, documentation, operation и
   legal files. Derived identity verifier не пропускает legal `TODO:`;
   placeholders допустимы только в режиме starter. Подтверждение реальных
   юридических фактов остаётся отдельным release условием.
5. Создайте собственные secrets только через approved Secret Master project;
   не переносите `.env.local`, database URLs, tokens или credentials.
6. Настройте product-specific PostgreSQL roles/topology и exact-head GitHub
   delivery gate согласно выбранному `DELIVERY_PROFILE`.
7. Выберите свой repository role/profile и merge permissions; текущая программа
   Starter не даёт производному продукту автоматическое разрешение merge/release.
   Запустите `pnpm derive:verify`. Он не пропустит starter slug, example
   origin или legal placeholder в tracked text file либо имени файла.
8. До первого product-кода выполните `pnpm derive:smoke`: verification-only
   сценарий создаст одноразовую копию, новую локальную Git identity с GitHub origin, без SourceCraft configuration, установит
   frozen offline зависимости из локального pnpm store и запустит Prisma, quick, unit и build.
   Это не генератор продукта: результат всегда удаляется и не публикуется.
9. Пройдите `HANDOVER.md`, выполните обязательные проверки производного
   продукта и создайте отдельный PR. Сам starter не выпускается в production.

## Обязательные решения копии

- `outboxPlusQueue`: оставить сильной асинхронной основой или явно отключить;
- `pwa`: оставить install/offline shell либо удалить вместе с cache namespace;
- `platformAdmin`: оставить только при явной operational ownership модели;
- migration baseline: новая копия владеет перенесёнными migrations и заменяет
  starter database roles/application names до первого применения;
- delivery: новый продукт выбирает собственный профиль и не наследует
  готовность или release authority starter автоматически.

## Что проверяет verifier

Verifier читает только tracked text files и credential-free identity manifest.
Он не открывает secret manager, `.env.local`, database или remote deployment.
Это делает clean-room smoke повторяемым: успешный прогон доказывает, что
копия не сохранила скрытую identity starter.

## Граница наследования и фактическая конфигурация

Copy/generator never inherits Backlog, .beads, task-manager stores, temporary
master-plans/inventories, execution/approval/review snapshots, local reports,
.env.local, runtime data, artifacts or original Git/remote identity. Current
tracked canon contains no old execution plan and docs:check rejects inherited
execution files. Existing smoke copies tracked permanent sources only, creates
a new Git identity and validates GitHub-only delivery. The future generator
must enforce the same boundary automatically; a new owner is never asked to
clean a historical dossier. Git retains original template history for review,
but a new product does not inherit it as tasks or readiness evidence.

[ENVIRONMENT](ENVIRONMENT.md) owns actual variable required-if/default/scope
and flags legacy/example names that are not runtime inputs. Do not assume
blank auth variables enable login, OUTBOX_WORKER_ID env is wired, or backup S3
variables configure an application storage adapter. Current optional decisions
are outboxPlusQueue/pwa/platformAdmin/outboundHttp/objectStorage; runtime guards
и disabled profile tests остаются TARGET до их реализации. No real secrets, bucket,
provider, legal approval or production database are created by derive smoke.

A fresh derived copy must pass docs/config/identity/quick/unit/build and its
own protected exact-head gate. Nonempty legal replacements are syntactic
inputs; source-backed real facts/legal/media approval and permitted release
remain separate under [05](05_RELEASE_CHECKLIST.md) and [HANDOVER](HANDOVER.md).
