# Клиентская граница смены credentials

PR #17 — техническая основа в одном JS-контексте приложения. PR #18 добавляет
verified-owner gate (см. ниже). Classification data hook и подключение реальной
классификации не реализованы.
Backend/JWT, формат `localStorage.token`, endpoint args/теги, денежные правила и
существующие маршруты не меняются. Session generation не является авторизацией,
идентификатором владельца, audit event или ревизией транзакции.

## Bounded design review

На baseline `be2c0e4c6902dd2f7e69fe17da509a72df444d59` credential записывался
в `AuthForm` после login, в том числе после signup → auto-login. Logout удалял
credential, посылал `LOGOUT` (полный root reset) и `resetApiState`. Bootstrap
`InitAuth` восстанавливал boolean; `UserProvider` читал `/users/me` и на его
401/403 выполнял logout. Других штатных переходов credentials в этих путях нет.

Просмотрен исходный код установленного RTK Query 2.8.2: cache keys сериализуют
endpoint/args, не заголовки. Query slice проверяет requestId перед записью ответа;
reset очищает cache и внутренние middleware subscriptions. Однако оставшийся
смонтированный React query-hook может обнаружить удалённую subscription и
подписаться заново. Кроме cache остаются async consumers и hook-local data.

Выбран небольшой ephemeral epoch и transport guard вместе с явным handoff в
существующем UserProvider. Reset без epoch не связывает async completion с
credentials. Session-specific keys потребовали бы менять getMe/финансовые args
и подписчиков; это более широкий вариант, в этом PR не используется.

## Lifecycle и handoff

- `sessionBoundary.ts` создаёт bootstrap generation 1 до первого защищённого
  запроса. StrictMode/ререндер не создают новую генерацию. Существующий `InitAuth`
  восстанавливает boolean без отдельного invalidate запроса `/me` при загрузке.
- Успешный login передаёт credential в closure thunk, не в новый Redux action
  payload. Начинается новая генерация даже при входе того же аккаунта.
  Logout также немедленно меняет generation. Ошибка login генерацию не меняет.
- Переход имеет фазу `transitioning`: transport не отправляет новые запросы,
  результат старого запроса больше не считается текущим. Existing UserProvider
  через `useSyncExternalStore` размонтирует прежнее дерево целиком.
- После passive unmount cleanup старых query-hooks effect внешнего UserProvider
  завершает handoff. Credentials новой сессии не устанавливаются до этого барьера.
  Старые running GET отменяются как дополнительная мера, root `LOGOUT` очищает
  Redux slices, а один `resetApiState` очищает middleware subscriptions/cache.
  Это разные необходимые части очистки, не два одинаковых reset.
- Только затем записывается новый credential и `setAuthenticated(true)`;
  новое дерево keyed по generation монтируется с пустым cache. Обычный успешный
  login и signup → auto-login по-прежнему ведут на `/expenses`. Auth loading не
  перенаправляет защищённый refresh на `/`; текущий 401/403 сохраняет logout.
- Новый переход отменяет ещё не завершённый предыдущий handoff. A → B → A не
  восстанавливает A cache. Старые signup/login callbacks проверяют generation:
  нельзя начать auto-login/записать token или навигировать из устаревшей попытки.
- Неудачный storage/handoff остаётся закрытым с безопасной ошибкой, а не ложным
  login. Автоматического recovery при недоступном browser storage здесь нет.

Обычная сетевая ошибка, например 503 `/me`, не инициирует этот переход, не удаляет
credential и не размонтирует финансовые формы. На смене credentials прежнее дерево
и его незавершённые формы теряются намеренно. Новый session provider/framework не
вводится: существующий UserProvider получил небольшую внешнюю границу.

## Transport и async consumers

`withSessionBoundary` захватывает generation и добавляет Authorization из текущего
credential непосредственно перед HTTP query. При settling сравнивает generation
и фазу. Устаревшие success/error возвращаются как
`{ error: { status: 'CUSTOM_ERROR', error: 'SESSION_CHANGED' } }` без старого data,
error body и Request/Response meta. Текущие результаты/errors возвращаются как
есть; auth mutations успевают вернуть необходимый login response перед переходом.
Не добавлены новые token-bearing actions, логи, URL-параметры или test snapshots.

UserProvider дополнительно проверяет generation перед effects setUser/logout:
так даже уже запланированный effect прежнего дерева не применится к новой сессии.
Наличие credential проверяется до обработки `/me`; отсутствие данных при loading
не считается logout. Тип User и проверка серверного `_id` намеренно не расширены.

Abort не является доказательством изоляции. Реальные RTK-тесты завершают старый
запрос позже перехода в обоих порядках A-first/B-first, принудительно заменяя abort
на no-op. Также проверяются cache/DOM, passive cleanup до первого B-запроса,
401/403, A/B/A, повторный login, reset, отменённый login и отсутствие GET на ререндер.
Transport тестируется отдельно от cancellation. Existing endpoint contract tests
остаются проверкой финансовых args/тегов, не реальной financial mutation.

Отмена GET или подавление результата не отменяют уже принятую сервером операцию.
Если financial mutation была отправлена до logout, этот механизм не обещает
server rollback или доказательство её завершения. Финансовые write endpoints и
их правила обработки в текущем поколении остаются прежними.

## Явные ограничения перед live review

1. **Cross-tab и внешняя запись token не реализованы.** Нет storage-event
   invalidation/координации нескольких вкладок. Смена localStorage вне штатных
   login/logout путей не получает этот handoff. Это блокирующий follow-up перед
   подключением live classification; тесты одного JS-контекста не доказывают иного.
2. PR #18 проверяет форму текущего `/users/me` для owner gate. Наличие credential
   и локальная generation сами по себе не доказывают владельца или право доступа.
   Backend ownership/JWT остаются отдельными гарантиями и здесь не тестируются live.
3. Работает существующее приложение с одним Redux store и UserProvider. Нельзя
   вызывать transition helpers вне этого handoff lifecycle и затем считать новый
   cache готовым. Долгоживущие imperative query handles не переносятся между сессиями;
   RTK query promises выбирают состояние по cache key, не являются owner capability.
4. Production browser acceptance и многовкладочные гонки не выполнены. Владелец
   не должен запускать frontend или присылать личные записи для этого PR. Проверки
   автоматические, с фиктивными credentials и полностью mocked transport.

## PR #18: read-only verified-owner gate

Публичный интерфейс `entities/User`: `useVerifiedOwner`, `validateVerifiedOwner`,
типы `VerifiedOwner`, `VerifiedOwnerState`, `VerifiedOwnerError`. Только состояние
`verified` содержит `owner: { userId, sessionGeneration }`; `unauthenticated`,
`verifying` и `verification_error` не содержат прежнего ID. Причины ошибок —
фиксированные коды, без payload, credentials, email или серверного error body.
Чистый validator проверяет форму, но сам не выполняет аутентификацию: потребители
текущего владельца должны читать hook внутри существующего `UserProvider`.

Проверка принимает только non-null object (не array) с собственным `_id`:
непустой string без whitespace, без coercion/trim и без требования ObjectId pattern.
Email не используется как ID и не получает новой политики валидации. Legacy
`setUser(data)` остаётся прежним: отсутствие `_id` блокирует новую capability,
но не отнимает email-профиль и не инициирует logout.

Контекст вычисляется в `CurrentSessionUser`, keyed существующей generation PR #17.
Нет второго счётчика, query endpoint/API slice или прямого fetch. Читается только
успешный `currentData` существующего getMe, когда запрос не fetching/loading,
не failed и generation актуальна. Любая revalidation немедленно скрывает ID;
transient failure оставляет credentials и legacy UI. 401/403 обрабатываются
прежним effect, `SESSION_CHANGED` не считается unauthorized.

При монтировании включён `refetchOnMountOrArgChange`: уже выполняющийся GET
разделяется через RTK; готовый cache не открывает gate до свежего ответа.
Первоначальный fulfilled requestId запоминается только для исключения этого cache,
не как server revision. Повторные renders не запускают GET. Первый проверенный ID
привязывается к keyed lifecycle; другой ID в той же generation даёт sticky
`identity_changed` до нового login. Проверка и блокировка происходят до commit,
а не effect, очищающим уже показанного владельца. Контекст/привязка существуют
только в React-памяти; новых storage writes, Redux actions с identity или логов нет.

Целевые автоматические тесты используют реальные reducers, middleware, getMe и
transport guard, mocked HTTP, deferred A/B completions и no-op abort. Проверяются
invalid payloads, cold/cache startup, общий GET, rerender, refetch/failure/recovery,
текущие и устаревшие 401/403, A/B/A, fresh same-owner login, logout и committed
frames. Старые UserProvider/AuthForm/session/navigation tests также выполняются.
Backend source ожидает документ со стандартным `_id`, но production payload
`/users/me` и реальная серверная авторизация остаются **UNVERIFIED**.
Cross-tab по-прежнему **блокирует live classification UI**. Этот gate не подключает
classification к транзакциям и не доказывает полную multi-user security.

## Откат

Откатывать boundary helper, wrapper, UserProvider и login/logout integration одним
изменением. Частичный откат только guard или только keyed handoff нарушит их общий
контракт. Это вернёт известное прежнее ограничение cache между credentials, поэтому
не включать будущий owner review на таком откате. Миграции/очистка финансовых данных
не нужны. Существующий RFC интеграции остаётся проектом, следующий PR не разрешён.

Gate PR #18 можно откатить отдельно: убрать новый контекст/validator/exports и
его интеграцию в UserProvider, сохранив целиком handoff/guard PR #17. Финансовые
данные и миграции отката не требуют.
