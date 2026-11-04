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
    execArgv: ['--require', path.join(root, 'e2e/c-preload.cjs')],
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
  context: async ({ context, stack }, use) => {
    // Fail closed if frontend configuration ever points outside this test stack.
    const allowed = new Set(['http://localhost:5173', stack.baseUrl]);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return allowed.has(url.origin) ? route.continue() : route.abort('blockedbyclient');
    });
    await use(context);
  },
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
export const layerName = layer => ({everyday:'Повседневные расходы',irregular:'Нерегулярные расходы',emergency:'Непредвиденные расходы',major_goals:'Крупные цели',long_term_capital:'Долгосрочный капитал',reserve:'Резерв'}[layer]);
export async function analytics(page, section='overview') {
  const destinations={overview:['/analytics','Расширенная аналитика'],categories:['/analytics/categories','Операции по категориям'],classification:['/analytics/classification','Классификация'],'classification-stats':['/analytics/classification-stats','Статистика классификации'],planning:['/analytics/planning','Планирование бюджета']};
  const [url,label]=destinations[section];
  if(new URL(page.url()).pathname!==url){
    if(await page.getByRole('tab',{name:label,exact:true}).count())await page.getByRole('tab',{name:label,exact:true}).click();
    else await page.goto(url);
  }
  await expect(page.getByRole('heading',{name:section==='overview'?'Финансовая аналитика':label,exact:true,level:1})).toBeVisible();
  await page.getByLabel('Период',{exact:true}).selectOption('year');
  await page.getByLabel('Год',{exact:true}).fill('2025');
  if(section==='overview')await expect(page.getByRole('table',{name:'Помесячный денежный поток'})).toBeVisible();
}
export async function selectOperation(page, id) {
  const income=id==='0000000000000000000000c8';
  await page.getByRole('tab',{name:income?'Доходы':'Расходы',exact:true}).click();
  const title=income?'Fictional salary':id==='2'.repeat(24)?'Fictional unreviewed':id==='b1'.padStart(24,'0')?'User B private fixture':'Fictional fuel';
  const group=page.getByRole('heading',{name:'15.01.2025',exact:true,level:2}).locator('..');
  await group.getByRole('button',{name:title,exact:true}).click();
  await expect(page.getByLabel('Тип операции',{exact:true})).toBeVisible();
}
export async function selectPrimary(page, stack) {
  await analytics(page,'classification'); await selectOperation(page,stack.primary);
  return page.getByRole('region',{name:'Сохранение ручной классификации'});
}
export async function chooseClassification(page, review) {
  const role=page.getByLabel('Тип операции',{exact:true});
  const current=await role.inputValue();
  if(!current)await role.selectOption('ordinary_expense');
  if(await role.inputValue()==='ordinary_expense') {
    const layer=page.getByLabel('Группа расходов',{exact:true});
    if(await review.getByRole('button',{name:'Отмена',exact:true}).isDisabled())await layer.selectOption(await layer.inputValue()==='everyday'?'irregular':'everyday');
    else if(!await layer.inputValue())await layer.selectOption('everyday');
  } else if(await review.getByRole('button',{name:'Отмена',exact:true}).isDisabled())await role.selectOption(current==='refund'?'ordinary_income':'refund');
  await expect(review.getByRole('button',{name:/^(Классифицировать|Сохранить изменения)$/,exact:true})).toBeEnabled();
  await expect(review.getByRole('checkbox')).toHaveCount(0);
}
export async function reopenAfterSave(page, operationId) {
  await expect(page.getByRole('region',{name:'Проверка операции'})).toHaveCount(0);
  let reads=0;const observe=r=>{if(r.method()==='GET')reads++;};page.on('request',observe);
  await selectOperation(page, operationId);
  expect(reads).toBe(0);page.off('request',observe);
  await expect(page.getByRole('button',{name:/^(Классифицировать|Сохранить изменения)$/,exact:true})).toBeDisabled();
}
export async function save(page, review) {
  const response = page.waitForResponse(r => /\/decision$/.test(r.url()) && r.request().method() === 'PUT');
  await review.getByRole('button', { name: /^(Классифицировать|Сохранить изменения)$/, exact: true }).click();
  const acknowledgement = await response;
  expect(acknowledgement.status()).toBe(201);
  await reopenAfterSave(page, acknowledgement.url().split('/').at(-2));
}
export async function statistics(page, mode='statistics') {
  await analytics(page,mode==='planning'?'planning':'classification-stats');
  const load=page.getByRole('button',{name:'Загрузить реальную статистику классификации',exact:true});
  if(mode==='planning'&&await load.count())await load.click();
  if(mode==='planning') {await expect(page.getByRole('region',{name:'Прогноз по записанной истории'})).toBeVisible();return page.getByRole('region',{name:'Прогноз по записанной истории'});}
  await expect(page.getByRole('table',{name:'Группы расходов'})).toBeVisible();
  return page.getByRole('region',{name:'Расходы',exact:true});
}
export async function confirmMonths(region, count = 12) {
  for(let i=1;i<=count;i++){
    const month=new Intl.DateTimeFormat('ru-RU',{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(Date.UTC(2025,i-1,1)));
    await region.getByRole('checkbox',{name:`Подтверждаю полноту записи ${month}`,exact:true}).check();
  }
}
export async function plan(page) {
  if(new URL(page.url()).pathname!=='/analytics/planning')await analytics(page,'planning');
  const open=page.getByRole('button',{name:'Открыть локальный план',exact:true});if(await open.count())await open.click();
  return page.getByRole('region',{name:'Локальный план бюджета'});
}
export async function distribute(region,layer,rubles){
 await region.getByLabel(`Новая годовая сумма ${layerName(layer)}`,{exact:true}).fill(rubles);
 await region.getByRole('button',{name:`Распределить ${layerName(layer)} по 12 месяцам`,exact:true}).click();
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

// Browser-only synthetic pagination fixture. No records are written to MongoDB;
// responses cross the same production membership/batch validators as real reads.
export async function checkClassificationNavigation(page, stack) {
  const rows=Array.from({length:105},(_,i)=>({_id:(10000+i).toString(16).padStart(24,'0'),owner:stack.owners.a,amount:1,date:new Date(Date.UTC(2025,0,15,12,0,0,i)).toISOString(),category:'Synthetic category',title:`Synthetic expense ${i}`,recipient:'Synthetic'}));
  const byId=new Map(rows.map(r=>[r._id,r]));let reads=0,individual=0;
  const route=async route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.method()==='GET'&&['/expenses','/incomes'].includes(url.pathname)){
      reads++;const data=url.pathname==='/expenses'?rows:[],dataset=url.pathname.slice(1),number=Number(url.searchParams.get('page')),limit=Number(url.searchParams.get('limit'));
      await route.fulfill({headers:{'Access-Control-Allow-Origin':'http://localhost:5173'},json:{[dataset]:data.slice((number-1)*limit,number*limit),total:data.length,page:number,limit}});return;
    }
    if(request.method()==='POST'&&url.pathname==='/classifications/history/read'){
      reads++;const body=request.postDataJSON();const operations=body.operations.map(identity=>{const row=byId.get(identity.operationId);return {...identity,facts:{amount:{format:'binary64-roundtrip-decimal',value:'1'},dateEpochMs:Date.parse(row.date),date:row.date,category:row.category,title:row.title,recipient:row.recipient,comment:{kind:'missing'}},classification:{version:'classification-read-v1',...identity,status:'unreviewed',storedState:null,decisionRevision:null,confirmed:null,consistency:'observed_only_non_atomic'}};});
      await route.fulfill({headers:{'Access-Control-Allow-Origin':'http://localhost:5173'},json:{version:'classification-history-read-v1',window:{startInclusive:body.startInclusive,endExclusive:body.endExclusive},coverage:'requested_identities_only',consistency:'observed_only_non_atomic',returnedCount:operations.length,operations}});return;
    }
    if(request.method()==='GET'&&/^\/classifications\//.test(url.pathname))individual++;
    await route.fallback();
  };
  await page.route(`${stack.baseUrl}/**`,route);
  try {
    await analytics(page,'classification');await page.getByRole('tab',{name:'Расходы',exact:true}).click();
    await expect(page.getByRole('button',{name:'Все (105)',exact:true})).toBeVisible();
    const initial=reads;await page.getByRole('button',{name:'Перейти на страницу 4',exact:true}).click();
    await expect(page.getByRole('button',{name:'Synthetic expense 75',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Перейти на страницу 5',exact:true}).click();await expect(page.getByRole('button',{name:'Synthetic expense 100',exact:true})).toBeVisible();
    await page.goBack();await expect(page.getByRole('button',{name:'Synthetic expense 75',exact:true})).toBeVisible();
    expect(reads).toBe(initial);expect(individual).toBe(0);
    await page.reload();await expect(page.getByRole('button',{name:'Synthetic expense 75',exact:true})).toBeVisible();expect(new URL(page.url()).searchParams.get('page')).toBe('4');
    const afterReload=reads;await page.getByRole('button',{name:'Не классифицировано (105)',exact:true}).click();
    await expect(page.getByRole('button',{name:'Synthetic expense 0',exact:true})).toBeVisible();expect(new URL(page.url()).searchParams.get('page')).toBe('1');
    for(const width of [1440,390,320]){
      await page.setViewportSize({width,height:1000});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);expect(overflow).toBe(false);
    }
    expect(reads).toBe(afterReload);expect(individual).toBe(0);
  }finally{await page.unroute(`${stack.baseUrl}/**`,route);await page.setViewportSize({width:1440,height:1000});}
}
