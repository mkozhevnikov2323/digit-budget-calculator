# Пользовательские группы v3 — frontend

## Активация и совместимость

Ветка предназначена для backend PR #45, merge `6c045704ac811d8c5e3853c290b36ef58632a88b`.
Полный серверный контракт: `digit-budget-calculator-api/docs/classification-groups-v3.md`.
Никаких backend изменений, миграционных CLI или обращений к пользовательской БД
в рамках frontend реализации не выполняется.

`VITE_CLASSIFICATION_GROUPS_V3_ENABLED` — compile-time opt-in. Только строка `true`
включает v3, остальные значения/отсутствие — false. Нет browser-storage overrides,
автоматического переключения после HTTP503 или записи при открытии страницы.
Vite использует прежнюю `VITE_API_URL`, JWT, verified owner и session boundary.
В E2E флаг задаётся исключительно тестовому Vite; пользовательские flags не меняются.

При false сохранены legacy правила, ручная/пакетная классификация, история,
статистика/прогноз/планирование и API. Новый profile link скрыт, прямой защищённый
URL `/profile/classification-groups` показывает сообщение без запросов/записей v3.

При true переключаются **вместе**: профиль, правила, ручная и пакетная
классификация, история и статистика. Custom group нигде не подставляется в layer
или economicRole. Предыдущие классификации читаются совместимым v3 GET/report.
Старый history/read используется существующим sourceEditApi только как адресный
источник фактов для прежних edit modal, никогда для интерпретации группы/status v3.

Прогноз/планирование по пяти фиксированным слоям явно заблокировано с пояснением:
данные v3 нельзя молча интерпретировать через legacy reader. Это осознанная граница
совместимости, разрешённая заданием; самостоятельная модель планирования custom
групп не вводилась. Общая финансовая аналитика и старый баланс не изменены.

## Пользовательские сценарии

- `/profile/classification-groups`: поиск, расходы/доходы, system/custom/status,
  create, rename, disable/enable, archive с отдельным подтверждением, restore,
  system name reset. Stable groupId, expectedRevision, без физического удаления.
- В управлении каталогом доступны поиск по всем загруженным группам и локальные страницы по25. В селекторе показываются до100 совпадений с явной подсказкой уточнить поиск; поиск охватывает весь каталог.
- Каталог загружается **весь**: cursor pages100 последовательно, проверка циклов,
  дубликатов и меняющихся definitions/initialized. Защитный потолок1000 страниц
  возвращает ошибку целого запроса, а не частичный каталог. GET не вызывает initialize.
- Неинициализированный каталог имеет отдельную явную кнопку POST initialize.
- `/profile/classification-rules`: category + optional title или income source,
  выбор любой активной группы, CRUD/enable/disable, expectedEtag и diagnostics.
  Legacy revision0 виден без автоматической конверсии, включая восемь seed rules.
  Архивные ссылки видны; правило можно отключить, удалить или перенаправить.
- `/analytics/classification`: один report для полного периода, 25 строк на странице,
  прежние status/dataset/URL paging, фильтр groupId, одно раскрытое Accordion.
  Раскрытие читает только выбранную операцию через v3 GET, показывает точные server
  facts, назначение/явный отказ/сброс — только по нажатию, один PUT.
  После валидированного подтверждения обновляется одна строка; остальных GET нет.
  При stale карточка не считается подтверждённой актуальной классификацией.
- Существующее редактирование source operation переиспользует прежний modal и PATCH.
  Успешный PATCH обновляет report через существующие Expense/Income tags; cancel
  не перечитывает весь период. URL/period/filter/page/scroll не заменяются новым
  navigation flow. Выход операции из периода обрабатывает новый report.
- `/analytics/history`: те же v3 факты и группы без редактора/записей.
- Batch: backend preview последовательно порциями≤100 identities, ни одного write.
  Каждое предложение проверяется против фактов/revision текущей строки и rule etag.
  Отображаются операция, правило, группа и диагностика пропусков. Отдельное
  подтверждение повторно читает весь каталог/правила и сверяет snapshot.
  Затем используется **общий существующий runCategoryBatch**, максимум3 worker,
  без retry. Изменение локального metadata snapshot, cancel, unmount/bfcache/session
  останавливают admissions; уже отправленные запросы могут иметь unknown outcome.
  Отмена работает и во время readonly metadata preflight.
- `/analytics/classification-stats`: summary-only report, проверенные серверные
  totals/groups/counts, `kopecks/signedKopecks`, archived/unclassified buckets.
  Нет собственного округления, исключения займов/переводов или новой формулы баланса.
  Последующее открытие статистики всегда получает свежий report.

## Контракты и безопасность

Все запросы используют существующие `/classification-groups` endpoints: catalog,
initialize, metadata CRUD, rules CRUD, operations GET/decision PUT/reconcile POST,
preview POST и report POST. Owner существует только в scope кэша и проверенной
сессии; в body/query как полномочие не отправляется.

DTO проверяются как закрытые plain-data объекты: version, обязательные поля,
identities/dataset, revision/etag, факты и binary64 roundtrip representation,
source fingerprint, group references/status, неатомарная consistency. Не вызываются
getters/toJSON/coercion hooks. Server facts сохраняются в intent без округления,
missing/null/empty comment различимы. Report проверяется на знаки, безопасные суммы,
полноту операций/групп и согласование totals; несовместимые ответы не становятся нулями.

Metadata unknown lock хранится в существующем session-keyed RTK mutation cache,
финансовый write risk — в прежнем AnalyticsUI механизме. Эти блокировки не обходятся
повторным открытием формы. Решения принимаются только после валидированного ответа,
optimistic updates отсутствуют. Смена credentials/generation отбрасывает поздние
успехи/ошибки; old-owner subtree и caches очищаются прежним UserProvider.

Неизвестный PUT не повторяется. В открытом редакторе доступен readonly reconcile
**того же** requestId/intent; только observed_matching с проверенной revision/state/
groupId/facts подтверждает результат. При потере локального intent остаётся явное
чтение состояния и отдельное новое решение пользователя. HTTP timeout не доказывает
отсутствие записи. Metadata неизвестный исход проверяется перечитыванием списка,
не автоматическим повтором mutation. Ошибки не закрывают форму и не стирают ввод.

## Ограничения

- Backend report: ≤366 суток, ≤50000 sources; полный operation payload≤1000 и общий
  ответ≤3.5MB. Workspace не показывает усечённую историю, предлагает сократить период
  либо открыть summary статистики. Summary не запрашивает operation payload.
- Standalone MongoDB наблюдения не являются транзакцией. Metadata preflight перед
  batch сужает окно, но внешнее изменение правила после проверки не образует серверную
  atomic rule-CAS с PUT. Сам PUT повторно проверяет source/group/revision. Для более
  сильной гарантии нужен отдельно согласованный backend protocol, здесь не добавлен.
- A→B→A и внешние изменения после последнего наблюдения не устанавливаются
  fingerprint. Неизвестные результаты требуют явного read/reconcile.
- Неподдерживаемая точность/overflow/readiness даёт недоступность, не округление/ноль.
- Отсутствующие, отключённые и архивные группы не предлагаются для нового назначения.
  Rename не меняет stable ID; исторические/архивные ссылки сохраняются.
- Новая инфраструктура черновиков и custom-group прогнозирования не вводилась.

## Безопасный будущий локальный запуск (только отдельным решением владельца)

1. Проверенный backup/restore, ревью и явная миграция backend по его документации.
   Этот frontend не выполняет миграцию и не создаёт серверные коллекции.
2. Совместимый backend с loopback HTTP bind, прежняя auth-конфигурация и проверенные
   flags READ/HISTORY/C_WRITE, плюс `CLASSIFICATION_GROUPS_ENABLED=1`.
3. Убедиться, что frontend `VITE_API_URL` указывает на согласованный локальный backend.
   Явно установить frontend flag для локальной сборки/запуска, например:

```sh
VITE_CLASSIFICATION_GROUPS_V3_ENABLED=true npm run dev
# Либо согласованная сборка:
VITE_CLASSIFICATION_GROUPS_V3_ENABLED=true npm run build
```

4. Войти владельцем, открыть профиль, явно инициализировать каталог. Проверить чтение
   старых классификаций и суммы, создать группу/правило, подтвердить одно назначение.
5. Только после проверки переходить к явному batch preview/confirmation.
   Не выключать v3 frontend после появления custom assignments без согласованного
   плана совместимости: старый reader закономерно не представляет новую taxonomy.

## Тесты и E2E

Новые Jest: закрытые DTO/полнота/знаки, pagination101+, session boundaries, CAS/
unknown, metadata CRUD и диагностика, manual read/PUT/reconcile, UI и batch201
(100+100+1), preflight invalidation/cancel. Старые batch tests проверяют общий runner:
3worker, cancel, late responses, shared risk. Legacy тесты сохранены.

Backend revision pinned в `e2e/backend-revision.json` на merge #45. E2E использует
существующий guarded browser fixture, отдельную test-owned MongoDB и synthetic
records. Frontend-only preload устанавливает reviewed manifests только в эту
одноразовую БД; migration CLI не вызывается. Все источники/коллекции cleanup/drop/
empty, HTTP/log/connection release проверяются прежним harness.

`npm run test:e2e` сохраняет обязательные14 legacy сценариев и прежний строгий count
check. `npm run test:e2e:groups` добавляет отдельно2 реальных v3 сценария и свой strict
count/cleanup report. P12 E2E/bench остаются прежними. CI требует все наборы без retry,
skips или ослабления прежних проверок. Секреты и raw Playwright errors не печатаются.
