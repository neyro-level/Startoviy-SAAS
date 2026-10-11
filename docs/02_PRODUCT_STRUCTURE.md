# Структура приложения — АМС Старт

**Статус:** Active. Authoritative PAGE/FLOW registry and access/cache/index policy.
**Evidence:** `VERIFIED` rows describe actual source; rendered status/metadata,
authenticated flows and offline behavior require the matching browser/native
proof. A target is never a published URL or assumed implementation.

## Поверхности и навигация

`VERIFIED — src/app and components`: public header ведёт на `/` и открывает
login dialog; `/?login=1` открывает его после отказа в private access. Footer
содержит четыре legal ссылки и demo contacts из `legal-config.ts`.
Private shell строится сервером через `PrivateApplicationLayout` и
`project-registry/presentation`; navigation зависит от principal. Dashboard
ведёт к разрешённым проектам и, при platform authority, к administration.
Admin resource nav содержит organizations, memberships, projects, operations.
User creation находится внутри memberships, отдельного `/admin/users/` нет.
Private notifications доступны сейчас только platform-admin/platform-staff;
MEMBER получает notFound, расширение tenant feed — отдельное решение.
Breadcrumb/back behavior задают shell/PageHeader; public demo не имеет
выдуманного дерева коммерческих категорий.

## Реестр страниц и endpoint surfaces

Paths relative to repository root. Existing demo pages are not production.
Private policy: noindex/nofollow/nocache, no-store HTTP, excluded from SW/sitemap.

| ID | Реальный URL / тип | Access и состояния | Source и проверка |
| --- | --- | --- | --- |
| PAGE-001 | `/`, public landing; `/?login=1` dialog state | public; login pending/error; contact delivery disabled unless configured | `src/app/page.tsx`, `StartLanding.tsx`, LoginDialog; public/login/CTA browser proof |
| PAGE-002 | `/politika/`, legal demo | public; operator placeholders; publication blocked in derived until real legal verified | `src/app/politika/page.tsx`, LegalDocument/LegalContents; legal render and derive-negative proof |
| PAGE-003 | `/soglasie/`, legal demo | public; applicability depends on derived data flow | `src/app/soglasie/page.tsx`; legal render and consent/derived facts proof |
| PAGE-004 | `/cookies/`, legal demo | public; technical preferences/analytics policy needs product decision | `src/app/cookies/page.tsx`; legal render/derived facts proof |
| PAGE-005 | `/terms/`, legal demo | public; terms and dates are fixtures, not commercial agreement | `src/app/terms/page.tsx`; legal render/derived facts proof |
| PAGE-006 | `/dashboard/`, dynamic private workspace | fresh valid principal; absent/inactive/incomplete-admin-MFA → `/?login=1`; authorized empty/project lists | `src/app/dashboard/page.tsx`, layout; session/revocation/native permission and authenticated browser proof |
| PAGE-007 | `/notifications/`, dynamic private feed | fresh platform-admin/staff; other authenticated principal →404; filters/empty/pagination | `src/app/notifications/page.tsx`, layout; role deny, filters/read state, metadata/cache proof |
| PAGE-008 | `/admin/`, `/admin/{organizations,memberships,projects,operations}/`, dynamic admin | root →organizations; absent principal →login; non-admin →dashboard; invalid resource →404; loading/error/empty/filter/form/conflict | `src/app/admin/page.tsx`, `[resource]/page.tsx`, loading/error, resources.ts; native admin denies and authenticated browser proof |
| PAGE-009 | `/api/auth/*`, JSON auth | Better Auth GET/POST; missing configuration →503 safe AUTH_UNAVAILABLE; invalid login401 and rate-limit429; signup disabled | `src/app/api/auth/[...all]/route.ts`, auth/security-config; auth-security unit/native/browser proof |
| PAGE-010 | `/api/health/live`, `/api/health/ready`, JSON health | live reports process; ready checks auth/database/operations; failure503 safe READINESS_FAILED, no secret details | `src/app/api/health/*/route.ts`; platform-http/native health and no-store browser proof |
| PAGE-011 | `/offline/`, PWA offline surface; unknown URL404 state | enabled PWA offline notice; disabled PWA404; unknown catch-all calls notFound; no private payload fallback | `src/app/offline/page.tsx`, `not-found.tsx`, `[...notFound]/page.tsx`, `src/platform/pwa/service-worker.js`; offline/404/session-cache browser proof |

`VERIFIED — auxiliary source`: `/manifest.webmanifest` from `manifest.ts`,
`/robots.txt` from `robots.ts`, `/sitemap.xml` from `sitemap.ts`, `/sw.js` and
static icons are support resources for PAGE-001/011, not extra business pages.
No actual route implements public signup, account setup screen, organization
switcher or project-specific workspace yet; flow contracts below mark these gaps.

## URL, metadata и индексация

`VERIFIED — next.config.ts`: private/API headers use
`Cache-Control: private, no-store, max-age=0`. Service worker bypasses API,
admin/dashboard/notifications/auth/login prefixes and non-GET requests;
only public shell/offline/icons/static assets are cache candidates. Dashboard,
admin and notifications layouts explicitly set noindex/nofollow/nocache.
Robots excludes private/API and sitemap contains only landing/four legal pages.
Robots is not authorization. Tests must include authenticated and post-logout
requests; code presence does not prove absence of all private cache entries.

`VERIFIED — metadata sources`: demo origin is `https://ams-start.example`.
Root metadata currently permits public indexing and sets canonical `/`;
legal pages override canonical with their own path. Private/auxiliary pages
can inherit root canonical; this is a metadata gap to verify/harden before
acceptance, not a statement that their canonical is correct. Public indexing
in source is a demo default, not permission to publish the template.
A derived product establishes its own origin, legal readiness, robots/sitemap,
canonical, redirect and public search intent. No demand/frequency/position is
invented for CRM or future sites. Existing URL spelling remains unchanged.
Next currently uses its default slash behavior (`trailingSlash` is unset);
framework redirects must be checked on the built app before a URL migration.
Project slug grammar is lowercase ASCII words/digits separated by hyphens in
`project-registry/contracts.ts`; no slug-derived workspace route is shipped.
There is no locale/region URL family; `/api/`, admin/private/PWA are reserved.

| PAGE | Source title before root `%s` template | H1 / visible primary action | Description/sections owner |
| --- | --- | --- | --- |
|001|АМС Старт|АМС Старт; «Обсудить внедрение», secondary login|root layout + StartLanding; neutral foundation description|
|002|Политика конфиденциальности|Политика обработки персональных данных|politika metadata + LegalDocument/LegalContents|
|003|Согласие на обработку данных|Согласие на обработку персональных данных|soglasie metadata + LegalDocument/LegalContents|
|004|Правила использования Cookie|Правила использования файлов cookie|cookies metadata + LegalDocument/LegalContents|
|005|Общие условия сотрудничества|Общие условия сотрудничества|terms metadata + LegalDocument/LegalContents|
|006|Личный кабинет|АМС Старт; admin action only with permission|dashboard PageHeader and cards/project content|
|007|Уведомления|Уведомления; «Применить» filters|notification PageHeader/feed|
|008|Администрирование|Организации / Участники и доступ / Проекты / Операции|resources.ts definitions; filters/table/forms|
|009–010|N/A JSON|N/A|typed safe response schemas, no HTML SEO|
|011|offline currently inherits root; catch-all «Страница не найдена»|«Откройте страницу снова, когда появится интернет» / «Страница не существует»|offline/404 source; metadata gap explicitly requires check|

`VERIFIED — actual composition`: landing first screen is header → eyebrow →
H1/description → CTA/secondary copy → CRM/analytics/internal labels beside
an illustrative hero. Next region is footer/legal/demo contacts. There is no
second marketing offer, real case/proof, FAQ or pricing block. Legal screens:
header/back → eyebrow/title/description/version/date → legal content → footer.
Private workspace: shell → PageHeader → metrics → baseline/project sections.
Admin: PageHeader → summary → resource navigation → filters → table/pagination
→ forms. Notifications: PageHeader → filters → feed → pagination.
Derived products replace sections/CTA only from their actual requirements.

## Реестр сценариев

| ID | Контракт, source и текущая граница | Positive / negative proof |
| --- | --- | --- |
| FLOW-001 | provision → one-time setup → login → TOTP/recovery. identity service, auth and principal guards exist; full setup/TOTP/recovery UI TARGET | account-setup/native admin-MFA and login-security tests exist; complete browser setup/TOTP/recovery TARGET; consumed/expired/replayed token, revoked/disabled session deny |
| FLOW-002 | explicit organization selection → tenant request. persisted activeOrganizationId setter and fresh membership reload exist; switcher UI TARGET. Single membership may resolve directly; multiple cannot select first | principal-runtime-adoption/tenant-isolation native suites; missing selection/revoked membership/cross-org deny; authenticated switcher browser TARGET |
| FLOW-003 | project selection → project-owned request. neutral registry exists; project grant/capability/RLS and dedicated project screen TARGET | tenant isolation does not prove within-org cross-project isolation; native cross-project and worker denial TARGET |
| FLOW-004 | command → atomic business/audit/idempotency/outbox commit → worker. transaction and lease/retry boundaries exist; no live external consumer inherited | command-atomicity/outbox-reliability native suites; rollback/duplicate/retry/lease/shutdown proof; disabled-consumer policy TARGET |
| FLOW-005 | derive → smoke → independent product. copy-source verifier/smoke exist; real generator and independent pilot TARGET | frozen offline install/quick/unit/build smoke; leftover legal/identity negative tests; no secret/DB/history inheritance and deterministic generator TARGET |
| FLOW-006 | reviewed exact-head green PR → protected authorized merge → canonical main verification. Derived release separately requires approval/artifact/rollback | GitHub stale/missing/failed checks denied; actual checks/merge SHA readback; production/rollback proof belongs to approved derived rehearsal |

## Приёмка структуры

`TARGET / REQUIRES CHECK`: all existing PAGE/FLOW paths get their matching
positive/negative browser/native evidence for the final candidate. Existing
shell E2E covers landing/legal/manifest/offline/API cache/invalid-login throttle;
it does not cover successful MFA, tenant switching or project isolation.
[05](05_RELEASE_CHECKLIST.md) owns final acceptance, [06](06_DESIGN_SYSTEM.md)
owns visual/a11y matrices and [AUTH](AUTH.md) owns identity behavior.
