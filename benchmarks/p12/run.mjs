import { fork, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { timingPlugin } from './instrument.mjs';
const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2), option = (name, fallback) => { const at = args.indexOf(name); return at === -1 ? fallback : args[at + 1]; };
const sizes = option('--sizes', '100,1000,10000').split(',').map(Number), repetitions = Number(option('--repetitions', '3'));
const backend = path.resolve(option('--backend', path.join(root, '../digit-budget-calculator-api'))), browserMode = args.includes('--browser');
if (process.versions.node.split('.')[0] !== '22' || !sizes.length || sizes.some(n => ![100, 1000, 10000, 50000].includes(n))
  || !Number.isInteger(repetitions) || repetitions < 1 || repetitions > 5 || sizes.includes(50000) && (!args.includes('--xl') || repetitions !== 1))
  throw Error('Bounded Node22 benchmark options required; XL explicitly requires --xl --repetitions 1');
const percentile = (a, p) => [...a].sort((a, b) => a - b)[Math.max(0, Math.ceil(a.length * p) - 1)];
const bounded = async (promise, ms) => { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('PERFORMANCE_DEADLINE')), ms); })]); } finally { clearTimeout(timer); } };
async function child(count) {
  const c = fork(path.join(backend, 'benchmarks/p12/backend.cjs'), [], { cwd: backend, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: { ...process.env, BUDGET_PERFORMANCE_TEST: '1' } });
  const exited = once(c, 'exit'); let id = 0, ready, fail; const pending = new Map();
  const startup = new Promise((resolve, reject) => { ready = resolve; fail = reject; });
  c.on('message', m => {
    if (m.type === 'ready') ready(m);
    if (m.type === 'reply') { pending.get(m.id)?.resolve(m.value); pending.delete(m.id); }
    if (m.type === 'failure') { fail(Error('PERFORMANCE_FIXTURE_UNAVAILABLE/' + (['guard','harness','seed','seed_manifest','seed_blueprints','seed_sources','seed_decisions','bson','monitor','reset','stats','explain','close'].includes(m.stage) ? m.stage : 'unknown') + '_' + (['validator','duplicate','assertion','other'].includes(m.kind) ? m.kind : 'unknown'))); for (const p of pending.values()) p.reject(Error('PERFORMANCE_FIXTURE_UNAVAILABLE/' + (['guard','harness','seed','seed_manifest','seed_blueprints','seed_sources','seed_decisions','bson','monitor','reset','stats','explain','close'].includes(m.stage) ? m.stage : 'unknown') + '_' + (['validator','duplicate','assertion','other'].includes(m.kind) ? m.kind : 'unknown'))); pending.clear(); }
  });
  c.on('exit', () => { fail(Error('PERFORMANCE_FIXTURE_EXITED')); for (const p of pending.values()) p.reject(Error('PERFORMANCE_FIXTURE_EXITED')); pending.clear(); });
  const rpc = (command, extra = {}) => bounded(new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); c.send({ command, id: key, ...extra }); }), 60000);
  try { c.send({ command: 'start', count }); const info = await bounded(startup, 120000);
    return { ...info, rpc, async close() { const result = await rpc('close'); if (!result.cleanupVerified || !result.sourceBsonUnchanged) throw Error('PERFORMANCE_CLEANUP_FAILED');
      const [code, signal] = await bounded(exited, 15000); if (code !== 0 || signal !== null) throw Error('PERFORMANCE_PROCESS_FAILED'); return result; } };
  } catch (error) { c.kill('SIGTERM'); await bounded(exited, 15000); throw error; }
}
const vite = await createServer({ root, configFile: false, envDir: false, logLevel: 'silent', plugins: [react(), timingPlugin(), tsconfigPaths()],
  server: browserMode ? { host: '127.0.0.1', port: 5173, strictPort: true } : { middlewareMode: true } });
let browser, stage = 'vite';
const output = { version: 'p12-performance-v1', mode: browserMode ? 'chromium' : 'node-ssr',
  frontendSHA: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  backendSHA: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: backend, encoding: 'utf8' }).trim(),
  node: process.version, containerLimits: Object.fromEntries(['memory.max', 'cpu.max'].map(name => { try { return [name, fs.readFileSync('/sys/fs/cgroup/' + name, 'utf8').trim()]; } catch { return [name, 'UNMEASURED']; } })), host: { architecture: os.arch(), cpu: os.cpus()[0]?.model, logicalCPUs: os.availableParallelism(), totalMemoryBytes: os.totalmem() },
  profiles: [], memoryMethod: '10ms sampled heap; backend maxRSS includes setup; not exact transient peaks',
  coldMethod: 'first pipeline after seeding (DB cache NOT cold); later repetitions warm; no OS cache eviction',
  caveat: 'Local/CI synthetic data, not home Ubuntu performance. Cumulative overlapping request times are not wall latency.' };
try {
  let engine;
  if (browserMode) { await vite.listen(); const { chromium } = await import('@playwright/test'); browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, headless: true, args: ['--enable-precise-memory-info'] }); output.browser = browser.version(); }
  else engine = await vite.ssrLoadModule('/benchmarks/p12/entry.ts');
  for (const count of sizes) {
    let b, page, heapTimer; const profile = { count, runs: [], queryPlans: {}, cleanup: false };
    try {
      stage = 'fixture'; b = await child(count); profile.versions = b.versions;
      stage = 'query-plan'; profile.queryPlans.baseline = await b.rpc('explain');
      if (browserMode) { page = await browser.newPage(); const allowed = new Set(['http://localhost:5173', b.baseUrl]);
        await page.route('**/*', route => allowed.has(new URL(route.request().url()).origin) ? route.continue() : route.abort('blockedbyclient'));
        await page.goto('http://localhost:5173/benchmarks/p12/index.html'); await page.waitForFunction(() => typeof window.p12Run === 'function'); }
      for (let r = 0; r < repetitions; r++) {
        stage = 'reset'; await b.rpc('reset'); stage = 'pipeline'; let metrics;
        if (browserMode) metrics = await bounded(page.evaluate(config => window.p12Run(config), { baseUrl: b.baseUrl, bearer: b.bearer, owner: b.owner, reference: b.reference }), 300000);
        else {
          let calls = 0, membership = 0, classification = 0, active = 0, peak = 0, bytes = 0, parseMilliseconds = 0, fetchMilliseconds = 0;
          let sampledHeapPeakBytes = process.memoryUsage().heapUsed; const cpu = process.cpuUsage();
          heapTimer = setInterval(() => { sampledHeapPeakBytes = Math.max(sampledHeapPeakBytes, process.memoryUsage().heapUsed); }, 10);
          const result = await bounded(engine.measurePipeline(async req => {
            calls++; if (req.method === 'GET') membership++; else classification++; active++; peak = Math.max(peak, active); const start = performance.now();
            try {
              const response = await fetch(b.baseUrl + req.url, { method: req.method, cache: 'no-store', headers: { Authorization: `Bearer ${b.bearer}`,
                ...(req.body ? { 'Content-Type': 'application/json' } : {}) }, ...(req.body ? { body: JSON.stringify(req.body) } : {}), signal: AbortSignal.timeout(10000) });
              if (!response.ok) throw Error('PERFORMANCE_HTTP_UNAVAILABLE'); const text = await response.text(); fetchMilliseconds += performance.now() - start; bytes += Buffer.byteLength(text);
              const at = performance.now(); const value = JSON.parse(text); parseMilliseconds += performance.now() - at; return value;
            } finally { active--; }
          }, b.owner, b.reference), 300000);
          clearInterval(heapTimer); metrics = { ...result.metrics, requests: { total: calls, membership, classification, peak }, jsonBytes: bytes, parseMilliseconds,
            fetchCumulativeMilliseconds: fetchMilliseconds, sampledHeapPeakBytes: Math.max(sampledHeapPeakBytes, process.memoryUsage().heapUsed), cpuMicroseconds: process.cpuUsage(cpu), reactActualMilliseconds: 'UNMEASURED' };
        }
        const backendMetrics = await b.rpc('stats');
        if (backendMetrics.mongo['operation_classifications/find']?.count !== Math.ceil(count / 100)) throw Error('PERFORMANCE_MONITOR_UNAVAILABLE');
        const expectedMembership = 2 * (Math.max(1, Math.ceil(b.reference.counts.expenses / 100)) + Math.max(1, Math.ceil(b.reference.counts.incomes / 100)));
        if (metrics.requests.membership !== expectedMembership || metrics.requests.classification !== Math.ceil(count / 100) || metrics.requests.peak > 4 || metrics.uniqueOperations !== count || metrics.financialInvariants !== true) throw Error('PERFORMANCE_DETERMINISTIC_BUDGET');
        profile.runs.push({ temperature: r ? 'warm' : 'first-after-seed', ...metrics, backend: backendMetrics });
      }
      if (args.includes('--query-indexes')) profile.queryPlans.proposedDisposableIndexes = await b.rpc('explain', { indexed: true });
    } finally { clearInterval(heapTimer); await page?.close(); if (b) profile.cleanup = await b.close(); }
    const latencies = profile.runs.map(r => r.loadingMilliseconds);
    profile.latencyMs = { p50: percentile(latencies, .5), p95: repetitions >= 3 ? percentile(latencies, .95) : 'UNMEASURED (n<3)', max: Math.max(...latencies), repetitions };
    output.profiles.push(profile); process.stdout.write(`P12 ${output.mode} ${count}: verified ${repetitions} run(s), cleanup verified\n`);
  }
  const target = path.resolve(option('--output', path.join(root, 'benchmark-results/p12.json'))); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, JSON.stringify(output, null, 2) + '\n');
} catch (error) { const code = error instanceof Error && /^PERFORMANCE_[A-Z_]+(?:\/[a-z_]+)?$/.test(error.message) ? error.message : 'DETAILS_SUPPRESSED';
  process.stderr.write(`P12 benchmark failed at ${stage}: ${code}.\n`); process.exitCode = 1; }
finally { await browser?.close(); await vite.close(); }
