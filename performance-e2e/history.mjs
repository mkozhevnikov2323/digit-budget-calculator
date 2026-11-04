import { test, expect, login, analytics, statistics } from '../e2e/fixture.mjs';

// Delay delivery of one ACTUAL fetch response. No response mocking, body rewrite
// or authentication bypass: Express/MongoDB have already served the request.
async function hold(page) {
  await page.evaluate(() => {
    const original = window.fetch.bind(window); let armed = true, release;
    const wait = new Promise(resolve => { release = resolve; });
    window.__p12Release = release; window.__p12Observed = false;
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (armed && response.url.endsWith('/classifications/history/read')) {
        armed = false; window.__p12Observed = true; await wait;
      }
      return response;
    };
  });
}
const observed = page => page.waitForFunction(() => window.__p12Observed === true);
const release = page => page.evaluate(() => window.__p12Release());
const table = page => page.getByRole('table', { name: 'Группы расходов', exact: true });
const start = async page => {
  await login(page); await analytics(page,'classification-stats');
  const expenses=page.getByRole('region',{name:'Расходы',exact:true});
  await expect(expenses).toContainText('1790,00 ₽');
  // With automatic loading, arm the real-response delay BEFORE selecting the
  // target year. Finish the intermediate period so no unrelated read is held.
  await page.getByLabel('Год',{exact:true}).fill('2024');
  await expect(expenses).toContainText('999,00 ₽');
  await hold(page);await page.getByLabel('Год',{exact:true}).fill('2025');await observed(page);
};

test('P12-01 Source edit after a real batch prevents complete report publication', async ({ page, stack }) => {
  await start(page);
  await expect(page.getByRole('status').filter({ hasText: 'Загрузка статистики' })).toBeVisible();
  await expect(table(page)).toHaveCount(0);
  await stack.rpc('changeSource'); await release(page);
  await expect(page.getByText(/Не удалось загрузить статистику/)).toBeVisible();
  await expect(table(page)).toHaveCount(0); expect((await stack.rpc('inspect')).sourcesUnchanged).toBe(true);
});

test('P12-02 Logout and owner switch reject a late financial response', async ({ page, stack }) => {
  await start(page); await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await release(page); await login(page, 'b'); await analytics(page); await statistics(page);
  const section = page.getByRole('region', { name: 'Расходы', exact: true });
  await expect(section).toContainText('777,00 ₽'); await expect(section).not.toContainText('1790,00 ₽');
  expect((await stack.rpc('inspect')).sourcesUnchanged).toBe(true);
});

test('P12-03 Reporting period change cannot publish old annual totals', async ({ page, stack }) => {
  await start(page); await page.getByLabel('Год', { exact: true }).fill('2024'); await release(page);
  await expect(table(page)).toBeVisible();
  const section = page.getByRole('region', { name: 'Расходы', exact: true });
  await expect(section).toContainText('999,00 ₽'); await expect(section).not.toContainText('1790,00 ₽');
  expect((await stack.rpc('inspect')).sourcesUnchanged).toBe(true);
});

test('P12-04 Leaving a loading report hides late totals and reopening validates afresh', async ({ page, stack }) => {
  await start(page); await analytics(page,'categories');
  await release(page); await expect(table(page)).toHaveCount(0);
  await statistics(page); await expect(page.getByRole('region', { name: 'Расходы', exact: true })).toContainText('1790,00 ₽');
  expect((await stack.rpc('inspect')).sourcesUnchanged).toBe(true);
});

test('P12-05 Independent tabs share no in-flight publication or partial totals', async ({ page, context, stack }) => {
  await start(page); const second = await context.newPage();
  try { await analytics(second); await statistics(second); await expect(table(page)).toHaveCount(0);
    await expect(table(second)).toBeVisible(); await release(page); await expect(table(page)).toBeVisible();
    for (const tab of [page, second]) await expect(tab.getByRole('region', { name: 'Расходы', exact: true })).toContainText('1790,00 ₽');
  } finally { await second.close(); }
  expect((await stack.rpc('inspect')).sourcesUnchanged).toBe(true);
});

test('P12-06 A real financial PATCH in one tab invalidates another tab final observation', async ({ page, context, stack }) => {
  await start(page); const editor = await context.newPage();
  try {
    await analytics(editor);
    const status = await editor.evaluate(async ({ baseUrl, id }) => {
      const response = await fetch(`${baseUrl}/expenses/${id}`, { method: 'PATCH', headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 101, date: '2025-01-15T12:00:00.000Z', category: 'Транспорт', title: 'Fictional fuel', recipient: 'Fictional station', comment: '' }) });
      return response.status;
    }, { baseUrl: stack.baseUrl, id: stack.primary });
    expect(status).toBe(200); await release(page);
    await expect(page.getByText(/Не удалось загрузить статистику/)).toBeVisible();
    await expect(table(page)).toHaveCount(0);
    expect((await stack.rpc('inspect')).primaryRevision).toBeNull();
  } finally { await editor.close(); }
});
