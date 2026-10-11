# Развитие нейтральной базы

**Статус:** Active. Это постоянная граница scope, не журнал исполнения.

## Что принадлежит Starter

Укрепление нейтральных identity/MFA, серверной авторизации, tenant/project
изоляции, transaction-bound commands, audit/idempotency/outbox, безопасного
worker, UI/PWA, derivation и проверяемых delivery/recovery contracts.
Требуемое поведение и gaps описывают [01_PRD.md](01_PRD.md) и
[03_ARCHITECTURE.md](03_ARCHITECTURE.md), маршруты — [02_PRODUCT_STRUCTURE.md](02_PRODUCT_STRUCTURE.md).
Наличие контракта не означает завершения его реализации или проверки.

## Что принадлежит производному продукту

Доменная модель, реальные интеграции и данные, цены/тарифы, пользовательский
signup при необходимости, юридический оператор, SEO и production topology.
Производный продукт устанавливает свои delivery permissions и release authority.

## Где искать текущую работу

Утверждённые волны, dependencies, статусы, планы реализации и результаты
проверок хранятся в локальном Backlog; review, exact-head gate и merge — в PR
и Git канонического GitHub. Они не дублируются в документации шаблона и не
наследуются новой копией. История старого epic не является текущим PASS.

## Принятие изменений

[ADR-015](adr/ADR-015-commercial-template-github-delivery.md) определяет
COMMERCIAL contract и разрешённый владельцем поэтапный автономный merge
утверждённой программы через review и green exact-head protected PR.
Зависимый эпик начинается после реального merge и проверки main.
Production отдельно разрешается владельцем производного продукта.
