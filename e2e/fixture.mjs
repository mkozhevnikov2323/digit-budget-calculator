import { test as base, expect } from '@playwright/test';
import { fork, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { once } from 'node:events';
import path from 'node:path';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
export const backendRoot = path.resolve(process.env.BUDGET_E2E_BACKEND ?? path.join(root, '../digit-budget-calculator-api'));
const bounded = async (promise, ms, label) => {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`E2E lifecycle timeout: ${label}`)), ms);
  })]); } finally { clearTimeout(timer); }
};
async function startBackend(defaultOff) {
  const manifest = JSON.parse(fs.readFileSync(new URL('./backend-revision.json', import.meta.url), 'utf8'));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: backendRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  expect(head === manifest.commit, 'Backend must be at the reviewed immutable revision').toBe(true);
  const child = fork(path.join(backendRoot, 'tests/browser/server.cjs'), [], {
    cwd: backendRoot, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: { ...process.env, BUDGET_BROWSER_TEST: '1', BUDGET_BROWSER_DEFAULT_OFF: defaultOff ? '1' : '0' },
  });
  const exited = once(child, 'exit'); let sequence = 0; const pending = new Map();
  let readyResolve, readyReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  child.on('message', message => {
    if (message.type === 'ready') readyResolve(message);
    else if (message.type === 'reply') { pending.get(message.id)?.resolve(message.result); pending.delete(message.id); }
    else if (message.type === 'failure') {
      const error = new Error('Isolated backend failed; private details suppressed');
      readyReject(error); pending.get(message.id)?.reject(error); pending.delete(message.id);
    }
  });
  child.on('exit', () => {
    const error = new Error('Isolated backend exited before verified lifecycle completion');
    readyReject(error); for (const task of pending.values()) task.reject(error); pending.clear();
  });
  const rpc = (command) => bounded(new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject });
    child.send({ id, command }, error => { if (error) { pending.delete(id); reject(new Error('Fixture IPC unavailable')); } });
  }), 15000, command);
  try {
    const info = await bounded(ready, 25000, 'backend startup');
    return { ...info, rpc, async close() {
      const result = await rpc('close'); expect(result.cleanupVerified).toBe(true);
      const [code, signal] = await bounded(exited, 15000, 'backend shutdown');
      expect(code).toBe(0); expect(signal).toBeNull();
    } };
  } catch (error) {
    if (child.connected) child.kill('SIGTERM');
    await bounded(exited, 15000, 'failed startup cleanup'); throw error;
  }
}
export const test = base.extend({
  stack: async ({}, use, testInfo) => {
    let backend, vite;
    try {
      backend = await startBackend(testInfo.title.startsWith('E2E-14'));
      vite = await createServer({ root, envDir: false, logLevel: 'silent',
        define: { 'import.meta.env.VITE_API_URL': JSON.stringify(backend.baseUrl) },
        server: { host: '127.0.0.1', port: 5173, strictPort: true, open: false },
      });
      await bounded(vite.listen(), 15000, 'Vite startup');
      await use(backend);
    } finally {
      const failures = [];
      if (vite) try { await bounded(vite.close(), 10000, 'Vite shutdown'); } catch { failures.push('Vite'); }
      if (backend) try { await backend.close(); } catch { failures.push('MongoDB/Express cleanup'); }
      expect(failures, 'Every owned resource must close and MongoDB cleanup must verify').toEqual([]);
      testInfo.annotations.push({ type: 'stack-cleanup', description: 'MongoDB dropped/empty/disconnected; Express/logs/Vite closed' });
    }
  },
});
export { expect };
export async function login(page, user = 'a') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Вход / Регистрация', exact: true }).click();
  await page.getByRole('textbox', { name: 'Электронная почта' }).fill(`browser-${user}@example.com`);
  await page.getByLabel(/^Пароль/).fill('Fictional-browser-account-42!');
  expect(await page.getByLabel(/^Пароль/).inputValue() === 'Fictional-browser-account-42!').toBe(true);
  const loginResponse = page.waitForResponse(r => r.url().endsWith('/signin') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/expenses$/);
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
}
export async function analytics(page) {
  await page.goto('/analytics');
  await expect(page.getByRole('heading', { name: 'Финансовая аналитика', exact: true })).toBeVisible();
  await page.getByLabel('Период', { exact: true }).selectOption('year');
  await page.getByLabel('Год', { exact: true }).fill('2025');
  await expect(page.getByRole('table', { name: 'Помесячный денежный поток' })).toBeVisible();
}
export async function selectPrimary(page, stack) {
  await page.getByRole('button', { name: 'Классификация исторических операций', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(stack.primary) }).click();
  await expect(page.getByRole('region', { name: 'Проверка операции' }).getByText(/Ревизия:/)).toBeVisible();
  return page.getByRole('region', { name: 'Сохранение ручной классификации' });
}
export async function prepare(page, review) {
  await review.getByRole('button', { name: 'Подготовить серверную проверку', exact: true }).click();
  await expect(review.getByRole('heading', { name: 'Факты, проверенные сервером для этого решения' })).toBeVisible();
  await expect(review.getByRole('button', { name: 'Сохранить классификацию на сервере', exact: true })).toBeDisabled();
  await review.getByRole('checkbox', { name: 'Я проверил(а) именно серверные факты и явно подтверждаю новое решение', exact: true }).check();
}
export async function reopenAfterSave(page, operationId) {
  await expect(page.getByRole('region', { name: 'Проверка операции' })).toHaveCount(0);
  await page.getByRole('button', { name: new RegExp(operationId) }).click();
  await expect(page.getByRole('region', { name: 'Проверка операции' }).getByText(/Ревизия: 1/)).toBeVisible();
}
export async function save(page, review) {
  const response = page.waitForResponse(r => /\/commands$/.test(r.url()) && r.request().method() === 'POST');
  await review.getByRole('button', { name: 'Сохранить классификацию на сервере', exact: true }).click();
  const acknowledgement = await response;
  expect(acknowledgement.status()).toBe(201);
  await reopenAfterSave(page, acknowledgement.url().split('/').at(-2));
}
export async function statistics(page) {
  await page.getByRole('button', { name: 'Загрузить реальную статистику классификации', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Статусы и роли expenses' })).toBeVisible();
  return page.getByRole('region', { name: 'Прогноз по записанной истории' });
}
export async function confirmMonths(region, count = 12) {
  for (let i = 1; i <= count; i++) await region.getByRole('checkbox', { name: new RegExp(`Подтверждаю полноту записи 2025-${String(i).padStart(2, '0')}$`) }).check();
}
export async function plan(page) {
  await page.getByRole('button', { name: 'Открыть локальный план', exact: true }).click();
  return page.getByRole('region', { name: 'Локальный план бюджета' });
}
export async function distribute(region, layer, rubles) {
  await region.getByLabel(`Новая годовая сумма ${layer}`, { exact: true }).fill(rubles);
  await region.getByRole('button', { name: `Распределить ${layer} по 12 месяцам`, exact: true }).click();
}
export async function exportPlan(region) {
  await region.getByRole('button', { name: 'Экспортировать JSON по запросу', exact: true }).click();
  return JSON.parse(await region.getByLabel('Экспорт JSON — скопируйте явно', { exact: true }).inputValue());
}
export const sum = values => values.reduce((total, n) => { expect(Number.isSafeInteger(n)).toBe(true); return total + n; }, 0);

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus && !page.isClosed()) {
    fs.mkdirSync('e2e-results/screenshots', { recursive: true });
    await page.screenshot({ path: `e2e-results/screenshots/${testInfo.title.slice(0, 6)}.png`,
      mask: [page.locator('input, textarea')], fullPage: false });
  }
});
