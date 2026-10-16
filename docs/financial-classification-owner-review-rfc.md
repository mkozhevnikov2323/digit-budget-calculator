# RFC: подключение review классификации к операциям текущего владельца

Статус: **ПРЕДЛОЖЕНИЕ, требуется решение владельца**. Срез frontend:
`33e2fd38c40a1069476e19482864393b32586e3e`; backend:
`b6cafc9559608ec0592b64bcd11bc10eb17dab8a`.

Этот PR содержит только проект интеграции. Он не подключает реальные записи,
не утверждает продуктовую политику и не разрешает следующие реализации,
финансовые записи, хранение классификаций, изменение API/БД или deployment.
Слияние RFC также не заменяет отдельного одобрения реализации и её объёма.

## 1. Результат исследования и граница достоверности

**Рекомендация:** отдельная owner review-страница после согласования, один UTC-месяц,
существующие GET и RTK Query cache, checked snapshots из PR #14, resolver PR #12,
первоначально ручные решения по одной операции, только в памяти страницы.
Перед первым подключением обязателен небольшой проверяемый слой сессии:
подтверждённый `/users/me`, стабильный ID, локальная генерация сессии, очистка cache
и отбрасывание ответов прежних credentials. Одной обёртки `Protected` недостаточно.

«Подтверждено кодом» ниже означает прочитанные исходники указанных SHA.
Это не проверка опубликованного сервера. Работа production `/users/me`, фактические
права аккаунтов, содержимое истории, объём месяца, состояние MongoDB и поведение
реального браузера — **UNVERIFIED**. API/БД/аккаунты не открывались; Jest, lint,
build и миграции в рамках этого документа не запускались. Существующие тесты
прочитаны как описание ожидаемого поведения, не как новый результат проверки.

### 1.1. Проверенная текущая архитектура

| Наблюдение в исходниках | Следствие для будущего review |
| --- | --- |
| `InitAuth` выставляет boolean при наличии сохранённого credential; `Protected` проверяет только его наличие [F1] | Наличие token и `isAuthenticated` не доказывают текущего владельца или действительность сессии |
| `UserProvider` вызывает `getMe(undefined)`, при data делает `setUser`, на 401/403 выполняет logout и переход на `/` [F2] | При загрузке он не перенаправляет на `/expenses`; transient loading нельзя считать logout. Query и provider пока не публикуют проверенный session context |
| Оба frontend-типа User содержат только `email`; `getMe` принимает `void` [F2] | Стабильный `_id` не типизирован и не проверяется. Это не доказывает отсутствие `_id` в runtime payload: `setUser` не вырезает дополнительные поля |
| Login, в том числе после signup, сохраняет credential, выставляет boolean и ведёт на `/expenses`; отдельного reset cache перед новой сессией в `AuthForm` нет [F3] | Возврат к прежнему аккаунту или смена credentials требуют явного перехода сессии; не менять существующий целевой путь входа |
| Logout удаляет credential, посылает `LOGOUT`, затем `resetApiState`; root reducer на `LOGOUT` сбрасывает весь Redux state [F4] | Полезная существующая очистка. Её нельзя считать доказанной защитой от каждого позднего ответа, активной подписки или смены аккаунта без штатного logout |
| Общий `baseApi` добавляет Authorization в `prepareHeaders`; специальных owner/session args, serializer и обработки смены сессии нет [F5, F6] | Cache key финансовых GET зависит от endpoint/args, не от заголовка. `getMe(undefined)` тоже имеет общий ключ. Один `currentData` не изолирует владельцев |
| Store подключает `baseApi.middleware`; в просмотренных entry/provider нет `setupListeners` и обработчика `storage` [F4, F5] | Автоматические focus/reconnect и межвкладочная инвалидация сессии здесь не установлены. Не рассчитывать на них без реализации |
| Expenses/incomes endpoints поддерживают start/end и `noPagination`; имеют общие теги Expense/Income. Существующие mutations инвалидируют соответствующие теги и Balance [F6] | Два существующих GET пригодны; любое tag-driven обновление может затронуть только одну коллекцию. Review не вызывает mutations |
| `useFinancialAnalytics` берёт `currentData`, блокирует invalid period через `skipToken`, скрывает результат при любом fetching/error [F7] | Переиспользовать этот принцип, но не агрегаты: hook не возвращает оригинальные индивидуальные записи и не решает owner/session provenance |
| Phase 1 проверяет полноту metadata, IDs, даты, принадлежность периоду, numeric amounts, точность и overflow [F8] | Нельзя заменить checked facts сырым payload, округлением или собственным валидатором |
| Snapshot adapter повторно использует оба валидатора, сохраняет точную category provenance, требует owner-scoped `caller_local` descriptors [F9] | Контекст owner — входная согласованность, не авторизация. Adapter нельзя использовать с фиктивной серверной ревизией |
| Resolver учитывает owner/dataset/ID, снимок фактов, taxonomy, explicit unclassified и конфликты [F10] | Нет «первого» или «последнего» победителя при конфликте; нет вывода роли из названий |
| PR #15 использует синтетику через adapter, React key owner/session, локальный state, отдельные diagnostic candidates и sticky stale block [F11] | Это UX-образец, не готовая auth-граница. Synthetic sessionId, supplied decisions и demo wrapper нельзя передать на реальную страницу как доказательство review |
| `/analytics` защищён `Protected`, а desktop/mobile navigation используют общий список с «Аналитика» [F12] | Classification route/menu пока отсутствуют. Phase 1 отчёты остаются отдельными |
| Backend ставит auth middleware перед `/users/me`, `/expenses`, `/incomes`; JWT проходит verify [B1] | Авторизация принадлежит backend, а не ownerScope в браузере |
| `getUserInfo` ищет `_id: req.user._id` и отправляет Mongoose user; User имеет стандартный `_id`, password исключён по умолчанию [B1] | Исходники позволяют ожидать `_id` в GET без нового endpoint; явного DTO/проверенного production payload пока нет. Null/неверная форма должны закрывать review |
| Оба GET всегда начинают filter с `owner: req.user._id`, при start/end используют `$gte/$lte`, noPagination возвращает полный найденный массив и его count [B2] | Код подтверждает owner-scoped выборку. Это не runtime authorization acceptance и не атомарный снимок двух коллекций |
| У операций есть timestamps; update filters содержат owner и ID, без согласованного expected revision/CAS [B3] | Поля `updatedAt`/`__v` не становятся автоматически протоколом актуальности или аудитом классификаций |

Дополнительно просмотрена установленная реализация RTK Query:
`defaultSerializeQueryArgs` сериализует endpoint + args; defaults `keepUnusedDataFor=60`,
`refetchOnMountOrArgChange=false`, `refetchOnFocus=false`, `refetchOnReconnect=false`.
В проекте эти значения для рассматриваемых GET не переопределены [F5, F6].
Это клиентские defaults, не срок гарантированной актуальности записей.

## 2. Рекомендуемый поток данных — после отдельного APPROVAL

```text
существующая auth-инфраструктура
  -> VerifiedSession (status, userId, sessionEpoch; credentials остаются в auth)
  -> review gate + выбранный CalendarPeriod + поколение загрузки
  -> existing getExpenses / getIncomes с одинаковыми UTC args
  -> только currentData, привязанные к активным session/args/request round
  -> validateExpenseResponse + validateIncomeResponse
  -> явные caller_local descriptors по проверенным ID
  -> buildClassificationSnapshots (его проверки остаются обязательными)
  -> ephemeral owner review state -> resolveClassification -> UI
```

Ни один шаг не добавляет financial write, сохранение решения, category ID,
обязательство, резерв, сумму по слоям или изменение Phase 1 отчёта.
Прототип остаётся синтетическим; будущая production-композиция — отдельный модуль.
Не импортировать `ClassificationReviewPrototypeDemo`, synthetic fixtures или
`diagnosticDecisions` в owner-страницу. Презентационные части можно переиспользовать
только в явно согласованном небольшом PR без переноса synthetic identity policy.

Предлагаемая граница hook: `useOwnerClassificationData(period: CalendarPeriod | null)`.
VerifiedSession он читает из provider, без публичного аргумента ownerScope.
Возвращается discriminated union blocked/loading/fetching/error/ready; только ready
содержит snapshots и context `(userId, sessionEpoch, periodKey, loadGeneration)`.
Остальные состояния не несут прежних записей/решений. Parent монтирует дерево drafts
с key полного context; при его смене старое дерево недоступно до commit, без
отложенного эффекта очистки. Обработчик review перед применением сверяет захваченный
context с активным: запоздалый клик прежнего поколения не создаёт новое решение.
Это проект клиентского интерфейса hook, а не изменение contracts PR #12/14.

### 2.1. Auth/session boundary: обязательный предварительный контракт

Предлагаемый frontend-контекст содержит `status`, проверенный `userId`,
`sessionEpoch`; credential в него не входит. Статусы: restoring/validating,
authenticated, unauthenticated и verification_error. Это проект типов, не новый API.

1. Получать owner ID только из успешного актуального `/users/me` для текущего
   credential epoch. Типизировать и runtime-проверять непустой `_id` и ожидаемую
   форму User; null/неверный payload закрывает review с verification_error.
   Не брать owner из email, URL, JWT decode, transaction content или произвольных props.
2. `ownerScope = verifiedUserId` служит связкой локальных данных. Backend продолжает
   использовать только `req.user._id`; ownerScope не посылается как фильтр прав.
3. `sessionEpoch` — локальная неперсистентная генерация жизненного цикла credentials,
   даже для повторного входа того же userId. Это не token/hash, не авторизация и
   не operation revision. Нельзя хранить её вместе с drafts между перезапусками.
4. На bootstrap или смену credentials сначала закрыть review gate. Старые строки,
   решения, selected operation и ручная форма не должны попадать в DOM даже на
   один committed render. Одного `useEffect` с последующей очисткой недостаточно.
5. Logout, новый login/auto-login, подтверждённая invalidation и изменение credentials
   в другой вкладке проходят общий переход: немедленная смена epoch/закрытие gate,
   discard drafts, снятие старых subscriptions, отмена доступных старых запросов,
   reset private cache и очистка User, затем проверка нового `/users/me`.
   Зафиксировать барьер снятия subscriptions: последовательность dispatch сама
   по себе не доказывает React unmount и не должна запускать refetch от старой подписки.
6. Старый `getMe(undefined)` cache нельзя принять как нового пользователя. Проверка
   новой сессии должна быть свежим запросом после cache reset; её успешный request
   явно относится к текущему epoch. До этого финансовые review queries получают skip.
7. Сохранить нынешнюю семантику: loading/сетевой сбой не равны подтверждённому logout.
   При transient revalidation скрыть/заблокировать review и сбросить его drafts,
   но не редиректить пользователя лишь из-за отсутствующего ещё ответа. 401/403
   от актуального защищённого запроса запускает штатный logout; старый ответ прежней
   сессии не должен разлогинить уже новую. Не менять post-login `/expenses`.
8. После открытия нового gate React subtree keyed по `(userId, sessionEpoch)` всегда
   новый. A → B → A и тот же userId с новым login не восстанавливают drafts.
   Смена страниц/периода имеет отдельную, ещё более короткую границу [§4].

**Недостающая сейчас гарантия:** сохранённый query result должен относиться к
credentials, с которыми он отправлен. Рекомендуемый минимальный transport safeguard
в будущем auth PR: общий request wrapper фиксирует epoch при добавлении Authorization
и перед передачей результата RTK сравнивает его с активным epoch. Ответ прежнего
epoch превращается в безопасный клиентский отказ без payload; данные старого owner
не должны заново заполнить общий cache после reset. Для gate/pair доступны только
нечувствительные epoch/request metadata, без token, email и raw payload.
Устаревшие завершения login/getMe также нельзя применять к новой сессии.

Эту привязку, reset и подписки нужно проверить совместно на установленной версии RTK.
Abort — вспомогательная мера: сервер мог уже ответить; abort не заменяет проверку
epoch. Если общий cache нельзя безопасно очистить/оградить без большой переделки,
не подключать review: отдельно согласовать client-only session partition в query
keys. Не добавлять owner в URL и не считать раздельные keys backend-авторизацией.

Это ограниченное, но чувствительное изменение auth/session lifecycle, затрагивающее
общий transport. Его объём и регрессионные риски требуют отдельного одобрения;
данный RFC не разрешает менять authentication architecture. Не менять механизм
JWT, способ хранения существующих credentials или server API под видом review.

### 2.2. Cache reuse против отдельного hook

| Вариант | Выгода | Ограничение / решение |
| --- | --- | --- |
| Читать существующие агрегаты `useFinancialAnalytics` | Уже есть loading/error и UTC | Потеря индивидуальных записей и исходной category provenance; для snapshot adapter не подходит |
| Использовать прежние cache entries напрямую | Минимум GET | Без session provenance можно отобразить другого owner; без round нельзя подтвердить совместную готовность |
| Отдельный `useOwnerClassificationData`, оркестрирующий существующие endpoints | Изолированные gate, round, validation и ошибки при общем cache | **Рекомендуется** после §2.1. «Отдельный hook» не означает отдельный createApi, transport или cache |
| Новые endpoints/client/API slice для тех же GET | Независимый lifecycle | Дублирование запросов/тегов и новые места очистки. Не рекомендуются для первого варианта |

Использовать точно args `toAnalyticsQueryParams(period)`: `startDate`, `endDate`,
`noPagination: true`. Без year/month, pagination, category/source/text filters и
`_summary`. Разные endpoint names (например monthly summary) не объединяются
cache только из-за одинакового URL. Не читать Redux list slices, текущую страницу
таблицы или CSV как полную историю.

Один hook-владелец подписок на страницу, его ready-модель передавать дочерним
компонентам. Одинаковые endpoint + canonical args в одной подтверждённой сессии
используют общий RTK cache и разделяют in-flight GET; object reference args не
является cache key. Ререндер, смена выбранной строки, manual click и reset не
вызывают GET. Не добавлять параллельно lazy query, прямой fetch или вызов analytics
hook ради тех же данных. Тест [T2] описывает reuse cache, но не авторизацию.

Для первого открытия review и возврата в него нужна свежая пара: явный
`refetchOnMountOrArgChange: true` в одном review hook либо эквивалентный один
coordinator, но не оба. Уже выполняющийся GET того же session/args можно разделить;
старый fulfilled cache сам по себе не даёт интерактивный ready. Уточнить и проверить
на RTK тестом фактическую дедупликацию. Дополнительная свежая пара при входе —
сознательная цена актуальности, не запрос на каждый render.

### 2.3. Период, completeness и подготовка snapshots

Первый продуктовый вариант: ровно один выбранный календарный месяц UTC, начальный
выбор — текущий UTC-месяц с видимой подписью UTC. Другой месяц задаётся явно.
Это ограничение интерфейса, не новая календарная политика. Не брать timezone из
локали, IP или часового пояса браузера/владельца. Произвольный диапазон — отдельное
решение; денежная/календарная политика Phase 1 не меняется [F8].

`CalendarPeriod` хранит `[startInclusive, endExclusive)`. Текущий adapter GET переводит
верхнюю границу в inclusive `endExclusive - 1ms`; исходные timestamps не сдвигаются.
Оба запроса используют одну и ту же пару границ. Не подменять это backend-фильтрами
year/month, которые строят server-local даты [B2]. Невалидный/незавершённый выбор
закрывает ready и даёт `skipToken`; быстрые изменения не показывают предыдущий период.

Алгоритм одной принятой загрузки:

1. Зафиксировать `(sessionEpoch, ownerId, canonicalArgs, loadGeneration)` и ожидаемые
   request IDs обоих GET. Это идентичность клиентской загрузки, не версия БД.
2. Ждать оба current-argument ответа активного round: ни один не loading/fetching,
   оба без ошибки, оба относятся к текущей сессии и не были заменены новым round.
   `data` старого аргумента, результат старого request и одиночный успех не подходят.
3. Вызвать оба существующих Phase 1 response validators на исходных полных ответах.
   При ошибке не создавать descriptors из оставшихся raw IDs и не отдавать subset.
4. Для проверенных ID создать явные `LocalSnapshotRevision` с owner/dataset/ID,
   `kind: 'caller_local'` и токеном текущего локального поколения review. Он меняется
   при инвалидации обзора, не вычисляется из времени, ID, индекса, порядка ответов,
   `updatedAt` или предполагаемого `__v`. Один generation token допустим у нескольких
   записей: identity всё равно включает owner/dataset/ID. Не называть его backend version.
5. Передать исходные ответы, период, verified owner и descriptors в
   `buildClassificationSnapshots`. Adapter сохраняет собственную повторную проверку
   обоих наборов. Небольшая повторная CPU-валидация безопаснее обхода его контракта;
   это не дополнительный GET. Оптимизация только после измерения, отдельным PR.
6. Только полный success открывает ready UI. Empty arrays обоих наборов — валидное
   пустое состояние. Ошибка/неполнота одного запрещает публикацию обоих массивов.

Копейки и timestamp поступают только из валидаторов; `1.005`, отрицательные/неверные
суммы, дубликаты ID, невалидные/внепериодные даты и overflow не округляются и не
пропускаются. Доходы и расходы с одинаковым ID остаются разными операциями.
SourceCategory сохраняет missing/null как absent, все строки буквально; empty,
пробелы и `Без категории` не отождествляются. Income source остаётся исходным.
Ни имя, ни совпадение словарей не доказывают category FK [F9].

Месяц ограничивает даты, но не число записей. Лимит безопасного объёма ещё открыт:
при превышении согласованного бюджета памяти/времени закрыть review и объяснить
ограничение, не обрезать массив как «полный». Согласовать порог до первого выпуска.
Metadata полноты не доказывает отсутствие согласованной ошибки сервера; два GET
не атомарны относительно чужого concurrent write. Никакого «среза банка на момент T».

## 3. Протокол refetch и готовности данных

Любое обнаруженное обновление одного набора немедленно инвалидирует общий ready,
все временные решения и незавершённый ручной выбор — ещё до показа обновлённых строк.
Не ориентироваться только на `data === previousData`: RTK structural sharing может
оставить прежний объект даже после нового ответа. Отслеживать переходы pending,
request identity/fulfillment и явные события coordinator; это клиентские сигналы,
не authoritative revisions. Счётчик потерянных drafts может остаться без их payload.

Один refresh coordinator на страницу объединяет одновременные причины обновления:
ручная кнопка, invalidation тегов, возврат focus/online. Если обновляется только
Expense или Income, запросить недостающий counterpart ровно один раз, не повторять
уже pending запрос и не запускать циклический refetch из каждого data-effect.
Ready разрешён лишь после свежего завершения обоих участников актуального round.
Новый trigger во время round закрывает его публикацию; следующий coalesced round
стартует после завершения/отмены старого. Старый успех не открывает новый ready.

Не включать polling в первой версии. Focus/reconnect в текущем приложении не
настроены: в будущем review hook нужен согласованный локальный listener, вызывающий
один парный refresh; не обещать автообновление от одних RTK options без listener.
Отдельно проверить pagehide/pageshow и back-forward cache: уход скрывает review и
теряет drafts, возврат требует проверки session и свежей пары. Не сохранять состояние
в browser history. Расширение общей `setupListeners`-политики — отдельное решение.

При смене args снять старые review subscriptions; не abort-ить запрос того же
владельца, которым пользуется другой компонент. Поздний результат прежнего месяца
может остаться только в разрешённом cache той же сессии, но не участвует в новом UI.
На смене credentials применяется общий барьер §2.1, а не только currentData.
Network failure не превращается в пустую историю; retry явный, новый round для пары,
без бесконечного автоматического цикла и без восстановления прежних решений.

## 4. Ревизии, устаревание и жизненный цикл drafts

| Подход | Что сохраняет | Ограничения / вывод |
| --- | --- | --- |
| Сбрасывать все решения на любом refresh/смене контекста | Только текущий непрерывный просмотр принятой полной пары | **Самый безопасный первый вариант.** Теряется работа даже при одинаковом ответе; объяснить до первого действия |
| Сохранять решения при равенстве только минимальных facts | Часть локальных действий | Не замечает title/comment/recipient и иных review-relevant изменений. Не рекомендуется |
| Сохранять при полной проверенной семантике и trustworthy revision | Потенциально меньше повторного review | Требует согласованного покрытия фактов, правил сравнения и серверного revision protocol; сейчас такой гарантии нет |

Первый вариант не сравнивает payload ради сохранения решения. Он сбрасывает всё
на известной границе замены набора, даже если изменён только comment или порядок
записей. Resolver остаётся вторым барьером для changed included facts/revision,
конфликтов, taxonomy и scope, а не детектором всех изменений в базе.

| Событие | Предлагаемое поведение |
| --- | --- |
| Первичная загрузка | Нет решений; до полной актуальной пары только loading/error, без старых строк |
| Клик принятия/ручного выбора | Решение только для одной exact checked operation, текущих owner/session/round; явный local статус |
| Открытая ручная форма | Выбор ещё не решение; cancel не меняет прежнее назначение. Любая инвалидация удаляет pending selection |
| Background refetch, даже с одинаковыми фактами | Скрыть результаты, потерять все drafts, загрузить согласованную пару; после success предложить новый review |
| Изменение amount/date/category/source или ревизии в текущем снимке | Resolver stale error; старое подтверждение не показывать. Возврат прежних фактов сам ничего не восстанавливает |
| Изменение title/comment/recipient/других деталей | Известная замена ответа инвалидирует всё независимо от минимальных facts. Незагруженное серверное изменение неизвестно |
| Другой месяц / быстрые переключения A → B → A | Новый round и пустое состояние; старые ответы/решения не применяются по возвращении |
| Навигация со страницы review | Unmount теряет drafts; новый вход требует свежей пары. Не поднимать их в общий Redux/provider/cache |
| Logout, login, account/token change | Немедленный discard и session boundary; тот же owner не означает ту же сессию |
| Transient auth revalidation / сетевой сбой `/me` | Закрыть gate, потерять drafts; ожидание/ошибка без ложного logout и без показа непроверенного owner |
| Unexpected response replacement / `upsertQueryData` / неизвестный request | Инвалидация и новая полная пара; нельзя просто заново пометить заменённые данные как готовые |
| Ошибка одного GET или incomplete metadata | Нет ready/частичных snapshots. Безопасное сообщение; retry новой пары, прежние решения не возвращаются |
| Refresh, закрытие вкладки, pagehide/bfcache | Drafts не восстанавливаются; bootstrap/revalidation и новый review. Browser storage не используется |
| Concurrent write с другого устройства | До наблюдаемого refetch может остаться неизвестным; при обнаружении discard. Никакой гарантии глобальной актуальности в интервале между GET |
| Изменение taxonomy / набора явных suggestions | Новый контекст review и discard; не переписать молча ранее выбранный смысл |

Не придумывать approval audit event, серверную дату review, долговечный ID решения
или наличие платежа из local state. `updatedAt`, Mongoose `__v`, requestId и время
успешного GET не доказывают отсутствие конкурентного изменения; conditional write
и согласованный backend revision отсутствуют [B3]. Без них нельзя гарантировать
актуальность между чтением и кликом, атомарность двух GET, историю подтверждений,
согласованность нескольких устройств или надёжное сохранение. Первый UI лишь
описывает временную интерпретацию просмотренной версии данных.

## 5. Предложение UX и решения владельца

Постоянный текст до первого действия: «Классификация временная и существует только
на этой странице. Она не сохраняется на сервере, не изменяет операции, не переводит
и не резервирует деньги. При обновлении данных, смене периода, уходе или выходе
решения будут потеряны». После действия: «Решение применено только к текущему
временному просмотру». Не использовать «Сохранено», «Оплачено» или «Средства доступны».
Синтетическую маркировку нельзя оставить на реальной owner-странице: её тексты
и точка входа требуют отдельного review, а demo остаётся отключённым.

Loading/fetching, неполнота, validation error, session verification error и valid
empty должны иметь разные тексты. Ошибка содержит понятную причину без payload,
персональных меток, stack trace или credential; технические codes допустимы отдельно.
Unclassified — видимая запись без подтверждённого назначения, а не пропущенная строка.
По слоям ничего не суммируется и не передаётся в AnalyticsPage.

Все строки следующей таблицы **OPEN**; рекомендация не является решением владельца.

| № / вопрос | Рекомендуемый первый вариант | Альтернатива | Последствия и риск |
| --- | --- | --- | --- |
| 1. Пять слоёв: финальные или provisional | Сохранить provisional названия/коды и заметную маркировку; отдельно утвердить границы | Финальная таксономия либо иные границы/разделение операции | Нельзя обещать окончательные отчёты по слоям; смена semantics требует версии, не переименования истории |
| 2. Роли и займы | Только dataset-compatible явные варианты текущего контракта; loan issuance/repayment, refund, transfer/capital отдельно, layer null | Расширенный долговой/account ledger | Метка «Выдача займа» не утверждает роль. Капитал не ordinary spending; raw Phase 1 totals не меняются |
| 3. Одна операция или batch | По одной, прямое действие и exact snapshot | Batch после отдельных правил области и подтверждения | Batch повышает риск случайного подтверждения и требует списка затронутых операций |
| 4. Первый диапазон | Один выбранный UTC-месяц | Произвольный ограниченный период | Месяц проще по памяти/UX, но не гарантирует малый count. Любой расширенный диапазон требует согласованного лимита |
| 5. Suggestions или manual-only | Manual-only, `suggestions: []` | Явно созданные owner-local подсказки по выбранной исходной метке | Нет догадок по словарю/частоте. Подсказка не равна approved; будущая область правила отдельно подтверждается |
| 6. Неоднозначность имён категории | По умолчанию unresolved, явное ambiguous как отдельное evidence; без FK | Проверенный provenance adapter словарей после согласования | Совпавшие system/custom названия нельзя превратить в один category ID; даже label-rule действует только на явно подтверждённую строку |
| 7. Сохранение при смене периода | Не сохранять | Session-local map по периодам | Map увеличивает риск stale/возврата забытых решений; в первой версии исключён |
| 8. Сохранение при навигации внутри приложения | Не сохранять; state принадлежит странице | Общий in-memory workspace | Workspace требует отдельной политики unmount, owner isolation и фоновой инвалидизации |
| 9. Browser refresh | Полная потеря и новая проверка | Сохранение черновика в storage | Storage — новая persistence-семантика и риск чужого сеанса; здесь не одобряется |
| 10. Предупреждение о потере | Постоянный текст; при добровольных period/navigation/refresh с drafts — «Остаться» / «Отбросить» | Только постоянный текст либо browser unload prompt | Auth/logout/invalidation нельзя задерживать подтверждением. beforeunload лишь best effort, без личных данных в тексте |
| 11. Видимость stale/incomplete | Убрать назначения и ready-строки, явно сообщить причину, предложить безопасный retry | Показывать старый read-only snapshot с меткой | Риск принять старое за актуальное выше; первое внедрение блокирует review полностью |
| 12. Видимость unclassified | Показать все записи периода, статус unknown/explicit unclassified различать | Скрываемые исключения или отдельный фильтр | Нельзя представить только классифицированную часть как всю историю; сортировка/фильтр не меняют полноту исходного checked dataset |

Отдельно согласовать подтверждение добровольного discard до запуска запроса;
при отмене остаются прежний период и текущий round. Непредвиденное refetch уже
инвалидировало данные: вместо вопроса показать факт сброса без личного содержимого.
Плановые суммы, progress резервов и банковская ликвидность за рамками UI.

## 6. Небольшая дорожная карта после одобрения

Ни один PR ниже не начинается автоматически. Вероятные новые пути — проект,
не уже существующие файлы. Каждый шаг отдельно согласуется; auth-safety gate
нельзя пропустить ради быстрого монтажа прототипа.

### PR-I1. Проверенная сессия и read-only получение checked snapshots

- **Scope:** типизированный/проверенный current user, session transition boundary и
  защита поздних ответов §2.1; затем isolated data hook §2–3 без маршрута, review
  действий или реальных UI-подключений. Если auth-предпосылка не укладывается в
  небольшой reviewable diff, остановить этот шаг и отдельно согласовать её разбиение.
- **Вероятные файлы:** `entities/User/api/userApi.ts`, `entities/User/model/userSlice.ts`,
  `entities/User/ui/UserProvider.tsx`, `features/Authorization/model/authThunks.ts`,
  `features/Authorization/ui/AuthForm.tsx`, `shared/api/baseApi.ts`,
  новый `app/providers/session/VerifiedSessionProvider.tsx` и подключение в
  `app/providers/AppProviders.tsx`; новый
  `features/FinancialClassification/model/useOwnerClassificationData.ts` и tests.
  Только необходимые изменения selectors/context; resolver/adapter не переписывать.
- **Tests:** bootstrap slow `/me`, 401/403 и transient error без ложного redirect;
  тот же owner с новым login, A/B и A/B/A, old `/me`/GET после reset/смены credential,
  active subscriptions, startup without stable ID, DOM commit isolation;
  GET reuse, precise UTC args, no writes, currentData, разные request timings,
  rapid months, incomplete/invalid money/date, counterpart refresh и identical payload.
  Mocked клиентские A/B тесты проверяют клиентский барьер, не server authorization.
- **Auth safeguard:** no ready до актуального verified ID/epoch; cache reset и
  transport suppression не допускают data старого epoch. Review не читает credentials.
- **Dates/precision:** существующие period/GET adapter и validators; checked facts
  без округления; raw categories только через snapshot adapter, revision caller_local.
- **Cache/refetch:** существующий baseApi/endpoints, один coordinator, свежая пара
  на вход/возврат, shared in-flight, ни одного GET на action/rerender.
- **Rollback:** не монтировать потребителя, убрать новый read-only hook; auth/session
  изменения откатывать отдельно с проверкой прежних login/refresh/logout, а не
  отключать защиту при включённом review. Финансовая история не мигрирует.
- **API/DB:** existing GET и существующие auth endpoints, без нового endpoint/schema,
  финансовых mutation или classification persistence. `_id` contract подтверждается
  исходниками; если deployment не отдаёт его, stop и отдельное согласование API.
- **Acceptance:** все session/query invariants воспроизводимы в целевых тестах,
  нулевой показ прежнего owner, read-only ready только полной текущей пары;
  архитектурный/security review auth boundary обязателен. Hook ещё не виден владельцу.

Реальная owner-scoped авторизация должна иметь отдельное backend-подтверждение
перед открытием owner-страницы: тест настоящих auth middleware/controller/выборок
в разрешённой изолированной test-инфраструктуре с ephemeral test users и без
production. Проверить запрос без/с неверной авторизацией и отсутствие записей B
в результате A. Synthetic demo fixtures, mock headers или сравнение email в UI
не доказывают это. Такие проверки сейчас не выполнялись; разрешение на их запуск
и инфраструктуру запрашивается отдельно, реальные пользовательские записи не нужны.

### PR-I2. Owner review UI только с временными решениями

- **Scope:** новая защищённая страница с контекстом PR-I1, один month selector,
  одна операция за действие, manual-only defaults, explicit unclassified/reset/cancel,
  discard notices и lifecycle §4. Только после решений таблицы §5 и auth acceptance.
- **Вероятные файлы:** новые `pages/ClassificationReviewPage/` и
  `features/FinancialClassification/ui/OwnerClassificationReview.tsx`, целевые tests;
  согласованные изменения `app/providers/router/routeConfig.tsx` и
  `widgets/MobileMenu/model/navItems.ts`. При необходимости небольшой выделенный
  presenter из PR #15; demo/diagnostic inputs не подключать к live composition.
- **Tests:** реальные resolver/adapter на фиктивных checked данных плюс отдельные
  тесты auth gate; no auto approval, совместимые роли, отсутствие слоя у non-spending,
  dataset+ID, stale/round/owner reset без промежуточного DOM, keyboard/mobile structure,
  запрет Storage/IndexedDB/network mutations и возвращения discarded drafts.
- **Auth safeguard:** route `Protected` плюс VerifiedSession gate; входящий arbitrary
  owner prop невозможен в production composition; denied session закрывает UI немедленно.
- **Dates/precision:** PR-I1 snapshot результата текущего UTC-месяца, existing formatter,
  invalid formatting блокирует действие, не заменяется нулём. Phase 1 не затрагивается.
- **Cache/refetch:** только hook PR-I1; actions меняют локальный state без GET/write;
  любая инвалидация сбрасывает весь review generation, уход размонтирует state.
- **Rollback:** удалить точку входа/route и отключить страницу; потерять только
  заявленные временные drafts. Не нужно удалять/восстанавливать финансовые записи.
- **API/DB:** новых операций нет, классификации не сохраняются, схема не меняется.
- **Acceptance:** выполнены privacy-safe manual checks §7 и целевые тесты; нет хранения,
  live mutations, изменения существующих отчётов или ложного сообщения о сохранении.

### PR-I3. Отдельный RFC постоянного хранения, не CRUD-реализация

- **Scope:** только архитектура persistent classification после новой заявки владельца:
  owner authorization, authoritative revision/CAS, review provenance, audit/retention,
  idempotency, удаления/редактирования исходных записей и перенос временных решений
  только после повторной проверки. Не брать browser storage как обход gate.
- **Вероятный файл:** новый `docs/financial-classification-persistence-rfc.md`;
  реальные endpoint/model/index пути выбираются лишь после утверждения схемы.
- **Tests:** на стадии RFC только описание сценариев, включая cross-owner access,
  повтор запроса, concurrent update, stale approval и rollback; код tests не добавлять.
- **Auth/date/precision:** server owner из verified JWT, immutable checked факты и
  прежняя monetary/UTC policy; любое отклонение требует отдельного решения.
- **Cache/refetch:** определить контракт invalidation/version и границу atomicity
  до реализации. До этого PR-I2 остаётся временным и сбрасываемым.
- **Rollback:** отклонить RFC без изменения runtime/данных. Миграция и внедрение
  persistence не являются частью этого шага.
- **API/DB:** на стадии дизайна нулевой impact; будущие changes требуют отдельного
  разрешения с конкретными контрактами, индексами и планом безопасного отката.
- **Acceptance:** владелец и технический review явно утвердили scope и открытые
  вопросы; одобрение дизайна не запускает write/migration/deploy автоматически.

## 7. Будущая ручная приёмка без изменения финансовой истории

Процедура предназначена для будущего согласованного внедрения, сейчас **не выполнена**.
Владелец выполняет её самостоятельно в доверенном браузере. Не передавать агенту
login/password, token, cookies, HAR, response bodies, скриншоты операций или экспорт.
Отчёт — только PASS/FAIL/UNVERIFIED по пунктам без сумм, имён и ID.

Использовать только уже существующие записи своего аккаунта или пустой месяц.
Не создавать/редактировать/удалять операции, дополнительные реальные аккаунты и
не менять реальные платежи для воспроизведения stale. Если нужного состояния нет,
пометить UNVERIFIED; malformed payload/конкурентные изменения проверяются отдельно
на разрешённых фикстурах, не вмешательством в production ответы браузера.

| Проверка | Ожидаемый результат |
| --- | --- |
| Desktop и узкий mobile, клавиатура | Читаемые ID/type/source/amount/state без горизонтального выдавливания; доступные заголовки, labels, focus, cancel/reset; постоянное предупреждение видно |
| Открытие после login и reload защищённого URL | До `/me` и полной пары loading без чужих/старых строк; loading не уводит на `/`; после успешного login остаётся обычный `/expenses`, review открывается явно |
| Пустой существующий месяц | Явное «операций нет», не ошибка сети и не «все классифицированы» |
| Одно временное ручное решение, cancel/reset | Прямой клик обязателен; cancel не меняет прежнее решение; reset возвращает unresolved; нигде нет утверждения о серверном сохранении |
| Доход/расход и займы, если уже есть | Разные типы/ID identity; никаких выводов роли из имени; non-spending без слоя, unclassified видимы. Отсутствующие варианты — UNVERIFIED |
| Переход месяца и быстрый A → B → A | При drafts действует согласованное предупреждение; после discard нет старых решений, смешанных строк и готовности от позднего ответа |
| Уход на другую страницу и возврат | Решения потеряны согласно тексту; новая пара загружается, история A не восстанавливается |
| Обновление страницы, back/forward и возврат focus | Нет тихого восстановления drafts; session проверяется, данные обновляются по согласованной политике |
| Кнопка обновления / естественный refetch | Старые назначения сразу скрыты и сброшены, даже при одинаковых операциях. Новая готовность только обоих GET; UI объясняет потерю работы |
| Offline средствами браузера, затем retry | Явная ошибка/ожидание без частичных данных, нулей и старого approved; retry не возвращает drafts. Не открывать и не экспортировать response payload |
| Logout и новый login того же владельца | Logout не блокируется сохранением drafts; после login новое поколение без прежних решений. Весь переход без промежуточного старого approval |
| Другая вкладка со штатным logout, если доступно | Review закрывается при смене credentials; возврат требует новой проверки. Если межвкладочная защита ещё не реализована — FAIL перед live-подключением |
| Истёкшая/отозванная сессия, если естественно возникла | Подтверждённый auth отказ закрывает данные; обычный timeout не выдаётся за logout. Не извлекать и не подменять реальные tokens для теста |
| Stale после другого устройства, если естественно наблюдался | При следующем refetch решения сброшены; до него UI не обещает глобальную актуальность. Не редактировать финансовые записи ради проверки |

Этот checklist проверяет UX своего аккаунта и не является cross-owner penetration
test. Подтверждение серверной авторизации — отдельное инженерное gate PR-I1,
не просьба владельцу открыть/поделиться чужой историей.

## 8. Нерешённые вопросы и условия остановки

1. APPROVAL всех 12 продуктовых строк §5, отдельно предел объёма месяца и правила
   добровольного discard. Что считать review-relevant facts кроме минимального snapshot?
2. APPROVAL точного небольшого auth/session changeset, request-epoch suppression,
   межвкладочного поведения и browser lifecycle. Не подключать review до доказанного
   отсутствия cache reuse между credentials; при большой переделке вернуться к review.
3. Production-форма `/users/me` и неизменность server owner-scoped GET сейчас
   UNVERIFIED. Runtime-проверка ID нужна, новый backend DTO не одобрен автоматически.
4. Оперативная авторизация: нужны отдельные backend acceptance evidence в изолированной
   среде, не synthetic demo. Полнота двух GET и согласованный момент чтения не доказаны
   одной metadata-валидацией, абсолютная актуальность без server revision недостижима.
5. Пользовательские подсказки, словарная неоднозначность, coverage и версии правил
   потребуют отдельного решения. По умолчанию manual-only, никакой AI/автоapproval.
6. Accessibility и mobile/browser visuals, потеря drafts при tab/focus/refetch и
   конкурентных изменениях должны быть приняты владельцем до выпуска.
7. Любые persistence/write/schema/migration, аудит и cross-device continuation —
   отдельная архитектура с отдельным разрешением. Ни этот RFC, ни успешные synthetic
   тесты не разрешают их автоматически. Следующий PR начинается только по новой задаче.

## 9. Источники

Frontend-ссылки относятся к исходникам указанного baseline; новые пути roadmap
намеренно записаны как предложения, а не ссылки на существующие файлы.

- **F1:** [InitAuth](../src/app/providers/init/InitAuth.tsx), [Protected](../src/app/providers/router/ProtectedRoute.tsx).
- **F2:** [UserProvider](../src/entities/User/ui/UserProvider.tsx), [userApi](../src/entities/User/api/userApi.ts), [userSlice](../src/entities/User/model/userSlice.ts), [selectors](../src/entities/User/model/selectors.ts).
- **F3:** [AuthForm](../src/features/Authorization/ui/AuthForm.tsx), [authApi](../src/features/Authorization/api/authApi.ts), [authorizationSlice](../src/features/Authorization/model/authorizationSlice.ts).
- **F4:** [logout thunk](../src/features/Authorization/model/authThunks.ts), [LogoutButton](../src/features/Authorization/ui/LogoutButton.tsx), [rootReducer](../src/app/providers/store/rootReducer.ts), [store](../src/app/providers/store/store.ts).
- **F5:** [baseApi](../src/shared/api/baseApi.ts), [AppProviders](../src/app/providers/AppProviders.tsx), [entry](../src/main.tsx), [lockfile](../package-lock.json). Defaults/serializer также прочитаны в установленном `@reduxjs/toolkit/src/query/{createApi,defaultSerializeQueryArgs}.ts`, не добавляются в repository.
- **F6:** [expenseApi](../src/entities/Expense/api/expenseApi.ts), [incomeApi](../src/entities/Income/api/incomeApi.ts), [expense types](../src/entities/Expense/model/types.ts), [income types](../src/entities/Income/model/types.ts).
- **F7:** [useFinancialAnalytics](../src/features/FinancialAnalytics/model/useFinancialAnalytics.ts), [analytics README](../src/features/FinancialAnalytics/model/README.md).
- **F8:** [apiRange](../src/features/FinancialAnalytics/model/apiRange.ts), [period](../src/features/FinancialAnalytics/model/period.ts), [validation](../src/features/FinancialAnalytics/model/validation.ts), [money](../src/features/FinancialAnalytics/model/money.ts).
- **F9:** [snapshotAdapter](../src/features/FinancialClassification/model/snapshotAdapter.ts), [adapter contract](../src/features/FinancialClassification/model/snapshotAdapter.md).
- **F10:** [types](../src/features/FinancialClassification/model/types.ts), [resolver](../src/features/FinancialClassification/model/classification.ts), [model README](../src/features/FinancialClassification/model/README.md).
- **F11:** [review prototype](../src/features/FinancialClassification/ui/ClassificationReviewPrototype.tsx), [synthetic review examples](../src/features/FinancialClassification/ui/syntheticReviewExamples.ts), [review contract](../src/features/FinancialClassification/ui/review-prototype.md), [preview](../src/features/FinancialClassification/ui/ClassificationPreview.tsx), [synthetic preview examples](../src/features/FinancialClassification/ui/syntheticExamples.ts).
- **F12:** [routes](../src/app/providers/router/routeConfig.tsx), [nav items](../src/widgets/MobileMenu/model/navItems.ts), [Navigation](../src/widgets/Navigation/ui/Navigation.tsx), [AnalyticsPage](../src/pages/AnalyticsPage/ui/AnalyticsPage.tsx), [Phase 2 RFC](financial-planning-phase2-rfc.md), [reporting policy RFC](financial-analytics-reporting-policy-rfc.md).
- **T1:** [UserProvider tests](../src/entities/User/ui/tests/UserProvider.test.tsx), [AuthForm tests](../src/features/Authorization/ui/tests/AuthForm.test.tsx).
- **T2:** [analytics hook tests](../src/features/FinancialAnalytics/model/tests/useFinancialAnalytics.test.tsx), [validation tests](../src/features/FinancialAnalytics/model/tests/validation.test.ts).
- **T3:** [resolver tests](../src/features/FinancialClassification/model/tests/classification.test.ts), [adapter tests](../src/features/FinancialClassification/model/tests/snapshotAdapter.test.ts), [review tests](../src/features/FinancialClassification/ui/tests/ClassificationReviewPrototype.test.tsx), [preview tests](../src/features/FinancialClassification/ui/tests/ClassificationPreview.test.tsx). Synthetic tests не подтверждают реальную авторизацию.
- **B1:** [auth middleware](https://github.com/mkozhevnikov2323/digit-budget-calculator-api/blob/b6cafc9559608ec0592b64bcd11bc10eb17dab8a/middlewares/auth.js), [routes index](https://github.com/mkozhevnikov2323/digit-budget-calculator-api/blob/b6cafc9559608ec0592b64bcd11bc10eb17dab8a/routes/index.js), [users route](https://github.com/mkozhevnikov2323/digit-budget-calculator-api/blob/b6cafc9559608ec0592b64bcd11bc10eb17dab8a/routes/users.js), [users controller](https://github.com/mkozhevnikov2323/digit-budget-calculator-api/blob/b6cafc9559608ec0592b64bcd11bc10eb17dab8a/controllers/users.js), [User model](https://github.com/mkozhevnikov2323/digit-budget-calculator-api/blob/b6cafc9559608ec0592b64bcd11bc10eb17dab8a/models/user.js).
- **B2:** [expenses GET/controller](https://github.com/mkozhevnikov2323/digit-budget-calculator-api/blob/b6cafc9559608ec0592b64bcd11bc10eb17dab8a/controllers/expenses.js), [incomes GET/controller](https://github.com/mkozhevnikov2323/digit-budget-calculator-api/blob/b6cafc9559608ec0592b64bcd11bc10eb17dab8a/controllers/incomes.js), [expenses route validation](https://github.com/mkozhevnikov2323/digit-budget-calculator-api/blob/b6cafc9559608ec0592b64bcd11bc10eb17dab8a/routes/expenses.js), [incomes route validation](https://github.com/mkozhevnikov2323/digit-budget-calculator-api/blob/b6cafc9559608ec0592b64bcd11bc10eb17dab8a/routes/incomes.js).
- **B3:** [Expense model](https://github.com/mkozhevnikov2323/digit-budget-calculator-api/blob/b6cafc9559608ec0592b64bcd11bc10eb17dab8a/models/expense.js), [Income model](https://github.com/mkozhevnikov2323/digit-budget-calculator-api/blob/b6cafc9559608ec0592b64bcd11bc10eb17dab8a/models/income.js); update filters — controllers B2.
