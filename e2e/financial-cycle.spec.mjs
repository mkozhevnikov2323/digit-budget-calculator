import { test, expect, login, analytics, selectPrimary, prepare, save, statistics,
  confirmMonths, plan, distribute, exportPlan, sum, reopenAfterSave } from './fixture.mjs';

// Fixed independent integer-kopeck expectations; no application calculators imported.
const money = text => {
  const match = text.replace(/\s/g, '').match(/(-?\d+),(\d{2})₽/);
  expect(Boolean(match), 'Visible money must have an exact two-decimal representation').toBe(true);
  return Number(match[1]) * 100 + (match[1].startsWith('-') ? -1 : 1) * Number(match[2]);
};
const rowMoney = async (table, name, column = 1) => money(await table.getByRole('row').filter({ has: table.page().getByRole('cell', { name, exact: true }) }).getByRole('cell').nth(column).innerText());
const start = async page => { await login(page); await analytics(page); };
const classify = async (page, stack) => {
  const review = await selectPrimary(page, stack); await prepare(page, review); await save(page, review);
};
const assertSources = async stack => {
  const state = await stack.rpc('inspect'); expect(state.sourcesUnchanged).toBe(true);
  expect(state.expenseCount).toBe(18); expect(state.incomeCount).toBe(13); return state;
};

test('E2E-01 Authentication through real login and protected analytics', async ({ page, stack }) => {
  await test.step('real login and verified owner', async () => {
    await start(page); await expect(page.getByText('Количество записей расходов', { exact: true })).toBeVisible();
    await assertSources(stack);
  });
});

test('E2E-02 Exact annual monthly category loan and UTC-boundary reconciliation', async ({ page, stack }) => {
  await start(page);
  await test.step('independent integer money and membership accounting', async () => {
    const card = async label => money(await page.getByText(label, { exact: true }).locator('..').innerText());
    expect(await card('Записанные расходы')).toBe(179000);
    expect(await card('Записанные поступления')).toBe(1205000);
    expect(await card('Выданные займы — уже в расходах')).toBe(30000);
    expect(await card('Возвраты займов — уже в поступлениях')).toBe(5000);
    const monthly = page.getByRole('table', { name: 'Помесячный денежный поток', exact: true });
    const cells = await monthly.getByRole('row').all(); expect(cells.length).toBe(13);
    const expenses = [], incomes = [];
    for (let i = 1; i <= 12; i++) {
      const c = cells[i].getByRole('cell');
      expect(await c.nth(0).innerText()).toBe(`2025-${String(i).padStart(2, '0')}`);
      expenses.push(money(await c.nth(3).innerText())); incomes.push(money(await c.nth(2).innerText()));
      expect(await c.nth(4).innerText()).toBe(i === 1 ? '2 / 4' : '1 / 1');
    }
    expect(expenses).toEqual([69000, ...Array(11).fill(10000)]);
    expect(sum(expenses)).toBe(179000); expect(sum(incomes)).toBe(1205000);
    const categories = page.getByRole('table', { name: 'Расходные операции по категориям', exact: true });
    const categoryRows = await categories.getByRole('row').all(); expect(categoryRows.length).toBe(4);
    const totals = []; for (const row of categoryRows.slice(1)) totals.push(money(await row.getByRole('cell').nth(0).innerText()));
    expect(sum(totals)).toBe(179000); expect(totals.sort((a, b) => a - b)).toEqual([5000, 30000, 144000]);
    await assertSources(stack);
  });
});

test('E2E-03 Explicit server review persists a manual decision without source mutation', async ({ page, stack }) => {
  await start(page);
  await test.step('server facts and separate manual confirmation before real commit', async () => {
    const review = await selectPrimary(page, stack);
    await page.getByLabel('Экономическая роль', { exact: true }).selectOption('ordinary_expense');
    await page.getByLabel('Финансовый слой', { exact: true }).selectOption('everyday');
    expect((await stack.rpc('inspect')).primaryRevision).toBeNull();
    await prepare(page, review); expect((await stack.rpc('inspect')).primaryRevision).toBeNull();
    await expect(review.getByRole('button', { name: 'Сохранить классификацию на сервере', exact: true })).toBeEnabled();
    await save(page, review);
    const state = await assertSources(stack); expect(state.primaryRevision).toBe(1); expect(state.primaryLayer).toBe('everyday');
  });
});

test('E2E-04 Reload reads the persisted decision and continuous revision from MongoDB', async ({ page, stack }) => {
  await start(page); await classify(page, stack);
  await test.step('new browser document observes stored decision', async () => {
    await page.reload(); await analytics(page); await selectPrimary(page, stack);
    await expect(page.getByRole('region', { name: 'Проверка операции' }).getByText(/Есть подтверждённое решение\. Ревизия: 1/)).toBeVisible();
    expect((await assertSources(stack)).primaryRevision).toBe(1);
  });
});

test('E2E-05 Classification buckets roles layers and coverage reconcile exactly', async ({ page, stack }) => {
  await start(page); await classify(page, stack); await statistics(page);
  await test.step('no duplicate accounting across status role and layer views', async () => {
    const table = page.getByRole('table', { name: 'Статусы и роли expenses', exact: true });
    const approved = await rowMoney(table, 'approved'), unreviewed = await rowMoney(table, 'unreviewed');
    expect(approved).toBe(174000); expect(unreviewed).toBe(5000); expect(approved + unreviewed).toBe(179000);
    for (const status of ['explicit_unclassified', 'cleared', 'stale', 'blocked']) expect(await rowMoney(table, status)).toBe(0);
    expect(await rowMoney(table, 'Роль: loan_issuance')).toBe(30000);
    expect(await rowMoney(table, 'Роль: ordinary_expense')).toBe(144000);
    const expenses = page.getByRole('region', { name: 'Классификация expenses', exact: true });
    await expect(expenses.getByText('Покрытие классификации по количеству: 93.3%; по сумме: 97.2%.', { exact: true })).toBeVisible();
    const layers = page.getByRole('table', { name: 'Реальные финансовые слои', exact: true });
    expect(await rowMoney(layers, 'everyday')).toBe(120000); expect(await rowMoney(layers, 'irregular')).toBe(24000);
    const categories = page.getByRole('table', { name: 'Реальные категории независимо от слоёв', exact: true });
    expect(await rowMoney(categories, 'Транспорт')).toBe(144000);
    await assertSources(stack);
  });
});

test('E2E-06 Forecast needs twelve explicit recording confirmations and clears on reload', async ({ page, stack }) => {
  await start(page); await classify(page, stack); const forecast = await statistics(page);
  await test.step('insufficient evidence cannot become a forecast', async () => {
    await expect(page.getByRole('table', { name: 'Прогноз по реальным финансовым слоям', exact: true })).toHaveCount(0);
    await confirmMonths(forecast, 11); await forecast.getByRole('button', { name: 'Рассчитать оценку по записанной истории', exact: true }).click();
    await expect(forecast.getByText(/Прогноз недоступен:/)).toBeVisible();
    await confirmMonths(forecast); await forecast.getByRole('button', { name: 'Рассчитать оценку по записанной истории', exact: true }).click();
    const table = page.getByRole('table', { name: 'Прогноз по реальным финансовым слоям', exact: true });
    expect(await rowMoney(table, 'everyday / median_monthly', 7)).toBe(10000);
    expect(await rowMoney(table, 'everyday / median_monthly', 8)).toBe(120000);
    expect(await rowMoney(table, 'irregular / historical_allocation', 7)).toBe(2000);
    expect(await rowMoney(table, 'irregular / historical_allocation', 8)).toBe(24000);
    await expect(forecast.getByText(/Покрытие классификации: partial.*Не покрыто: 50,00 ₽ \/ 1 операций/)).toBeVisible();
    await page.reload(); await analytics(page); const fresh = await statistics(page);
    await expect(fresh.getByRole('checkbox', { checked: true })).toHaveCount(0);
    await expect(page.getByRole('table', { name: 'Прогноз по реальным финансовым слоям', exact: true })).toHaveCount(0);
    await assertSources(stack);
  });
});

test('E2E-07 Forecast acceptance preserves manual targets and separate reserve', async ({ page, stack }) => {
  await start(page); await classify(page, stack); const forecast = await statistics(page);
  await confirmMonths(forecast); await forecast.getByRole('button', { name: 'Рассчитать оценку по записанной истории', exact: true }).click();
  await test.step('explicit recommendation acceptance changes only eligible unprotected layers', async () => {
    const p = await plan(page); await p.getByLabel('Год плана', { exact: true }).fill('2027');
    await p.getByRole('button', { name: 'Использовать выбранный период как базу без изменения сумм', exact: true }).click();
    await distribute(p, 'everyday', '2400'); await distribute(p, 'reserve', '600');
    await expect(p.getByRole('button', { name: 'Применить рекомендации к не изменённым вручную слоям', exact: true })).toBeDisabled();
    await p.getByRole('checkbox', { name: 'Я проверил(а) рекомендации и ограничения; ручные слои и резерв сохранить', exact: true }).check();
    await p.getByRole('button', { name: 'Применить рекомендации к не изменённым вручную слоям', exact: true }).click();
    const exported = await exportPlan(p);
    expect(sum(exported.layers.everyday)).toBe(240000); expect(sum(exported.layers.irregular)).toBe(24000);
    expect(sum(exported.reserve)).toBe(60000); expect(exported.layers.everyday).toEqual(Array(12).fill(20000));
    expect(exported.layers.irregular).toEqual(Array(12).fill(2000));
    expect(sum(Object.values(exported.layers).flat())).toBe(264000);
    await assertSources(stack);
  });
});

test('E2E-08 Incomplete actuals are refused then exact plan actual variance is shown', async ({ page, stack }) => {
  await stack.rpc('approveRemaining'); await start(page);
  await test.step('complete classification plus separate recording evidence is required', async () => {
    const p = await plan(page); await p.getByLabel('Начало исторической базы', { exact: true }).fill('2024-01-01');
    await p.getByLabel('Конец исторической базы', { exact: true }).fill('2024-12-31');
    await p.getByLabel('Год плана', { exact: true }).fill('2025');
    await distribute(p, 'everyday', '1200'); await distribute(p, 'irregular', '240'); await distribute(p, 'reserve', '600');
    await p.getByRole('button', { name: 'Загрузить реальные расходы года плана', exact: true }).click();
    const actual = p.getByRole('region', { name: 'Сравнение с реальными расходами', exact: true });
    await expect(actual.getByText(/Полное сравнение недоступно:/)).toBeVisible();
    await confirmMonths(actual, 11);
    await expect(actual.getByRole('table', { name: 'Реальный план и факт по слоям', exact: true })).toHaveCount(0);
    await confirmMonths(actual);
    await expect(actual.getByRole('table', { name: 'Реальный план и факт по слоям', exact: true })).toBeVisible();
    await expect(actual.getByText('Завершённых месяцев: 12. План: 1440,00 ₽. Реальный подтверждённый факт: 1490,00 ₽. Отклонение (факт − план): 50,00 ₽. Осталось по расписанию: 0,00 ₽. Остаток годовой цели после факта: -50,00 ₽.', { exact: true })).toBeVisible();
    expect(sum((await exportPlan(p)).reserve)).toBe(60000); await assertSources(stack);
  });
});

test('E2E-09 Explicit budget-plan-v1 export import rejects malformed and unsupported data', async ({ page, stack }) => {
  await start(page); const p = await plan(page); await distribute(p, 'everyday', '1200.01');
  await test.step('JSON round trip stays memory-only with exact remainder allocation', async () => {
    const original = await exportPlan(p); expect(original.version).toBe('budget-plan-v1');
    expect(original.layers.everyday).toEqual([10001, ...Array(11).fill(10000)]);
    await p.getByRole('button', { name: 'Новый пустой план — удалить текущий черновик', exact: true }).click();
    const imported = p.getByLabel('JSON для импорта', { exact: true }); await imported.fill(JSON.stringify(original));
    expect(sum((await exportPlan(p)).layers.everyday)).toBe(0);
    await p.getByRole('button', { name: 'Импортировать JSON — заменить черновик', exact: true }).click();
    expect(await exportPlan(p)).toEqual(original);
    for (const bad of ['{', JSON.stringify({ ...original, version: 'budget-plan-v2' })]) {
      await imported.fill(bad); await p.getByRole('button', { name: 'Импортировать JSON — заменить черновик', exact: true }).click();
      await expect(p.getByText('Импорт отклонён. Текущий черновик и исходный текст сохранены.', { exact: true })).toBeVisible();
      expect(await exportPlan(p)).toEqual(original);
    }
    await assertSources(stack);
  });
});

test('E2E-10 Cross-owner HTTP access and account switching isolate decisions drafts and evidence', async ({ page, stack }) => {
  await start(page); await classify(page, stack); const forecast = await statistics(page); await confirmMonths(forecast, 2);
  const p = await plan(page); await distribute(p, 'everyday', '999');
  await test.step('real browser credential cannot authorize foreign source reads or preparation', async () => {
    const statuses = await page.evaluate(async ({ baseUrl, foreign }) => {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };
      const read = await fetch(`${baseUrl}/classifications/expenses/${foreign}`, { headers });
      const prepare = await fetch(`${baseUrl}/classifications/expenses/${foreign}/reviews`, { method: 'POST', headers,
        body: JSON.stringify({ version: 'classification-review-request-v1', browserReviewContext: crypto.randomUUID(),
          requestId: crypto.randomUUID(), expectedRevision: null, state: 'approved', assignment: { economicRole: 'ordinary_expense', layer: 'everyday' } }) });
      const history = await fetch(`${baseUrl}/classifications/history/read`, { method: 'POST', headers,
        body: JSON.stringify({ version: 'classification-history-read-request-v1', startInclusive: Date.UTC(2025, 0, 1),
          endExclusive: Date.UTC(2026, 0, 1), operations: [{ dataset: 'expenses', operationId: foreign }] }) });
      return [read.status, prepare.status, history.status];
    }, { baseUrl: stack.baseUrl, foreign: stack.foreign });
    expect(statuses).toEqual([404, 404, 404]);
    await page.getByRole('button', { name: 'Выйти', exact: true }).click(); await login(page, 'b'); await analytics(page);
    await expect(page.getByText('Количество записей расходов', { exact: true }).locator('..')).toContainText('1');
    const bPlan = await plan(page); expect(sum((await exportPlan(bPlan)).layers.everyday)).toBe(0);
    const bForecast = await statistics(page); await expect(bForecast.getByRole('checkbox', { checked: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Классификация исторических операций', exact: true }).click();
    await expect(page.getByRole('button', { name: new RegExp(stack.primary) })).toHaveCount(0);
    await page.getByRole('button', { name: new RegExp(stack.foreign) }).click();
    await expect(page.getByRole('region', { name: 'Проверка операции' }).getByText(/Не рассмотрена\. Ревизия: нет/)).toBeVisible();
    expect((await assertSources(stack)).primaryRevision).toBe(1);
  });
});

test('E2E-11 Financial edit rejects stale review without overwriting source facts', async ({ page, stack }) => {
  await start(page); const review = await selectPrimary(page, stack); await prepare(page, review);
  await test.step('source changed after preparation cannot silently inherit approval', async () => {
    await stack.rpc('changeSource');
    const response = page.waitForResponse(r => /\/commands$/.test(r.url()) && r.request().method() === 'POST');
    await review.getByRole('button', { name: 'Сохранить классификацию на сервере', exact: true }).click();
    expect((await response).status()).toBe(409);
    await expect(review.getByText('Конфликт решения или изменённые факты. Обновите историю; выбор сохранён.', { exact: true })).toBeVisible();
    const state = await assertSources(stack); expect(state.primaryRevision).toBeNull();
  });
});

test('E2E-12 Concurrent CAS duplicate click unknown commit reconciliation and expired proof', async ({ page, context, stack }) => {
  await start(page); let review = await selectPrimary(page, stack); await prepare(page, review);
  const second = await context.newPage(); await analytics(second); const other = await selectPrimary(second, stack); await prepare(second, other);
  await test.step('independent prepared intents conflict and synchronous double click sends once', async () => {
    let commands = 0; page.on('request', r => { if (/\/commands$/.test(r.url()) && r.method() === 'POST') commands++; });
    const response = page.waitForResponse(r => /\/commands$/.test(r.url()) && r.request().method() === 'POST');
    await review.getByRole('button', { name: 'Сохранить классификацию на сервере', exact: true }).evaluate(button => { button.click(); button.click(); });
    expect((await response).status()).toBe(201);
    await reopenAfterSave(page, stack.primary); expect(commands).toBe(1);
    const conflict = second.waitForResponse(r => /\/commands$/.test(r.url()) && r.request().method() === 'POST');
    await other.getByRole('button', { name: 'Сохранить классификацию на сервере', exact: true }).click(); expect((await conflict).status()).toBe(409);
    await expect(other.getByText(/Конфликт решения или изменённые факты/)).toBeVisible();
  });
  await second.close();
  await test.step('real commit with lost acknowledgement only permits read-only reconciliation', async () => {
    await page.getByRole('button', { name: new RegExp(stack.misc) }).click();
    review = page.getByRole('region', { name: 'Сохранение ручной классификации' }); await prepare(page, review);
    await stack.rpc('loseAcknowledgement'); let writes = 0;
    page.on('request', r => { if (/\/commands$/.test(r.url()) && r.method() === 'POST') writes++; });
    await review.getByRole('button', { name: 'Сохранить классификацию на сервере', exact: true }).click();
    await expect(review.getByText(/Запись могла сохраниться/)).toBeVisible();
    await expect(review.getByRole('button', { name: 'Подготовить серверную проверку', exact: true })).toBeDisabled();
    await expect(review.getByRole('button', { name: 'Сохранить классификацию на сервере', exact: true })).toBeDisabled();
    const before = await stack.rpc('inspect');
    await review.getByRole('button', { name: 'Проверить результат без записи', exact: true }).click();
    await reopenAfterSave(page, stack.misc);
    expect(writes).toBe(1); expect((await stack.rpc('inspect')).classifications).toBe(before.classifications);
  });
  await test.step('expired server proof is rejected without a new mutation', async () => {
    await page.getByRole('button', { name: new RegExp(stack.primary) }).click();
    review = page.getByRole('region', { name: 'Сохранение ручной классификации' }); await prepare(page, review);
    const before = await stack.rpc('inspect'); await stack.rpc('expireProof');
    const response = page.waitForResponse(r => /\/commands$/.test(r.url()) && r.request().method() === 'POST');
    await review.getByRole('button', { name: 'Сохранить классификацию на сервере', exact: true }).click();
    expect((await response).status()).toBe(410); await expect(review.getByText(/Срок проверки истёк/)).toBeVisible();
    expect((await assertSources(stack)).classifications).toBe(before.classifications);
  });
});

test('E2E-13 Transport unavailability preserves draft and precision fails without rounding', async ({ page, stack }) => {
  // Mutate only the owned fixture BEFORE the first observation: do not mistake
  // an existing RTK cache entry for a new source observation.
  await stack.rpc('unsupportedPrecision'); await login(page); await page.goto('/analytics');
  await page.getByLabel('Период', { exact: true }).selectOption('year');
  await page.getByLabel('Год', { exact: true }).fill('2025');
  const p = await plan(page); await distribute(p, 'everyday', '123.45');
  await test.step('unsupported source precision produces explicit unavailable report', async () => {
    await expect(page.getByText(/более двух знаков после запятой/)).toBeVisible();
    await expect(page.getByRole('table', { name: 'Помесячный денежный поток', exact: true })).toHaveCount(0);
  });
  await test.step('backend network failure cannot produce complete reporting or erase local plan', async () => {
    await page.route(`${stack.baseUrl}/**`, route => route.abort('connectionrefused'));
    await page.getByLabel('Год', { exact: true }).fill('2023');
    await expect(page.getByText('Не удалось загрузить операции выбранного периода. Итоги периода не рассчитаны.', { exact: true })).toBeVisible();
    expect(sum((await exportPlan(p)).layers.everyday)).toBe(12345);
    await expect(page.getByText(/Сервер подтвердил сохранение/)).toHaveCount(0);
    await page.unrouteAll(); await assertSources(stack);
  });
});

test('E2E-14 Feature flags alone cannot activate writes without protocol installation', async ({ page, stack }) => {
  await start(page); const review = await selectPrimary(page, stack); const before = await stack.rpc('inspect');
  await test.step('real default bootstrap remains fail-closed even with flags enabled', async () => {
    const response = page.waitForResponse(r => /\/reviews$/.test(r.url()) && r.request().method() === 'POST');
    await review.getByRole('button', { name: 'Подготовить серверную проверку', exact: true }).click();
    expect((await response).status()).toBe(503);
    await expect(review.getByText(/Подготовка проверки недоступна/)).toBeVisible();
    await expect(review.getByRole('button', { name: 'Сохранить классификацию на сервере', exact: true })).toHaveCount(0);
    const after = await assertSources(stack); expect(after.classifications).toBe(before.classifications); expect(after.primaryRevision).toBeNull();
  });
});
