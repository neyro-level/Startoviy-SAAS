# Дизайн-система — АМС Старт

**Статус:** Active. Единственный владелец общих визуальных правил шаблона.
**VERIFIED source:** `src/app/globals.css`, `src/components/ui/`, shell,
marketing components and `scripts/verify-ui-conformance.mjs`.
Эта инвентаризация не подтверждает WCAG или визуальный review всех состояний.

## Токены и поверхности

Единственный runtime token source — [globals.css](../src/app/globals.css).
`:root` задаёт application semantic roles; `.theme-app` использует светлый
workspace, `.theme-public` задаёт scoped public roles. Это две поверхности
одной системы, а не две независимые палитры/библиотеки. Generic primitives
не зависят от public tokens; публичные композиции используют их scoped роли.
Подробности композиции принадлежат [public extension](EXTERNAL_SITE_DESIGN_SYSTEM.md)
и [private extension](INTERNAL_DASHBOARD_DESIGN_SYSTEM.md), значения — CSS.

| Семантика | Действующий источник | Правило использования |
| --- | --- | --- |
| фон/текст/карточки | background, foreground, card, muted, text-secondary | private text uses stable `text-app-*` utilities |
| действия/focus | primary, primary-foreground, ring, input | существующие Button/Input variants; focus-visible обязателен |
| status | success, warning, info, destructive, status-neutral and soft pairs | статус передаёт также label/icon, не только цвет |
| navigation | sidebar family | shell/nav не создают собственную raw палитру |
| public | scoped ch-accent/bg/text/border/focus/error families | для marketing/legal композиции, не generic UI primitives |
| radius | radius, radius-panel, radius-card | controls/panels/cards используют token; raw repeated radii не добавлять |
| shadow/overlay | shadow-surface, shadow-overlay, overlay and scoped public overlay | popup/surface roles, без произвольных system shadows |

`VERIFIED`: цвета и радиусы централизованы; часть spacing/type/container
значений пока задана композиционными Tailwind classes, а не полноценной
семантической шкалой. `TARGET / REQUIRES CHECK`: E08 нормализует повторяющиеся
layout/type values, если review докажет необходимость. Несуществующие tokens
не документируются как доступный API. Hub/provider brand не переносится.

## Типографика и композиция

`VERIFIED`: body — локальный PT Root UI variable с системным fallback,
14px/22px; public `.start-landing` использует Manrope через @fontsource.
PageHeader рендерит один H1, private headline меняется text-xl → sm:text-2xl;
public hero использует responsive clamp. Длинные русские заголовки, truncation
и строки таблиц требуют browser review; назначение текста задаёт02/PRD.
Icons — Lucide; decorative hero SVG имеет aria-hidden. Чужие фото/кейсы не
включаются без доказанных прав. Не добавлять второй font/icon/UI package.

## Повторное использование компонентов

Существующая система — собственные typed primitives, Base UI для dialog,
popover и других interaction foundations, Tailwind4 и cva variants.
Порядок изменения: REUSE → VARIANT → COMPOSE → CREATE. Не устанавливать новый
UI kit для задачи, которую решает существующий primitive.

| Элемент | Source owner | Действующий контракт / проверяемые состояния |
| --- | --- | --- |
| Button / ButtonLink | `components/ui/button.tsx`, button-link.tsx | default/secondary/outline/ghost/link/destructive; default/sm/lg/icon; disabled/focus; icon action needs accessible name |
| Dialog / Sheet | ui/dialog.tsx, sheet.tsx; Base UI | portal/backdrop/title/close; keyboard/focus return/Escape; pending guard belongs to consumer |
| Input / Field / NativeSelect / Checkbox | ui primitives + admin form compositions | label/hint/error association, aria-invalid, pending/disabled; native select rather than extra selector library |
| Table / AdminDataTable | ui/table.tsx, shared table composition and PlatformAdminTable | desktop columns/sort/pagination, mobile cards, empty and filtered-empty |
| Shell / navigation | components/shell, server PrivateApplicationLayout | stable left nav, collapsed/mobile drawer, active route, account authority from server |
| PageHeader / SectionCard / KpiCard | components/dashboard | hierarchy and neutral metrics from DTO; no DB access in primitive |
| Status / Loading / Error | badge/alert/spinner/skeleton and shared states | labelled status, layout-safe skeleton, safe error with bounded retry |
| Public button/login/contact | MarketingButton, LoginDialog, LeadRequestDialog | public composition of common primitives; no implicit signup/live contact delivery |

`TARGET / REQUIRES CHECK`: labels for all notification filters, focus/aria
association for every form, destructive confirmation, error/retry and all
loading/empty states are verified per actual flow; generic Base UI ownership
alone is not complete accessibility evidence. No implementation text in user
flow unless it helps a meaningful decision. Ready/status demo copy must not
promise verified service or delivery that is still disabled.

## Матрица визуальной и accessibility приёмки

Все строки — требование для E08/финальной проверки, не заранее прошедший review.
Widths: **375, 768, 1024, 1280, 1440** CSS px, plus breakpoint boundaries.
Текущий Playwright profile имеет375/768/1280/1440;1024 ещё требует добавления
или отдельной фактической проверки.

| Поверхность | Состояния и данные | Проверка на каждом применимом viewport |
| --- | --- | --- |
| landing/legal/404/offline | длинный H1/body, footer, demo placeholders, offline notice | overflow, порядок секций, читаемость, links, no private data |
| login/setup/MFA/recovery | closed/open, keyboard, pending, invalid, rate-limited, success/expired token | title/labels/focus trap/return/Escape; password/token not exposed |
| workspace/navigation | empty/projects, collapsed/drawer, multi-org target, long project/user names | usable nav/touch targets, no hidden necessary actions, post-logout cache denial |
| admin table/forms | empty/filtered/data, long strings, loading/error/conflict/pagination | desktop columns/mobile cards, order, labels, focus, safe retries |
| notifications | empty/feed/filter/read state, denied role, pending/error | filter names, feed hierarchy, status text, noindex/no-store |

Keyboard-only traversal, visible focus, correct labels and heading hierarchy,
contrast4.5:1 for normal text /3:1 for large text, distinguishable control
boundaries, primary touch targets44×44 where applicable and reduced-motion
behavior are acceptance targets. Actual small variants/close controls require
review against target rather than assumed compliance. Contrast is unmeasured
until measured on the actual rendered token pairs and states.

## Проверки и границы evidence

`pnpm verify:ui` проверяет static token/primitive/global-CSS boundaries;
`pnpm docs:check` проверяет канон/ссылки. Они не доказывают rendering, contrast,
keyboard или auth/cache behavior. `test:e2e:run` проверяет существующие browser
scenarios; итоговая приёмка расширяет их до применимых строк выше.
Visual evidence живёт в tracker/PR, не наследуемых screenshot/history досье.
[05](05_RELEASE_CHECKLIST.md) владеет общей приёмкой;
[02](02_PRODUCT_STRUCTURE.md) владеет PAGE/FLOW и content structure.
