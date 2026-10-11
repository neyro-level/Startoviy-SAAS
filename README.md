# АМС Старт

Нейтральный starter для будущих CRM, аналитических кабинетов и внутренних веб-приложений АМС.

Роль репозитория — `template`, профиль проверки — `COMMERCIAL`. Из этой базы создаются самостоятельные продукты. Основной Git-контур — GitHub; SourceCraft допустим как зеркало. У шаблона нет production-контура. Владелец разрешил поэтапный автономный merge утверждённой программы через защищённые PR после review и успешного GitHub gate на точном SHA. Повторное разрешение на каждый merge не требуется. Итоговая видимость — private; временный public на время разработки разрешён для обхода исчерпанной квоты CI. Вернуть private нужно после проверки всей программы. Контракт — [`docs/03_ARCHITECTURE.md`](docs/03_ARCHITECTURE.md) и [ADR-015](docs/adr/ADR-015-commercial-template-github-delivery.md).

Внутри уже есть публичная главная страница, legal pages, login modal, приватный shell, Platform Admin, пользователи, организации, роли, проекты, audit trail, idempotency, outbox, worker, Docker/release templates и безопасный PWA-слой.

Scope и критерии повторного использования: [PRD](docs/01_PRD.md).
Маршруты и сценарии: [структура приложения](docs/02_PRODUCT_STRUCTURE.md).
Границы модулей, auth, RLS и worker: [архитектура](docs/03_ARCHITECTURE.md).

## Быстрый старт

Используйте Node **24.20.0** из [.node-version](.node-version) и pnpm
**11.5.1** из [package.json](package.json). Подготовьте локальный PostgreSQL18
и `.env.local` по [.env.example](.env.example) и
[реестру переменных](docs/ENVIRONMENT.md), без production credentials.

```bash
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm dev
```

`pnpm dev` слушает `http://127.0.0.1:3000`; управляемый `pnpm dev:start`
использует порт3001 и отдельные prerequisites. Создание/миграции локальной базы,
bootstrap и guarded test identity описаны в
[Local Development](docs/ops/LOCAL_DEVELOPMENT.md).

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

Для самостоятельного продукта используйте [DERIVATION](docs/DERIVATION.md),
затем [HANDOVER](docs/HANDOVER.md) и [приёмку](docs/05_RELEASE_CHECKLIST.md).
Текущая инструкция описывает copy-source; наличие плана генератора ещё не
означает его реализацию. Производный продукт задаёт свою модель, данные,
интеграции, legal и production-профиль.

В копию входят постоянные нейтральные инструкции и код. Локальный Backlog,
временные планы и журналы исполнения не являются документацией продукта.
Клиентские цены, реквизиты, SEO-семантика и production-топология определяются
в производном репозитории; демонстрационные legal pages требуют проверки
реального оператора до публикации.
