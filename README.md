# АМС Старт

Нейтральный starter для будущих CRM, аналитических кабинетов и внутренних веб-приложений АМС.

Роль репозитория — `template`, профиль проверки — `COMMERCIAL`. Это приватный copy-source шаблон, из которого создаются самостоятельные продукты. Основной Git-контур — GitHub; SourceCraft допустим как зеркало. У шаблона нет production-контура. Приёмка изменений требует review и успешного GitHub gate на точном SHA; merge остаётся по отдельной команде владельца (`PR_ONLY`). Контракт — [`docs/03_ARCHITECTURE.md`](docs/03_ARCHITECTURE.md) и [ADR-015](docs/adr/ADR-015-commercial-template-github-delivery.md).

Внутри уже есть публичная главная страница, legal pages, login modal, приватный shell, Platform Admin, пользователи, организации, роли, проекты, audit trail, idempotency, outbox, worker, Docker/release templates и безопасный PWA-слой.

## Что оставлено

- публичный сайт: `/`, `/politika/`, `/soglasie/`, `/cookies/`, `/terms/`;
- приватная рабочая область: `/dashboard/`;
- администрирование: `/admin/organizations/`, `/admin/memberships/`, `/admin/projects/`, `/admin/operations/`;
- уведомления: `/notifications/`;
- роли: `PLATFORM_ADMIN`, `STAFF`, `MEMBER`;
- PostgreSQL + Prisma baseline;
- Better Auth username/password;
- PWA: manifest, standalone mode, offline page, service worker без кеширования приватных маршрутов.

## Что удалено

Предметная вертикаль исходного продукта полностью удалена: внешние провайдеры, отчёты, fixtures и старые provider scripts.

## Быстрый старт

```bash
pnpm install
pnpm prisma:generate
pnpm dev
```

Для локальной базы используйте `.env.example` как шаблон. Перед production у производного продукта должны быть собственные домен, юридические реквизиты, секреты, database topology и release решение.

## Проверки

```bash
pnpm verify:config
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm verify:quick
```

`verify:config` дополнительно проверяет, что старый product vertical не вернулся и PWA не кеширует приватные маршруты.

## Документы

Карта документов: [`docs/README.md`](docs/README.md).

Главная идея упаковки: не делать из starter “пример продукта”. Каждый новый продукт берёт эту базу, затем отдельным stream добавляет свою доменную модель, данные, интеграции, тексты, legal и production-профиль.

В копию входят постоянные нейтральные инструкции и код. Локальный Backlog,
временные планы и журналы исполнения не являются документацией продукта.
Клиентские цены, реквизиты, SEO-семантика и production-топология определяются
в производном репозитории; демонстрационные legal pages требуют проверки
реального оператора до публикации.
