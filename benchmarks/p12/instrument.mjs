// Test-only Vite transform. Original validation code is unmodified; wrappers only
// measure cumulative synchronous time. Identical instrumentation for before/after.
export const timingPlugin = () => ({ name: 'p12-validation-timings', enforce: 'pre',
  transform(source, id) {
    const targets = id.endsWith('/HistoricalClassification/model/history.ts') ? ['validateOwnedHistory']
      : id.endsWith('/HistoricalClassification/model/coherentHistory.ts') ? ['parseSourceFacts']
        : id.endsWith('/HistoricalClassification/model/contract.ts') ? ['validateClassificationRead'] : [];
    for (const name of targets) {
      const anchor = `export const ${name} =`;
      if (!source.includes(anchor)) throw Error('Performance instrumentation source mismatch');
      source = source.replace(anchor, `const __p12_${name} =`);
      source += `\nexport const ${name}: typeof __p12_${name} = (...args) => {
        const start = performance.now();
        try { return __p12_${name}(...args); } finally {
          const target = globalThis as typeof globalThis & { __p12Timings?: Record<string, number> };
          const timings = target.__p12Timings ??= {};
          timings['${name}Calls'] = (timings['${name}Calls'] ?? 0) + 1;
          timings['${name}'] = (timings['${name}'] ?? 0) + performance.now() - start;
        }
      };\n`;
    }
    return targets.length ? { code: source, map: null } : undefined;
  },
});
