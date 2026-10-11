# Copy-source derivation

**Status:** Active extension. PRD owns product/facts; Architecture owns optional
boundaries; this file owns the actual derivation interface and verification.

`VERIFIED`: typed identity, exact-SHA generator, runtime guards for core optional
modules and repeatable disposable native/browser smoke. An independent domain
pilot and future HTTP/storage adapters still need their own proof. No historical
run verdict establishes readiness of a newly generated product.

## Локальный generator: dry-run → apply

Use `pnpm derive:create` from a clean template checkout on the selected full
commit SHA. The input JSON follows ProjectIdentityV2: own product name/slug,
HTTPS origin, icons/brand labels, service/worker/database/artifact IDs, legal
inputs, GitHub origin, profile COMMERCIAL or CRITICAL and explicit module flags.
Icon/favicon paths must end in `.svg`: the generator renames existing SVG
assets and the runtime declares SVG MIME; it does not convert PNG/ICO bytes.
Origin hostnames require valid bounded DNS labels or a canonical IPv6 literal;
arbitrary URL-host punctuation cannot enter generated proxy configuration.
`mode` becomes derived; null `sourceRevision` is filled from `--source-sha`,
which must match the clean checkout's HEAD. Check out the desired commit before
running its generator; older reachable trees cannot be mixed with newer code.
When `--source` names another checkout, its generator, imported validation
contracts and dependency manifests must match the executing implementation.
An explicitly different revision is rejected. Actual legal provenance stays
REQUIRES_CHECK; fixtures never establish release authority. Do not put secrets
or environment values in input JSON or flags.
Derived origins reject `.example` and `example.com/net/org`, including their
subdomains. Disposable proofs use `.test` origins and local HTTP listeners;
they do not prove DNS ownership, live domain readiness or publication.

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

## Disposable proof: два прогона

```bash
pnpm derive:smoke --native required --browser required --evidence /outside/source/proof.json
```

По умолчанию выполняются два прогона. Starter запускает настоящий generator
из чистого текущего SHA; производный продукт репетирует собственный immutable
source без замены identity, migrationOwner или profile. Starter дважды проверяет
dry-run перед apply. В каждом прогоне: сравнение постоянных файлов, negative restored identity,
frozen offline install, Prisma generate/validate, docs/quick/unit, web/worker
build, проверки HTTP и выбранных модулей. Установленные PostgreSQL18 и Chromium
добавляют native integration и браузерный путь. Активный outbox проверяется
полным clean/repeated-reverse набором; отключённый — применимыми core suites.

PostgreSQL получает отдельный кластер, literal loopback и собственные `_test`
role/database. Используются доступные native18 tools либо заранее загруженный
pinned Docker image; существующая БД и реальные credentials не используются.
Браузер должен соответствовать frozen Playwright: установите его заранее через
`pnpm exec playwright install chromium`. Для offline install предварительно
нужен populated pnpm store той же версии lockfile.

`--native auto` и `--browser auto` — defaults: отсутствие prerequisites даёт
`BLOCKED`, общий `LOCAL_PASS_EXTERNAL_PROOF_INCOMPLETE`, никогда полный `PASS`.
`required` завершает команду с ошибкой при отсутствии обязательного proof;
`off` явно записывает `NOT_RUN`. `--runs 1` допустим для диагностики и не заменяет
двухпроходную приёмку: даже с native/browser PASS общий verdict остаётся
`DIAGNOSTIC_COMPLETE_REPEATABILITY_NOT_PROVEN`, repeatability — NOT_PROVEN.
`--modules enabled|disabled|not_applicable` выбирает
профиль synthetic Starter proof; derived rehearsal менять свой профиль запрещено.

JSON в stdout/необязательном новом внешнем файле содержит source SHA/tree,
slug/profile, exact package/runtime versions, file fingerprints, checks,
`PASS`/`FAIL`/`BLOCKED`/`CANCELLED`, sourceUnchanged и cleanup. Файл не должен быть
внутри source или существовать до запуска. Legal inputs, environment values и
secrets в evidence не входят. SIGINT/SIGTERM останавливают owned process groups;
свои temp repositories, DB/volumes удаляются при успехе, ошибке и отмене.
Smoke не публикует repository, не создаёт внешний ресурс и не делает deploy.

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
platformAdmin, outboundHttp и objectStorage. Core optional guards и negative
profile checks реализованы; каждый новый продукт повторяет их на своём SHA.
HTTP/storage adapters остаются отдельными implementation/proof targets. Web/worker artifacts обязаны содержать свой
validated manifest, не читают файл соседнего продукта.
Identity is selected before build and stays immutable in the artifact; changing
JSON requires rebuilding/rechecking the product, not editing a running image.

## Ввод нового SaaS: Solo + AI

Начните с [docs map](README.md), нужных разделов01/02/03/06 и этого интерфейса.
`HANDOVER.md` содержит карту гарантий и передачу продукта;05 владеет приёмкой.
Манифест — источник уже выбранных identity, profile и module states; AI не
запрашивает их повторно и не выводит их из истории чата.

1. **Вход владельца.** Выберите собственные slug/name, canonical HTTPS origin,
   operational IDs, GitHub repository, COMMERCIAL или CRITICAL, module states
   и владельца migrations. Подготовьте ProjectIdentityV2 JSON вне source без
   secrets. Legal inputs берите из подтверждаемых источников владельца;
   отсутствие данных оставьте блокером, не заполняйте вымышленными реквизитами.
   `legalReferences.status` остаётся REQUIRES_CHECK до фактической проверки.
2. **Создание локальной копии.** Зафиксируйте полный принятый template SHA и
   отсутствующий target с существующим parent. Выполните dry-run/apply из
   раздела generator выше; проверьте hash, paths, profile, omitted files.
   Результат — новый local main, один commit и own origin. Публикация remote
   и изменение GitHub settings являются отдельными действиями владельца.
3. **Ручной ресурсный узел.** После отдельной авторизации создайте новую БД,
   собственные runtime/migrator/backup roles и новый Secret Master scope.
   Не используйте starter/другой продукт как fallback, не переносите `.env.local`.
   Список required-if/default/scope берите из [ENVIRONMENT](ENVIRONMENT.md).
   Недоступный ресурс фиксируется как BLOCKED с условием продолжения; generator
   и smoke этого действия не выполняют. Тесты используют отдельную `_test` БД.
4. **Домен и канон.** Назначьте owner нового domain module, его границы,
   permissions и tenant/project policy в03/ADR, а требования/страницы/дизайн/
   факты/приёмку — у единственных owners из docs map. Реализуйте через facade,
   command, transaction-bound repositories и post-commit side effects.
   Auth/TOTP/tenant foundation сохраняйте; проектные grants и новые adapters
   требуют собственной реализации и negative proof. Не создавайте duplicate
   AGENTS, пустые клиентские досье или копию истории задач Starter.
5. **Приёмка копии.** В новом repository выполните derive:verify, docs:check,
   verify:quick, unit/security, build и guarded native integration/browser.
   Запустите двухпроходный derive:smoke с required prerequisites; scoped/off
   диагностика не заменяет полный applicable proof. Проверьте disabled paths,
   identity остатки и отсутствие execution/secrets artifacts. Используйте
   [HANDOVER](HANDOVER.md) и [05](05_RELEASE_CHECKLIST.md), записывая только
   фактически выполненные проверки текущего SHA в собственном tracker/PR.
6. **PR и main.** Установите собственный exact-head GitHub gate, protected main
   и merge procedure. Проведите review, дождитесь green required checks точного
   head SHA и объединяйте только при разрешённой владельцем процедуре. Проверьте
   новый canonical main. Разрешение автономного merge этой программы Starter
   и временный public не наследуются производным продуктом.
7. **Production отдельно.** Собственные legal/facts, immutable artifacts,
   recovery и live/user-flow proof завершают05. Production требует отдельной
   явной команды владельца. Сгенерированная копия, синтаксически заполненные
   поля и local PASS не означают готовность клиента или разрешённый release.

## Остановки и ошибки

| Ситуация | Действие |
| --- | --- |
| Dirty source, отсутствующий SHA, symlink/private source, существующий target | Исправить вход; не перезаписывать чужую работу и не обходить refusal |
| Apply hash отличается | Повторить dry-run для текущих inputs/target/SHA и проверить новый hash |
| Manifest invalid или residue в legal/SQL/config/assets/docs | Исправить у владельца источника; не расширять allowlist и не маскировать placeholder |
| Нет offline store, PG18 или frozen Chromium | Подготовить prerequisite; BLOCKED/NOT_RUN не считать PASS |
| Нет actual provider gate/permission или legal/recovery proof | Сохранить проверенный candidate, продолжать независимую работу; не merge/release без обязательного условия |
| Smoke FAIL/CANCELLED или cleanup FAIL | Проверить внешний evidence; восстановить только свои ресурсы, повторить proof после исправления |

## Граница наследования

Generator переносит только постоянный source/canon. Backlog, .beads,
task-manager stores, temporary master-plans/inventories, execution/approval/
review snapshots, local reports, env/private files, runtime data и старая
Git history не входят в новую копию. docs:check и derive:verify проверяют эту
границу; новому владельцу не поручается удалять документы старой программы.
Нейтральные документы остаются самостоятельным каноном продукта с собственными
inputs. Старая проверка шаблона не становится текущим proof производного SaaS.
