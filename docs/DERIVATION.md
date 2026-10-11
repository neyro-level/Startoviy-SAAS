# Copy-source derivation

**Status:** Active extension. PRD owns product/facts; Architecture owns optional
boundaries; this file owns the actual derivation interface and verification.

`VERIFIED`: baseline uses copy-source plus identity manifest and disposable
smoke. `TARGET`: approved deterministic generator is not yet implemented;
existing smoke must not be described as a finished scaffolding CLI. No template
distribution service or production product is created by verification.

## Новый производный repository

1. Создайте новый repository из принятого чистого commit starter с собственной Git identity. Выберите только постоянный tracked source/canon, исключая execution artifacts; не наследуйте его
   production branch, deployment host, database или secrets.
2. Переименуйте файлы и пути, содержащие starter slug, включая Compose,
   systemd, Nginx, backup и asset names.
3. В `starter.identity.json` установите `mode: "derived"` и замените каждое
   поле `identity` значениями нового продукта. Заполните блок `derivation`:
   собственный repository, default branch, `DELIVERY_PROFILE`, владельца
   migration baseline и решение `enabled`/`disabled` по каждому optional module.
4. Замените starter identity во всех application, documentation, operation и
   legal files. Legal `TODO:` закрываются до публикации, не при копировании
   в личную черновую ветку.
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
are outboxPlusQueue/pwa/platformAdmin; new outbound/storage switches remain
TARGET until their interface and disabled tests exist. No real secrets, bucket,
provider, legal approval or production database are created by derive smoke.

A fresh derived copy must pass docs/config/identity/quick/unit/build and its
own protected exact-head gate. Nonempty legal replacements are syntactic
inputs; source-backed real facts/legal/media approval and permitted release
remain separate under [05](05_RELEASE_CHECKLIST.md) and [HANDOVER](HANDOVER.md).
