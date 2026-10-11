# Документы АМС Старт

**Статус:** Active. Нейтральный copy-source `template`, профиль `COMMERCIAL`.
Решение владельца и границы delivery: [ADR-015](adr/ADR-015-commercial-template-github-delivery.md).

## Единственный владелец каждой роли AMS v2.0

| Роль | Authoritative owner | Ответственность |
| --- | --- | --- |
| Навигатор | этот файл | порядок чтения, владельцы, допустимые расширения |
| Продуктовые требования | [01_PRD.md](01_PRD.md) | аудитория, scope, критерии повторного использования, REQ-ID |
| Страницы и сценарии | [02_PRODUCT_STRUCTURE.md](02_PRODUCT_STRUCTURE.md) | PAGE/FLOW-ID, маршруты, access/cache/index policy |
| Дизайн | [06_DESIGN_SYSTEM.md](06_DESIGN_SYSTEM.md) | общие токены, компоненты, responsive и accessibility |
| Техническая архитектура | [03_ARCHITECTURE.md](03_ARCHITECTURE.md) | границы модулей, профиль, policy, принятые ADR |
| Факты и контент | [01_PRD.md](01_PRD.md) — раздел «Факты и placeholders» | нейтральная demo-политика и обязательные inputs производного продукта |
| Приёмка | [05_RELEASE_CHECKLIST.md](05_RELEASE_CHECKLIST.md) | критерии технической готовности и условия релиза производного продукта |

`01_PRD.md`, `02_PRODUCT_STRUCTURE.md`, `03_ARCHITECTURE.md`,
`04_BACKLOG.md`, `05_RELEASE_CHECKLIST.md`, `06_DESIGN_SYSTEM.md` сохраняют
существующие имена. Факты объединены с PRD: у шаблона нет клиентского оффера,
цен, реквизитов или SEO-исследования. Отдельные пустые досье не создаются.
`04_BACKLOG.md` описывает границу развития базы, а не хранит текущие статусы задач.

## Порядок чтения и фактические источники

1. Этот индекс и нужные разделы PRD, структуры страниц и архитектуры.
2. Один применимый ADR или подробное расширение из таблицы ниже.
3. [04_BACKLOG.md](04_BACKLOG.md) и заявленная локальная задача, если выполняется изменение.
4. [package.json](../package.json), [lockfile](../pnpm-lock.yaml),
   [.node-version](../.node-version), [Prisma schema](../prisma/schema.prisma),
   [migrations](../prisma/migrations/) и конфигурация: факт реализации.
5. Проверка требования — соответствующий script и реальный результат для текущего SHA.

[Корневой README](../README.md) ведёт к запуску, [AGENTS.md](../AGENTS.md)
задаёт проектные инварианты. AMS Core и Skills остаются внешними общими правилами;
документы проекта не копируют их. Реализация находится в [src](../src/),
проверки — в [tests](../tests/) и [scripts](../scripts/).
`VERIFIED` означает подтверждённый источник/проверку, `REQUIRES CHECK` — неизвестное
поведение или факт, `HYPOTHESIS` — предположение, `TARGET` — требуемую будущую реализацию.
Присутствие файла или старый PASS не доказывают актуальную готовность.

## Допустимые подробные расширения

Расширение уточняет контракт владельца роли и не вводит второй источник истины.

| Путь | Роль / необходимость | Статус |
| --- | --- | --- |
| [AUTH.md](AUTH.md) | auth, provisioning и MFA внутри архитектурного контракта | Active extension |
| [DATA_MODEL.md](DATA_MODEL.md) | связи схемы и RLS coverage | Active extension |
| [SECURITY.md](SECURITY.md) | trust boundaries, PII и security proof | Active extension |
| [ENVIRONMENT.md](ENVIRONMENT.md) | value-free registry runtime/test/release переменных | Active extension |
| [DERIVATION.md](DERIVATION.md) | copy-source interface и автоматическая проверка identity | Active extension |
| [HANDOVER.md](HANDOVER.md) | guarantee-to-proof map и передача производному продукту; критерии приёмки принадлежат05 | Active extension |
| [RUNBOOK_DEPLOY.md](RUNBOOK_DEPLOY.md) | recipe immutable artifact, без разрешения production | Active extension |
| [ops/LOCAL_DEVELOPMENT.md](ops/LOCAL_DEVELOPMENT.md), [ops/RECOVERY.md](ops/RECOVERY.md) | локальные операции и guarded recovery recipes | Active extension |
| [EXTERNAL_SITE_DESIGN_SYSTEM.md](EXTERNAL_SITE_DESIGN_SYSTEM.md), [INTERNAL_DASHBOARD_DESIGN_SYSTEM.md](INTERNAL_DASHBOARD_DESIGN_SYSTEM.md) | public/private детали единой системы06 | Active extension |
| [adr/](adr/) | принятые проектные решения; исторические premises явно superseded | Accepted / historical context |
| [PRODUCT.md](PRODUCT.md), [ARCHITECTURE.md](ARCHITECTURE.md) | совместимые указатели на01/03, без дублирующих правил | SUPERSEDED pointers |

## История и граница копирования

Текущая очередь и evidence живут в локальном `backlog/`, PR и Git. Backlog,
временные планы, inventory программ, approval/review snapshots и логи запусков
не являются постоянной документацией и не должны попадать в производную копию.
Исходные предоставленные планы не переписываются. Исторические ADR сохраняют
ID и архитектурный смысл; [ADR-015](adr/ADR-015-commercial-template-github-delivery.md)
заменяет их EXPERIMENT/SourceCraft-primary и прежние merge premises.
Клиентские факты, домен, интеграции, юридические тексты, SEO и production
определяются в производном репозитории, без очистки наследованного task archive.
