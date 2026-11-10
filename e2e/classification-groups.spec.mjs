import { test, expect, login, analytics } from './fixture.mjs';
test.use({ groupsV3: true });
const customGroup = async (page, name, dataset = 'expenses') => {
  await page.goto('/profile');
  await page
    .getByRole('link', { name: 'Управление группами доходов и расходов' })
    .click();
  const init = page.getByRole('button', { name: 'Инициализировать каталог' });
  await expect(
    init.or(page.getByRole('button', { name: 'Создать группу', exact: true })),
  ).toBeVisible();
  if (await init.isVisible()) await init.click();
  await page
    .getByRole('tab', {
      name: dataset === 'expenses' ? 'Группы расходов' : 'Группы доходов',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', { name: 'Создать группу', exact: true })
    .click();
  await page.getByLabel('Название группы', { exact: true }).fill(name);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Создать группу', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: `Группа ${name}`, exact: true }),
  ).toBeVisible();
};
const choose = async (page, name, label = 'Группа расходов') => {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page
    .getByRole('listbox')
    .getByRole('option', { name, exact: true })
    .click();
};
const classify = async (page, title, name) => {
  await page
    .getByRole('heading', { name: '15.01.2025', exact: true, level: 2 })
    .locator('..')
    .getByRole('button', { name: title, exact: true })
    .click();
  await choose(page, name);
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === 'PUT' &&
      r.url().includes('/classification-groups/operations/'),
  );
  await page
    .getByRole('button', { name: 'Классифицировать', exact: true })
    .click();
  expect((await response).status()).toBe(200);
  await expect(
    page.getByRole('region', { name: 'Проверка операции', exact: true }),
  ).toHaveCount(0);
};
test('GROUPS-01 catalog CRUD, expense/income assignment, refresh, rename/archive and signed reports', async ({
  page,
  stack,
}) => {
  await test.step('explicit catalog and custom expense/income groups', async () => {
    await login(page);
    await customGroup(page, 'Синтетический автомобиль');
    await customGroup(page, 'Синтетическая подработка', 'incomes');
  });
  await test.step('manual expense PUT persists and survives refresh without source changes', async () => {
    await analytics(page, 'classification');
    await page.getByRole('tab', { name: 'Расходы', exact: true }).click();
    await classify(page, 'Fictional fuel', 'Синтетический автомобиль');
    await page.reload();
    await expect(
      page
        .getByRole('button', { name: 'Fictional fuel', exact: true })
        .first()
        .getByText('Синтетический автомобиль', { exact: true }),
    ).toBeVisible();
    expect((await stack.rpc('inspect')).sourcesUnchanged).toBe(true);
  });
  await test.step('existing source modal opens over a v3 decision; cancel never PATCHes or reloads the period', async () => {
    await page
      .getByRole('button', { name: 'Fictional fuel', exact: true })
      .first()
      .click();
    let patches = 0,
      reports = 0;
    const observe = (r) => {
      if (r.method() === 'PATCH') patches++;
      if (
        r.method() === 'POST' &&
        r.url().endsWith('/classification-groups/report')
      )
        reports++;
    };
    page.on('request', observe);
    await page
      .getByRole('button', { name: 'Редактировать операцию', exact: true })
      .click();
    const modal = page.getByRole('dialog', {
      name: 'Редактировать расход',
      exact: true,
    });
    await expect(modal.getByRole('spinbutton', { name: /^Сумма/ })).toHaveValue('100');
    await modal
      .getByLabel('Комментарий', { exact: true })
      .fill('Синтетическая отмена');
    await modal.getByRole('button', { name: 'close', exact: true }).click();
    await expect(modal).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe('/analytics/classification');
    expect(patches).toBe(0);
    expect(reports).toBe(0);
    page.off('request', observe);
    expect((await stack.rpc('inspect')).sourcesUnchanged).toBe(true);
  });
  await test.step('income group replaces a legacy decision without changing source or sign', async () => {
    await page.getByRole('tab', { name: 'Доходы', exact: true }).click();
    await page
      .getByRole('button', { name: 'Fictional salary', exact: true })
      .first()
      .click();
    await choose(page, 'Синтетическая подработка', 'Группа доходов');
    const response = page.waitForResponse(
      (r) =>
        r.request().method() === 'PUT' &&
        r.url().includes('/classification-groups/operations/incomes/'),
    );
    await page
      .getByRole('button', { name: 'Сохранить изменения', exact: true })
      .click();
    expect((await response).status()).toBe(200);
    expect((await stack.rpc('inspect')).sourcesUnchanged).toBe(true);
  });
  await test.step('rename and archive keep stable references and group statistics', async () => {
    await page.goto('/profile/classification-groups');
    let region = page.getByRole('region', {
      name: 'Группа Синтетический автомобиль',
      exact: true,
    });
    await region.getByRole('button', { name: 'Переименовать' }).click();
    await page.getByLabel('Название группы').fill('Синтетическая семья');
    await page.getByRole('button', { name: 'Сохранить название' }).click();
    region = page.getByRole('region', {
      name: 'Группа Синтетическая семья',
      exact: true,
    });
    await region
      .getByRole('button', { name: 'Архивировать', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Архивировать группу', exact: true })
      .click();
    await expect(region.getByText('В архиве', { exact: true })).toBeVisible();
    await analytics(page, 'classification-stats');
    await expect(
      page.getByText('Синтетическая семья · в архиве', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Синтетическая подработка', { exact: true }),
    ).toBeVisible();
    const response = await page.request.post(
      stack.baseUrl + '/classification-groups/report',
      {
        headers: {
          Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('token'))}`,
        },
        data: {
          version: 'classification-group-report-v3',
          startInclusive: Date.UTC(2025, 0, 1),
          endExclusive: Date.UTC(2026, 0, 1),
          includeOperations: false,
        },
      },
    );
    expect(response.status()).toBe(200);
    const data = (await response.json()).result;
    expect(data.totals.expenses.signedKopecks === -179000).toBe(true);
    expect(data.totals.incomes.signedKopecks === 1205000).toBe(true);
    expect((await stack.rpc('inspect')).sourcesUnchanged).toBe(true);
  });
  await test.step('responsive catalog and owner isolation after logout', async () => {
    await page.goto('/profile/classification-groups');
    await page.setViewportSize({ width: 390, height: 1000 });
    await expect(
      page.getByRole('region', {
        name: 'Группа Синтетическая семья',
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Выйти', exact: true }).click();
    await login(page, 'b');
    await page.goto('/profile/classification-groups');
    await expect(
      page.getByRole('button', { name: 'Инициализировать каталог' }),
    ).toBeVisible();
    await expect(
      page.getByText('Синтетическая семья', { exact: true }),
    ).toHaveCount(0);
  });
});
test('GROUPS-02 v3 rules preview/explicit batch and unknown acknowledgement read-only reconciliation', async ({
  page,
  stack,
}) => {
  await test.step('create a custom target and rule with real v3 etag contract', async () => {
    await login(page);
    await customGroup(page, 'Синтетическая группа');
    await page.goto('/profile/classification-rules');
    await page
      .getByRole('button', { name: 'Добавить правило', exact: true })
      .click();
    await page
      .getByRole('combobox', { name: 'Категория', exact: true })
      .fill('Транспорт');
    await page
      .getByRole('combobox', { name: 'Наименование', exact: true })
      .fill('Fictional fuel');
    await choose(page, 'Синтетическая группа');
    await page.getByRole('button', { name: 'Сохранить правило' }).click();
    await expect(
      page.getByText('Группа: Синтетическая группа', { exact: true }),
    ).toBeVisible();
  });
  await test.step('preview never writes; explicit bounded batch persists one eligible operation', async () => {
    await analytics(page, 'classification');
    await page.getByRole('tab', { name: 'Расходы', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Все (15)', exact: true }),
    ).toBeVisible();
    const before = (await stack.rpc('inspect')).primaryRevision;
    await page
      .getByRole('button', { name: 'Автоматически классифицировать' })
      .click();
    await expect(
      page.getByText('Подходящих операций: 1. Пропущено: 14.', { exact: true }),
    ).toBeVisible();
    expect((await stack.rpc('inspect')).primaryRevision).toBe(before);
    await page
      .getByRole('button', { name: 'Применить к 1 операциям', exact: true })
      .click();
    await expect(
      page.getByText(
        'Успешно: 1. Ошибки/конфликты: 0. Неизвестный результат: 0.',
        { exact: true },
      ),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
    expect((await stack.rpc('inspect')).primaryRevision).toBe(1);
  });
  await test.step('lost acknowledgement keeps card open and only reconcile may observe it', async () => {
    await page
      .getByRole('button', { name: 'Fictional unreviewed', exact: true })
      .click();
    await choose(page, 'Синтетическая группа');
    await stack.rpc('loseAcknowledgement');
    await page
      .getByRole('button', { name: 'Классифицировать', exact: true })
      .click();
    await expect(page.getByText(/Результат записи неизвестен/)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Классифицировать', exact: true }),
    ).toBeDisabled();
    let writes = 0;
    const observe = (r) => {
      if (r.method() === 'PUT') writes++;
    };
    page.on('request', observe);
    await page
      .getByRole('button', { name: 'Сверить результат без повторной записи' })
      .click();
    await expect(
      page.getByRole('region', { name: 'Проверка операции', exact: true }),
    ).toHaveCount(0);
    expect(writes).toBe(0);
    page.off('request', observe);
    expect((await stack.rpc('inspect')).sourcesUnchanged).toBe(true);
  });
});
