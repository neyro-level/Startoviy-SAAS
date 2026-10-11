# Приёмка шаблона и производного продукта

**Статус:** Active. Authoritative acceptance/status contract.
**Applicability:** this starter itself is not a release target.
Ни один пункт ниже не отмечен заранее; evidence живёт в tracker/PR и относится
к exact SHA/артефакту. [HANDOVER](HANDOVER.md) даёт карту proof/передачи,
[RUNBOOK](RUNBOOK_DEPLOY.md) и [RECOVERY](ops/RECOVERY.md) — процедуры.

## Состояния готовности

| Статус | Необходимое фактическое подтверждение | Граница |
| --- | --- | --- |
| TECHNICAL_COMPLETE | весь утверждённый scope сверён с REQ/PAGE/FLOW; required local/native/browser/security checks и GitHub gate совпадают с final clean main SHA; нет незакрытых обязательных gaps | возможно для Starter; не означает production или готовность произвольной копии |
| DERIVATION_READY | neutral generator/copy interface, deterministic independent clean-room positive/negative proof, no identity/secrets/task-history residue и optional-disabled proof на том же принятом SHA | самостоятельная новая копия всё ещё определяет свой продукт |
| DERIVED_RELEASE_READY | продукт установил свой scope/профиль/permissions, verified facts/legal/media, own infra/secrets/database, immutable artifacts, recovery и rehearsal/live proof в разрешённом контуре | только производный продукт; не сам Starter |
| PUBLIC_RELEASE_READY | дополнительно подтверждены реальные public pages, consent/receiver и index/canonical/sitemap/content policy с разрешением публикации | канонический статус публичной готовности derived продукта, отдельно от technical complete |
| DEPLOYED | явная release authorization, фактический rollout принятого immutable artifact и live exact-SHA/health/smoke proof | в этой программе Starter никогда не деплоится |

Неприменимый пункт обосновывается scope производного продукта; неизвестные
данные, отсутствующий required test или TARGET implementation не получают PASS.
Статус Backlog Done не является статусом продукта или релиза.

## Техническая приёмка Starter

- [ ] Единственный владелец каждой роли канона, рабочие ссылки и полный REQ-01…18/PAGE-001…011/FLOW-001…006 map; targets честно отмечены и обязательные закрыты.
- [ ] Exact frozen Node/pnpm/dependencies, config/UI/architecture/type/lint/unit proof.
- [ ] Guarded PostgreSQL18 clean/repeated-reverse auth/RLS/command/outbox scenarios; cross-project/worker negative paths и актуальная coverage/evidence schema.
- [ ] Полный setup/login/TOTP/recovery, revoked/disabled session, organization/project scope; нет фиктивного успешного onboarding.
- [ ] Safe logs/errors/SecretRef, optional outbound SSRF/DNS/timeout и scoped storage; enabled/disabled paths без обязательного внешнего сервиса.
- [ ] PAGE/FLOW positive+negative browser proof;375/768/1024/1280/1440, keyboard/labels/contrast, loading/empty/error/denied states.
- [ ] Private noindex/no-store/SW bypass и authenticated logout/offline cache inspection; actual metadata/redirect behavior, demo public default не является разрешением индексации.
- [ ] Secret/Semgrep/dependency scans actual artifact; immutable runtime/worker/migrator and rollback/restore contracts проверены на disposable resources.
- [ ] Reviewed exact-head GitHub merge gate, strict required app/checks/protection, rejected stale/missing/failed evidence, protected merge and post-merge main SHA/check readback.
- [ ] Neutral derivation/pilot проходит frozen install/quick/unit/build и negative identity/legal/history fixtures; Backlog/master-plans/snapshots не наследуются.
- [ ] После завершения всей программы Starter возвращён в private по ADR-015, visibility/protection read back; shared Delivery Core остаётся private.

## Before a derived product may release

- [ ] Выбрать COMMERCIAL или CRITICAL; записать role/profile, собственные merge permissions и exact-head GitHub merge gate; настроить protected main и проверить actual provider API.
- [ ] Подтвердить свой PRD/PAGE/FLOW, real identity/origin/legal/media rights, consent/contact receiver и metadata/index policy. Fixture/nonempty value — не подтверждение реального факта.
- [ ] Run `pnpm derive:verify`, config/docs/quick и независимый clean-room smoke; migration ownership/optional modules явно selected.
- [ ] Создать product-owned Secret Master scope, отдельную database и approved runtime topology; no starter credentials/host/data inherited.
- [ ] Разделить web/worker non-owner NOBYPASSRLS, migrator DDL и backup identities; настроить connection budget, trusted proxy CIDRs и lawful data lifecycle.
- [ ] Build one immutable artifact set from reviewed clean canonical main: separate non-root web/worker/migrator images, lock checksum, exact digests and rollback unit; no build on production host.
- [ ] Описать/проверить backup integrity, disposable restore и data sanity, offsite/freshness при необходимости; application rollback не отменяет migration/data changes.
- [ ] Приобрести отдельное явное разрешение на staging/release/публикацию в контуре продукта. Merge Starter такой authority не даёт.

## Proof before rollout

- [ ] Relevant local tests и actual required exact-head checks успешны для принятого candidate; SHA changes invalidate earlier PASS.
- [ ] Migration plan and artifact inspection/scans, auth/RLS/worker/readiness proof applicable to chosen modules.
- [ ] Записаны source SHA/tree, artifact checksum/image digests, runtime version, timestamp и bounded blockers в product-owned evidence, без secrets/PII.
- [ ] Проведены разрешённые live probes `/api/health/live`, `/api/health/ready`, public/workspace/admin и полный flow;200 с login redirect не доказывает private admin smoke.
- [ ] Release/rollback artifact and actual runtime versions match; current main is not inferred from old branch verdicts.

## Rollback

- [ ] Сохранить failed evidence, остановить rollout при required failure.
- [ ] Использовать уже записанный prior immutable image set; fail closed on unknown/mismatched digest, не rebuild ad hoc.
- [ ] Отдельно подтвердить schema compatibility/data recovery plan; application rollback не делает implicit database restore.
- [ ] После разрешённого rollback повторить exact-SHA/health/worker/user-flow proof; restore/secret rotation только в product-owned recovery scope.
