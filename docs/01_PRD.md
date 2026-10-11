# PRD — АМС Старт

**Статус:** Active. Authoritative product requirements and neutral fact policy.
**Product:** reusable MicroSaaS application starter, copy-source `template`.
**Evidence rule:** `VERIFIED` below names source-code facts or owner decisions;
current test/run results belong to the tracker/PR and must match their SHA.
`TARGET / REQUIRES CHECK` never means implemented or passed.

## Назначение и пользователь

`VERIFIED — owner decision, ADR-015`: solo owner использует базу для запуска
самостоятельных продуктов без повторной сборки identity, tenant boundaries,
commands, audit, worker и приватного UI. Шаблон проверяется как `COMMERCIAL`,
при этом production identity и эксплуатация принадлежат производному продукту.
Сокращение времени разработки — цель, измеренная экономия не заявляется.

| Класс будущего продукта | Что даёт база | Что определяет производный продукт |
| --- | --- | --- |
| CRM | организации, пользователи, neutral project registry, audit | сделки, клиенты, процессы и собственные права |
| Аналитический workspace | workspace shell, roles, безопасные server/worker boundaries | источники, показатели, расчёты, freshness и provider contracts |
| Внутренняя система | закрытый вход, operator provisioning, admin resources | operational ownership, предметные сущности и workflow |
| MicroSaaS | повторно используемые UI/auth/tenant/delivery contracts | оффер, onboarding, billing, данные и production |

`VERIFIED — owner-approved scope`: это сценарии применения, а не четыре
встроенных продукта. Шаблон не содержит выдуманных клиентских конверсий,
цен, тарифов, доказательств дохода или обещаний подключённой интеграции.

## Включённая база и инварианты

`VERIFIED — source inventory`: Better Auth username/password и TOTP plugin
находятся в `src/platform/auth/auth.ts`; signup отключён. Схема содержит
users/sessions, organizations/memberships, neutral `Project`, notification,
audit, idempotency, outbox и job/heartbeat records. Public shell, legal demo,
login dialog, dashboard/notifications и platform administration имеют
реальные routes; точные access/states описывает [02](02_PRODUCT_STRUCTURE.md).

`VERIFIED — source boundaries`: fresh persisted session проверяется в
`principal-session.ts`; principal factory отказывает disabled user, incomplete
setup и Platform Admin без session MFA proof. MEMBER требует membership;
при нескольких memberships нет выбора первого tenant, используется явный
active organization. Роли остаются `PLATFORM_ADMIN`, `STAFF`, `MEMBER` и
`ORG_OWNER`, `ORG_MEMBER`, `VIEWER` до принятого additive изменения.
Аутентификация всегда дополняется серверными permission/resource checks.

`VERIFIED — source contracts, ADR-006/007/008`: tenant RLS, scoped transaction,
atomic commands и outbox-plus-queue уже имеют реализацию и native PG tests.
Это не доказательство будущих project grants, outbound или storage contracts.
Операция проходит action/API/job → command → transaction-bound repositories;
внешние эффекты выполняются после commit. PII и secrets не входят в UI/logs/Git.

`TARGET / REQUIRES CHECK`: полноценные setup/TOTP/recovery и organization/project
selection UI требуют hardening; наличие service функций не подтверждает
целый пользовательский flow. Нейтральные project capability/grant/RLS,
SecretRef redaction, safe outbound, opt-in S3, consumer enable/disable и новые
adversarial/recovery scenarios проверяются отдельными реализациями и тестами.

## Основные действия и критерий повторного использования

`VERIFIED — accepted contract`: оператор создаёт identity и membership;
пользователь завершает setup, входит и действует в разрешённом scope;
Platform Admin получает authority только с MFA. FLOW-001…006 принадлежат02,
а auth детали — [AUTH](AUTH.md), scope — [архитектуре](03_ARCHITECTURE.md).
Public CTA показывает вход/нейтральное demo; contact delivery по умолчанию
отключён и не означает доставку реальному получателю.

`TARGET — acceptance contract`: из чистого проверенного SHA можно создать
самостоятельный repository без backlog, планов, execution snapshots, чужой
identity, secrets, БД или production host. Копия проходит frozen install,
identity/legal/config checks, quick/unit/build и собственный exact-head gate.
Disabled optional feature не требует внешнего сервиса и безопасно отказывает.
Генерация/negative fixtures и independent pilot подтверждают это поведение;
старый copy-source smoke не выдаётся за готовый генератор.

## Scope производного продукта

`VERIFIED — owner decision`: отраслевой домен, provider integrations, live
данные, тарифы/подписки/платежи, public signup, реальный legal operator,
SEO-семантика, домен, Secret Master scope, database topology и production
не входят в базу. Billing/monetization recipe допустим как отдельное решение
производного продукта; обязательной billing реализации в Starter нет.
Derived продукт выбирает `COMMERCIAL | CRITICAL`, собственные delivery
permissions, migration ownership и optional modules. Разрешение merge текущей
программы Starter не переносит production authority в новую копию.

## Требования и единственные владельцы

IDs сохраняют утверждённую линию требований. REQ-13 применяет последующее
решение владельца: GitHub primary вместо исходного SourceCraft-first.
Статус строки описывает контракт; выполнение подтверждает указанный proof.

| ID | Требуемый результат | Authoritative owner | Implementation owner / proof source | Факт / gap и обязательная проверка |
| --- | --- | --- | --- | --- |
| REQ-01 | единый SOT без дублей | [README](README.md) | [docs checker](../scripts/verify-docs-canon.mjs), [link tests](../tests/docs-links.test.ts) | VERIFIED role map; docs/link consistency |
| REQ-02 | воспроизводимый нейтральный derive | [DERIVATION](DERIVATION.md) | [copy smoke](../scripts/verify-clean-room-derivation.mjs), [derive tests](../tests/derivation-contract.test.ts); generator TARGET | VERIFIED copy-source smoke; TARGET generator и negative fixtures |
| REQ-03 | identity/legal только своего продукта | этот файл: facts | [manifest](../starter.identity.json), [legal source](../src/shared/legal/legal-config.ts), [derive tests](../tests/derivation-contract.test.ts) | VERIFIED manifest/verifier; derived legal denial и no-starter traces |
| REQ-04 | сохранение TOTP и recovery | [AUTH](AUTH.md), ADR-005 | [identity](../src/modules/identity-access/), [setup/recovery tests](../tests/integration/account-setup.integration.test.ts); complete browser flow TARGET | VERIFIED backend guards; TARGET end-to-end setup/TOTP/recovery |
| REQ-05 | login security, anti-enumeration | [AUTH](AUTH.md) | [auth security](../src/platform/auth/security-config.ts), [tests](../tests/auth-security-config.test.ts), [browser login](../tests/e2e/platform-shell.spec.ts) | VERIFIED rate-limit/errors source; adversarial unit/integration proof |
| REQ-06 | fresh session, explicit org | [03](03_ARCHITECTURE.md) | [session](../src/platform/auth/principal-session.ts), [native principal](../tests/integration/principal-runtime-adoption.integration.test.ts) | VERIFIED persisted session/principal; revocation and selection tests |
| REQ-07 | neutral project scope/RLS | [03](03_ARCHITECTURE.md), [DATA_MODEL](DATA_MODEL.md) | [project registry](../src/modules/project-registry/), [RLS baseline tests](../tests/integration/tenant-isolation.integration.test.ts); new project tests TARGET | TARGET additive project grants/capabilities; native cross-project denies |
| REQ-08 | SecretRef и safe logging | [SECURITY](SECURITY.md), [ENVIRONMENT](ENVIRONMENT.md) | [logger](../src/platform/observability/logger.ts), [runtime safety](../tests/runtime-safety.test.ts); typed SecretRef/adversarial extensions TARGET | TARGET typed secret boundary; adversarial redaction tests |
| REQ-09 | safe outbound adapter | [03](03_ARCHITECTURE.md) | [platform HTTP boundary](../src/platform/http/); SSRF/DNS/timeout adapter and tests TARGET | TARGET opt-in SSRF/DNS rebinding/timeout contract |
| REQ-10 | transactional outbox reliability | [03](03_ARCHITECTURE.md), ADR-008 | [operations](../src/modules/platform-operations/), [native reliability](../tests/integration/outbox-reliability.integration.test.ts), [worker tests](../tests/outbox-worker.test.ts) | VERIFIED implementation/test sources; restart/retry/lease/disabled regression |
| REQ-11 | optional object storage | [03](03_ARCHITECTURE.md) | [platform adapter boundary](../src/platform/), [project registry](../src/modules/project-registry/); S3 adapter/scoped tests TARGET | TARGET scoped S3 adapter; cross-project/disabled denial |
| REQ-12 | нейтральный usable UI | [06](06_DESIGN_SYSTEM.md) | [UI/shell](../src/components/), [static UI](../scripts/verify-ui-conformance.mjs), [browser](../tests/e2e/platform-shell.spec.ts) | VERIFIED shared components; responsive/a11y/visual proof required |
| REQ-13 | portable GitHub-primary delivery | [03](03_ARCHITECTURE.md), ADR-015 | [GitHub policy](../scripts/ci/verify-github-policy.mjs), [negative tests](../tests/github-policy.test.ts), provider API | VERIFIED exact-SHA contract; actual current required checks/protection |
| REQ-14 | backup/restore и operational proof | [05](05_RELEASE_CHECKLIST.md), [RECOVERY](ops/RECOVERY.md) | [recovery ops](../ops/postgres/), [release ops](../ops/release/), [contract tests](../tests/release-contract.test.ts); actual fixture restore/rollback TARGET | VERIFIED recipes; TARGET disposable restore/health/rollback proof |
| REQ-15 | independent product pilot | [HANDOVER](HANDOVER.md) | [copy smoke](../scripts/verify-clean-room-derivation.mjs); independent CRM pilot positive/negative TARGET | TARGET disposable CRM positive/negative smoke without identity residue |
| REQ-16 | optionality без лишней инфраструктуры | [03](03_ARCHITECTURE.md) | [manifest](../starter.identity.json), [worker](../src/worker/); generator/consumer/outbound/storage disabled tests TARGET | TARGET all-module disabled paths pass/deny and no mandatory service |
| REQ-17 | private UI/PWA protection | [06](06_DESIGN_SYSTEM.md), ADR-012 | [SW](../public/sw.js), [PWA tests](../tests/pwa.test.ts), [browser](../tests/e2e/platform-shell.spec.ts); authenticated cache extensions TARGET | VERIFIED cache exclusions source; offline/session-cache browser tests |
| REQ-18 | честная готовность | [05](05_RELEASE_CHECKLIST.md) | [static conformance](../scripts/verify-final-conformance.mjs), [conformance tests](../tests/final-conformance.test.ts); actual exact-SHA provider/recovery proof | VERIFIED status contract; exact-SHA evidence matrix, no assumed PASS |

Implementation/proof references are refined by their owning documents;
[HANDOVER](HANDOVER.md) collects the guarantee map without owning product rules.

## Факты и placeholders

`VERIFIED — starter.identity.json and legal sources`: имя «АМС Старт», example
origin, service/artifact names и legal `TODO:` — demo identity, разрешённая
только в `mode=starter`. Они не являются реквизитами работающего SaaS.
`pnpm derive:verify` проверяет tracked text/name surfaces и в derived mode
отвергает незаменённые starter identity и legal placeholders.

`REQUIRES CHECK — derived owner`: legal name/email/address, public origin,
repository/migration owner, optional-module решения, клиентские факты и права
на медиа должны иметь собственный подтверждённый источник до публикации.
Неизвестное значение остаётся неизвестным; оно не заменяется фиктивной ценой,
нулевой статистикой, отзывом или чужим контактом. Подробный fact registry и
negative release fixtures уточняют эту политику в том же разделе.

### Реестр фактов и разрешённых входов

`checkedAt` — дата проверки **source**, не дата юридического подтверждения.
Проверка ниже относится к текущей нейтральной структуре2026-10-11; производный
продукт записывает свой источник/ответственного/свежесть для каждого реального
факта. Шаблон не создаёт будущему владельцу пустое клиентское досье.

| Поле / факт | Допустимое значение в Starter | Source, checkedAt, status | Policy для derived release |
| --- | --- | --- | --- |
| product name/slug/service/artifact/database prefix | demo identity из manifest | starter.identity.json;2026-10-11; VERIFIED demo | собственные значения обязательны; starter residue автоматически deny |
| public origin | example HTTPS origin | manifest + app metadata/robots/sitemap;2026-10-11; VERIFIED demo | собственный non-example HTTPS origin; verifier rejects example/local; live reachability REQUIRES CHECK |
| legal operator name/email/address | явный legal TODO placeholder | manifest + shared/legal/legal-config.ts;2026-10-11; VERIFIED placeholder | обязательные nonempty replacements в manifest и tracked content; placeholder/blank автоматически deny; подлинность подтверждает derived owner |
| INN/registration/phone/contact URLs | demo TODO/example contact | manifest legal fields + shared/legal mapping/public contacts + footer;2026-10-11; VERIFIED placeholder | заменить/обоснованно удалить surface по реальному продукту, legal/recipient proof; не публиковать demo contact |
| legal wording/version/effective dates | demo content/version, без обещания применимости | legal pages/LegalContents;2026-10-11; VERIFIED fixture | real operator/data-flow/cookie/consent review; source date alone is not legal approval |
| derived repository/branch/migration ownership | template GitHub/main/own slug; sourceRevision null only in starter | manifest.derivation;2026-10-11; VERIFIED config | own repository selected, source SHA exact, migration owner matches product, branch main; otherwise automatic deny |
| optional modules | explicit starter defaults: core extras enabled, outbound/storage disabled | manifest.derivation.optionalModules;2026-10-11; VERIFIED config, runtime guards TARGET | each enabled/disabled/not_applicable explicit; technical disabled behavior tested separately |
| contact receiver | disabled public configuration | .env.example/send-lead;2026-10-11; VERIFIED disabled | owned receiver/consent and actual delivery proof before enable; no invented receipt |
| price/tariff/offer/case/review/SEO demand | absent | owner neutral-scope decision;2026-10-11; VERIFIED N/A for template | real verified input only when that derived scope exists; no placeholder sales claim |
| media/assets rights | existing neutral local assets, illustrative hero | public/assets and source composition;2026-10-11; VERIFIED inventory, rights REQUIRES CHECK | derived product confirms license/permission before publishing reused/added fonts/assets/photos; no invented approval |

### Автоматический и фактический gate

`VERIFIED — verifier/tests`: `pnpm derive:verify` requires derived mode and
complete identity/derivation inputs, scans tracked text/file names and rejects
starter/demo TODO traces. Negative fixtures explicitly check unresolved legal
source despite complete manifest, missing legal name, unresolved email and
undecided optional module. Unknown inputs remain blocked; no manual deletion
of a fact document is required. The same PRD role stays useful in a new copy.

`REQUIRES CHECK`: nonempty replacement is not verification of a real operator,
license, contact receiver, legal applicability or search demand. A synthetic
fixture is test data, not a permissible commercial fact. Derived release
requires source-backed facts and operator/legal/media approval in05; an
identity verifier PASS alone never grants publication. Future generator/facts
hardening must preserve both automatic negative checks and that human boundary.

## Готовность

`VERIFIED — acceptance contract`: [05](05_RELEASE_CHECKLIST.md) различает
техническую готовность шаблона, готовность derivation и готовность релиза копии.
Наличие исходников или прошедший тест другого SHA не закрывают неизвестные
facts, отсутствующий flow или обязательный gate. Starter никогда не получает
статус DEPLOYED в рамках этой программы. Текущий прогресс живёт в Backlog/PR,
а не в PRD; этот документ не утверждает завершение программы.
