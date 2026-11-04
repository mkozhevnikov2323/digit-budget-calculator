import { test, expect, login, analytics, selectPrimary, selectOperation, chooseClassification, save, statistics,
  confirmMonths, plan, distribute, exportPlan, sum, reopenAfterSave, checkClassificationNavigation } from './fixture.mjs';

// Fixed independent integer-kopeck expectations; no application calculators imported.
const money = text => {
  const match = text.replace(/\s/g, '').match(/(-?\d+),(\d{2})₽/);
  expect(Boolean(match), 'Visible money must have an exact two-decimal representation').toBe(true);
  return Number(match[1]) * 100 + (match[1].startsWith('-') ? -1 : 1) * Number(match[2]);
};
const rowMoney = async (table, name, column = 1) => money(await table.getByRole('row').filter({ has: table.page().getByRole('cell', { name, exact: true }) }).getByRole('cell').nth(column).innerText());
const start = async page => { await login(page); await analytics(page); };
const classify = async (page, stack) => {
  const review = await selectPrimary(page, stack); await chooseClassification(page, review); await save(page, review);
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
  await test.step('all Analytics shell links support direct entry and real reload', async () => {
    const tabs = page.getByRole('navigation', { name: 'Разделы аналитики' }).getByRole('tab');
    await expect(tabs).toHaveCount(9);
    const destinations = await tabs.evaluateAll(elements => elements.map(el => ({href:el.getAttribute('href'),label:el.textContent})));
    for (const {href,label} of destinations) {
      await page.getByRole('tab',{name:label,exact:true}).click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await page.reload();
      await expect(page.getByRole('tab',{name:label,exact:true})).toHaveAttribute('aria-current','page');
      if(href==='/analytics') await expect(page.getByRole('heading',{name:'Финансовая аналитика',exact:true})).toBeVisible();
      else {
        await expect(page.getByRole('heading',{name:label,exact:true,level:1})).toBeVisible();
        await expect(page.getByRole('heading',{name:'Финансовая аналитика',exact:true})).toHaveCount(0);
      }
    }
    await page.setViewportSize({width:360,height:800});
    const navigation=page.getByRole('navigation',{name:'Разделы аналитики'});
    const bounds=await navigation.boundingBox();expect(bounds.width).toBeLessThanOrEqual(360);
    await page.getByRole('tab',{name:'Расширенная аналитика',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Финансовая аналитика',exact:true})).toBeVisible();
    await page.getByRole('tab',{name:'Планирование бюджета',exact:true}).click();
    await expect(page.getByRole('tab',{name:'Планирование бюджета',exact:true})).toHaveAttribute('aria-current','page');
    await page.setViewportSize({width:1440,height:1000});
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
      expect(await c.nth(0).innerText()).toBe(new Intl.DateTimeFormat('ru-RU',{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(Date.UTC(2025,i-1,1))));
      expenses.push(money(await c.nth(3).innerText())); incomes.push(money(await c.nth(2).innerText()));
      expect(await c.nth(4).innerText()).toBe(i === 1 ? '2 / 4' : '1 / 1');
    }
    expect(expenses).toEqual([69000, ...Array(11).fill(10000)]);
    expect(sum(expenses)).toBe(179000); expect(sum(incomes)).toBe(1205000);
    await analytics(page,'categories');
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
    await analytics(page,'classification');await page.getByRole('tab',{name:'Расходы',exact:true}).click();
    await page.getByRole('button',{name:'Не классифицировано (2)',exact:true}).click();
    const review = await selectPrimary(page, stack);
    await page.getByLabel('Тип операции', { exact: true }).selectOption('ordinary_expense');
    await page.getByLabel('Группа расходов', { exact: true }).selectOption('everyday');
    expect((await stack.rpc('inspect')).primaryRevision).toBeNull();
    await chooseClassification(page, review); expect((await stack.rpc('inspect')).primaryRevision).toBeNull();
    await expect(review.getByRole('button', { name: /^(Классифицировать|Сохранить изменения)$/, exact: true })).toBeEnabled();
    // Financial API reads only: frontend font/chunk requests are not data reloads.
    let reads=0,puts=0,legacy=0;const observe=r=>{if(new URL(r.url()).origin===stack.baseUrl&&(r.method()==='GET'||/history\/read$/.test(r.url())))reads++;if(r.method()==='PUT'&&/\/decision$/.test(r.url()))puts++;if(/\/c-v1\//.test(r.url()))legacy++;};page.on('request',observe);
    const apply=page.waitForResponse(r=>/\/decision$/.test(r.url()));
    await review.getByRole('button',{name:'Классифицировать',exact:true}).click();expect((await apply).status()).toBe(201);
    await expect(page.getByRole('region',{name:'Проверка операции'})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Не классифицировано (1)',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Классифицировано (14)',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Fictional fuel',exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Все (15)',exact:true}).click();
    const row=page.getByRole('heading',{name:'15.01.2025',level:2}).locator('..').getByRole('button',{name:'Fictional fuel',exact:true});
    await expect(row.getByText('Классифицировано',{exact:true})).toBeVisible();await expect(row.getByText('Обычный расход',{exact:true})).toBeVisible();await expect(row.getByText('Повседневные расходы',{exact:true})).toBeVisible();
    expect(reads).toBe(0);expect(puts).toBe(1);expect(legacy).toBe(0);page.off('request',observe);
    const state = await assertSources(stack); expect(state.primaryRevision).toBe(1); expect(state.primaryLayer).toBe('everyday');
  });
});

test('E2E-04 Reload reads the persisted decision and continuous revision from MongoDB', async ({ page, stack }) => {
  await start(page); await classify(page, stack);
  await test.step('new browser document observes stored decision', async () => {
    await page.reload(); await analytics(page); await selectPrimary(page, stack);
    await expect(page.getByLabel('Тип операции',{exact:true})).toBeVisible();
    expect((await assertSources(stack)).primaryRevision).toBe(1);
  });
  await test.step('income C approval survives reload without changing financial sources', async()=>{
    const salary='0000000000000000000000c8';
    await selectOperation(page,salary);
    const review=page.getByRole('region',{name:'Сохранение ручной классификации'});
    await page.getByLabel('Тип операции',{exact:true}).selectOption('refund');await chooseClassification(page,review);
    const applied=page.waitForResponse(r=>/\/decision$/.test(r.url())&&r.request().method()==='PUT');
    await review.getByRole('button',{name:/^(Классифицировать|Сохранить изменения)$/,exact:true}).click();expect((await applied).status()).toBe(200);
    await expect(page.getByRole('region',{name:'Проверка операции'})).toHaveCount(0);
    await page.reload();await analytics(page);await selectPrimary(page,stack);
    await selectOperation(page,salary);
    await expect(page.getByLabel('Тип операции',{exact:true})).toBeVisible();await assertSources(stack);
    const explicit=page.waitForResponse(r=>/\/decision$/.test(r.url())&&r.request().method()==='PUT');
    await page.getByRole('button',{name:'Оставить без классификации',exact:true}).click();expect((await explicit).status()).toBe(200);
    await expect(page.getByRole('region',{name:'Проверка операции'})).toHaveCount(0);
    await page.reload();await analytics(page,'classification');await selectOperation(page,salary);
    await expect(page.getByRole('button',{name:'Оставить без классификации',exact:true})).toBeDisabled();await assertSources(stack);
  });

});

test('E2E-05 Classification buckets roles layers and coverage reconcile exactly', async ({ page, stack }) => {
  await start(page); await classify(page, stack);
  // Removed technical UI tables still have exact accounting assertions against
  // the actual validated batch responses used by the automatically loaded UI.
  // Automatic loading may also observe the initial calendar before analytics()
  // selects 2025. Do not mix observations from different report windows.
  const batches=[],observations=new Map();
  const selectedBatch=page.waitForResponse(response=>response.url().endsWith('/classifications/history/read')&&response.request().method()==='POST'&&response.ok()&&response.request().postDataJSON().startInclusive===Date.UTC(2025,0,1)&&response.request().postDataJSON().endExclusive===Date.UTC(2026,0,1));
  const capture=response=>{if(response.url().endsWith('/classifications/history/read')&&response.request().method()==='POST'&&response.ok())batches.push(response.json().then(body=>{if(body.window.startInclusive!==Date.UTC(2025,0,1)||body.window.endExclusive!==Date.UTC(2026,0,1))return;for(const op of body.operations)observations.set(`${op.dataset}/${op.operationId}`,op);}));};
  page.on('response',capture);await statistics(page);await selectedBatch;await Promise.all(batches);page.off('response',capture);
  await test.step('no duplicate accounting across status role and layer views', async () => {
    const recorded=[...observations.values()].filter(op=>op.dataset==='expenses');expect(recorded.length).toBe(15);
    const total=predicate=>sum(recorded.filter(predicate).map(op=>{const value=Number(op.facts.amount.value)*100;expect(Number.isSafeInteger(value)).toBe(true);return value;}));
    const approved = total(op=>op.classification.status==='approved'), unreviewed = total(op=>op.classification.status==='unreviewed');
    expect(approved).toBe(174000); expect(unreviewed).toBe(5000); expect(approved + unreviewed).toBe(179000);
    for (const status of ['explicit_unclassified','cleared','stale','blocked']) expect(total(op=>op.classification.status===status)).toBe(0);
    expect(total(op=>op.classification.status==='approved'&&op.classification.confirmed?.economicRole==='loan_issuance')).toBe(30000);
    expect(total(op=>op.classification.status==='approved'&&op.classification.confirmed?.economicRole==='ordinary_expense')).toBe(144000);
    const expenses = page.getByRole('region', { name: 'Расходы', exact: true });
    await expect.poll(async()=>money(await expenses.getByText(/^Общая сумма расходов:/).innerText())).toBe(179000);
    await expect(expenses.getByText('Количество операций: 15',{exact:true})).toBeVisible();
    await expect(expenses.getByText('Классифицировано по количеству: 93,3%',{exact:true})).toBeVisible();
    await expect(expenses.getByText('Классифицировано по сумме: 97,2%',{exact:true})).toBeVisible();
    await expect(page.getByRole('table',{name:'Статусы и роли расходов',exact:true})).toHaveCount(0);
    const layers = page.getByRole('table', { name: 'Группы расходов', exact: true });
    expect(await rowMoney(layers, 'Повседневные расходы')).toBe(120000); expect(await rowMoney(layers, 'Нерегулярные расходы')).toBe(24000);
    const categories = page.getByRole('table', { name: 'Расходы по категориям', exact: true });
    expect(await rowMoney(categories, 'Транспорт')).toBe(144000);
    await assertSources(stack);
  });
});

test('E2E-06 Forecast needs twelve explicit recording confirmations and clears on reload', async ({ page, stack }) => {
  await start(page); await classify(page, stack); const forecast = await statistics(page,'planning');
  await test.step('insufficient evidence cannot become a forecast', async () => {
    await expect(page.getByRole('table', { name: 'Прогноз по реальным финансовым слоям', exact: true })).toHaveCount(0);
    await confirmMonths(forecast, 11); await forecast.getByRole('button', { name: 'Рассчитать оценку по записанной истории', exact: true }).click();
    await expect(forecast.getByText(/Прогноз недоступен:/)).toBeVisible();
    await confirmMonths(forecast); await forecast.getByRole('button', { name: 'Рассчитать оценку по записанной истории', exact: true }).click();
    const table = page.getByRole('table', { name: 'Прогноз по реальным финансовым слоям', exact: true });
    expect(await rowMoney(table, 'Повседневные расходы / Медиана по месяцам', 7)).toBe(10000);
    expect(await rowMoney(table, 'Повседневные расходы / Медиана по месяцам', 8)).toBe(120000);
    expect(await rowMoney(table, 'Нерегулярные расходы / Распределение истории', 7)).toBe(2000);
    expect(await rowMoney(table, 'Нерегулярные расходы / Распределение истории', 8)).toBe(24000);
    await expect(forecast.getByText(/Покрытие классификации: Частичное.*Не покрыто: 50,00 ₽ \/ 1 операций/)).toBeVisible();
    await page.reload(); await analytics(page); const fresh = await statistics(page,'planning');
    await expect(fresh.getByRole('checkbox', { checked: true })).toHaveCount(0);
    await expect(page.getByRole('table', { name: 'Прогноз по реальным финансовым слоям', exact: true })).toHaveCount(0);
    await assertSources(stack);
  });
});

test('E2E-07 Forecast acceptance preserves manual targets and separate reserve', async ({ page, stack }) => {
  await start(page); await classify(page, stack); const forecast = await statistics(page,'planning');
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
  await test.step('page-specific filters and private budget input survive tabs; reload keeps only safe preferences',async()=>{
    await p.getByLabel('Год плана',{exact:true}).fill('2028');
    await p.getByLabel('Повседневные расходы месяц 1',{exact:true}).fill('111.12');
    await p.getByLabel('Новая годовая сумма Резерв',{exact:true}).fill('321.45');
    await page.getByRole('tab',{name:'Операции по категориям',exact:true}).click();await expect(page.getByRole('heading',{name:'Операции по категориям',exact:true,level:1})).toBeVisible();
    await page.getByLabel('Период',{exact:true}).selectOption('month');await page.getByLabel('Год',{exact:true}).fill('2025');await page.getByLabel('Месяц',{exact:true}).selectOption('9');
    await page.getByRole('tab',{name:'Классификация',exact:true}).click();await expect(page.getByRole('heading',{name:'Классификация',exact:true,level:1})).toBeVisible();
    await page.getByLabel('Период',{exact:true}).selectOption('month');await page.getByLabel('Год',{exact:true}).fill('2025');await page.getByLabel('Месяц',{exact:true}).selectOption('10');
    await page.getByRole('tab',{name:'Операции по категориям',exact:true}).click();await expect(page.getByRole('heading',{name:'Операции по категориям',exact:true,level:1})).toBeVisible();await expect(page.getByLabel('Месяц',{exact:true})).toHaveValue('9');
    await page.getByRole('tab',{name:'Классификация',exact:true}).click();await expect(page.getByRole('heading',{name:'Классификация',exact:true,level:1})).toBeVisible();await expect(page.getByLabel('Месяц',{exact:true})).toHaveValue('10');
    await page.getByRole('tab',{name:'Планирование бюджета',exact:true}).click();await expect(page.getByRole('heading',{name:'Планирование бюджета',exact:true,level:1})).toBeVisible();
    await expect(p.getByLabel('Год плана',{exact:true})).toHaveValue('2028');
    await expect(p.getByLabel('Повседневные расходы месяц 1',{exact:true})).toHaveValue('111.12');
    await expect(p.getByLabel('Новая годовая сумма Резерв',{exact:true})).toHaveValue('321.45');
    const preferences=await page.evaluate(()=>localStorage.getItem('budget-analytics-display-v1'));
    expect(preferences.includes('111.12')||preferences.includes('321.45')||preferences.includes('preparationId')).toBe(false);
    await page.getByRole('tab',{name:'Операции по категориям',exact:true}).click();await expect(page.getByRole('heading',{name:'Операции по категориям',exact:true,level:1})).toBeVisible();await page.reload();await expect(page.getByLabel('Месяц',{exact:true})).toHaveValue('9');
    await page.getByRole('tab',{name:'Планирование бюджета',exact:true}).click();await expect(page.getByRole('heading',{name:'Планирование бюджета',exact:true,level:1})).toBeVisible();await expect(page.getByLabel('Повседневные расходы месяц 1',{exact:true})).toHaveCount(0);
    await assertSources(stack);
  });

  await test.step('classification page four survives reload, navigation is local and compact mobile layout fits',async()=>{await checkClassificationNavigation(page,stack);await assertSources(stack);});

});

test('E2E-10 Cross-owner HTTP access and account switching isolate decisions drafts and evidence', async ({ page, stack }) => {
  await start(page); await classify(page, stack); const forecast = await statistics(page,'planning'); await confirmMonths(forecast, 2);
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
    const bForecast = await statistics(page,'planning'); await expect(bForecast.getByRole('checkbox', { checked: true })).toHaveCount(0);
    await analytics(page,'classification');
    await page.getByRole('tab',{name:'Расходы',exact:true}).click();
    await expect(page.getByRole('button', { name: 'Fictional fuel', exact:true })).toHaveCount(0);
    await selectOperation(page,stack.foreign);
    await expect(page.getByLabel('Тип операции',{exact:true})).toBeVisible();
    expect((await assertSources(stack)).primaryRevision).toBe(1);
  });
});

test('E2E-11 Financial edit rejects stale review without overwriting source facts', async ({ page, stack }) => {
  await start(page); const review = await selectPrimary(page, stack); await chooseClassification(page, review);
  await test.step('source changed after display cannot silently inherit approval', async () => {
    await stack.rpc('changeSource');
    const response = page.waitForResponse(r => /\/decision$/.test(r.url()) && r.request().method() === 'PUT');
    await review.getByRole('button', { name: /^(Классифицировать|Сохранить изменения)$/, exact: true }).click();
    expect((await response).status()).toBe(409);
    await expect(review.getByText('Конфликт решения или изменённые факты. Обновите историю; выбор сохранён.', { exact: true })).toBeVisible();
    const state = await assertSources(stack); expect(state.primaryRevision).toBeNull();
  });
});

test('E2E-12 Single PUT concurrent CAS duplicate click unknown outcome and response revision', async ({ page, context, stack }) => {
  await start(page); let review = await selectPrimary(page, stack); await chooseClassification(page, review);
  const second = await context.newPage(); await analytics(second); const other = await selectPrimary(second, stack); await chooseClassification(second, other);
  await test.step('independent displayed revisions conflict and synchronous double click sends once', async () => {
    let commands = 0; page.on('request', r => { if (/\/decision$/.test(r.url()) && r.method() === 'PUT') commands++; });
    const response = page.waitForResponse(r => /\/decision$/.test(r.url()) && r.request().method() === 'PUT');
    await review.getByRole('button', { name: /^(Классифицировать|Сохранить изменения)$/, exact: true }).evaluate(button => { button.click(); button.click(); });
    expect((await response).status()).toBe(201);
    await reopenAfterSave(page, stack.primary); expect(commands).toBe(1);
    const conflict = second.waitForResponse(r => /\/decision$/.test(r.url()) && r.request().method() === 'PUT');
    await other.getByRole('button', { name: /^(Классифицировать|Сохранить изменения)$/, exact: true }).click(); expect((await conflict).status()).toBe(409);
    await expect(other.getByText(/Конфликт решения или изменённые факты/)).toBeVisible();
  });
  await second.close();
  await test.step('real commit with lost acknowledgement only permits read-only reconciliation', async () => {
    await selectOperation(page,stack.misc);
    review = page.getByRole('region', { name: 'Сохранение ручной классификации' }); await chooseClassification(page, review);
    await stack.rpc('loseAcknowledgement'); let writes = 0;
    page.on('request', r => { if (/\/decision$/.test(r.url()) && r.method() === 'PUT') writes++; });
    await review.getByRole('button', { name: /^(Классифицировать|Сохранить изменения)$/, exact: true }).click();
    await expect(review.getByText(/Запись могла сохраниться/)).toBeVisible();
    await expect(review.getByRole('button', { name: 'Повторить подготовку', exact: true })).toHaveCount(0);
    await expect(review.getByRole('button', { name: /^(Классифицировать|Сохранить изменения)$/, exact: true })).toBeDisabled();
    const before = await stack.rpc('inspect');
    await review.getByRole('button', { name: 'Обновить состояние без повторной записи', exact: true }).click();
    await selectOperation(page,stack.misc);
    await expect(page.getByRole('button',{name:'Сохранить изменения',exact:true})).toBeDisabled();
    expect(writes).toBe(1); expect((await stack.rpc('inspect')).classifications).toBe(before.classifications);
  });
  await test.step('repeat editing uses the response revision without a GET or preparation', async () => {
    await selectOperation(page,stack.primary);
    review = page.getByRole('region',{name:'Сохранение ручной классификации'});await chooseClassification(page,review);
    const response=page.waitForResponse(r=>/\/decision$/.test(r.url())&&r.request().method()==='PUT');
    await review.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
    const result=await response;expect(result.status()).toBe(200);expect((await result.json()).decision.decisionRevision).toBe(2);
    await expect(page.getByRole('region',{name:'Проверка операции'})).toHaveCount(0);expect((await assertSources(stack)).primaryRevision).toBe(2);
  });
});

test('E2E-13 Transport unavailability preserves draft and precision fails without rounding', async ({ page, stack }) => {
  // Mutate only the owned fixture BEFORE the first observation: do not mistake
  // an existing RTK cache entry for a new source observation.
  await stack.rpc('unsupportedPrecision'); await login(page); await page.goto('/analytics');
  await page.getByLabel('Период', { exact: true }).selectOption('year');
  await page.getByLabel('Год', { exact: true }).fill('2025');
  await test.step('unsupported source precision produces explicit unavailable report', async () => {
    await expect(page.getByText(/более двух знаков после запятой/)).toBeVisible();
    await expect(page.getByRole('table', { name: 'Помесячный денежный поток', exact: true })).toHaveCount(0);
  });
  const p = await plan(page); await distribute(p, 'everyday', '123.45');
  await test.step('backend network failure cannot produce complete reporting or erase local plan', async () => {
    await page.route(`${stack.baseUrl}/**`, route => route.abort('connectionrefused'));
    await page.getByLabel('Год', { exact: true }).fill('2023');
    await page.getByRole('button',{name:'Загрузить реальную статистику классификации',exact:true}).click();
    await expect(page.getByText(/Полный когерентный источник недоступен или изменился/)).toBeVisible();
    expect(sum((await exportPlan(p)).layers.everyday)).toBe(12345);
    await expect(page.getByText(/Сервер подтвердил сохранение/)).toHaveCount(0);
    await page.unrouteAll(); await assertSources(stack);
  });
});

test('E2E-14 Feature flags alone cannot activate writes without protocol installation', async ({ page, stack }) => {
  await start(page); const review = await selectPrimary(page, stack); const before = await stack.rpc('inspect');
  await test.step('real default bootstrap remains fail-closed even with flags enabled', async () => {
    const legacyStatus = await page.evaluate(async ({baseUrl, operationId}) => {
      const r = await fetch(`${baseUrl}/classifications/expenses/${operationId}/reviews`, {method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')}`},body:'{}'});
      return r.status;
    }, {baseUrl:stack.baseUrl,operationId:stack.primary});
    expect(legacyStatus).toBe(503);

    const response = page.waitForResponse(r => /\/decision$/.test(r.url()) && r.request().method() === 'PUT');
    await review.getByRole('button',{name:'Оставить без классификации',exact:true}).click();
    expect((await response).status()).toBe(503);
    await expect(review.getByText(/Сохранение недоступно/)).toBeVisible();
    await expect(review.getByRole('button', { name: /^(Классифицировать|Сохранить изменения)$/, exact: true })).toBeDisabled();
    const after = await assertSources(stack); expect(after.classifications).toBe(before.classifications); expect(after.primaryRevision).toBeNull();
  });
});
