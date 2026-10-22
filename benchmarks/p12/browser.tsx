// Isolated benchmark page only; never linked from production navigation.
import { Profiler } from 'react';
import { createRoot } from 'react-dom/client';
import { RecordedStatisticsReport } from '../../src/features/ClassificationStatistics/ui/RealClassificationStatistics';
import { measurePipeline, type Reference } from './entry';
const root = createRoot(document.getElementById('root')!);
const harness = window as typeof window & { p12Run?: (config: { baseUrl: string; bearer: string; owner: string; reference: Reference }) => Promise<unknown> };
harness.p12Run = async config => {
  let longestHeartbeatGapMilliseconds = 0, previous = performance.now(), sampledHeapPeakBytes: number | null = null;
  let parseMilliseconds = 0, fetchMilliseconds = 0, jsonBytes = 0, calls = 0, membership = 0, classification = 0, active = 0, peak = 0;
  const timer = setInterval(() => {
    const now = performance.now(); longestHeartbeatGapMilliseconds = Math.max(longestHeartbeatGapMilliseconds, now - previous); previous = now;
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    if (memory) sampledHeapPeakBytes = Math.max(sampledHeapPeakBytes ?? 0, memory.usedJSHeapSize);
  }, 10);
  try {
    const result = await measurePipeline(async request => {
      calls++; if (request.method === 'GET') membership++; else classification++;
      active++; peak = Math.max(peak, active); const start = performance.now();
      try {
        const response = await fetch(config.baseUrl + request.url, { method: request.method, cache: 'no-store', signal: AbortSignal.timeout(10000),
          headers: { Authorization: `Bearer ${config.bearer}`, ...(request.body ? { 'Content-Type': 'application/json' } : {}) },
          ...(request.body ? { body: JSON.stringify(request.body) } : {}) });
        if (!response.ok) throw Error('PERFORMANCE_HTTP_UNAVAILABLE');
        const text = await response.text(); fetchMilliseconds += performance.now() - start; jsonBytes += new TextEncoder().encode(text).length;
        const parseStart = performance.now(); const value: unknown = JSON.parse(text); parseMilliseconds += performance.now() - parseStart; return value;
      } finally { active--; }
    }, config.owner, config.reference);
    let reactActualMilliseconds = 0;
    await new Promise<void>(resolve => {
      root.render(<Profiler id="p12" onRender={(_id, _phase, actual) => { reactActualMilliseconds += actual; requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }}>
        <RecordedStatisticsReport cohort={result.cohort} /></Profiler>);
    });
    root.render(null);
    return { ...result.metrics, requests: { total: calls, membership, classification, peak }, jsonBytes, parseMilliseconds,
      fetchCumulativeMilliseconds: fetchMilliseconds, reactActualMilliseconds, sampledHeapPeakBytes, longestHeartbeatGapMilliseconds };
  } finally { clearInterval(timer); root.render(null); }
};
