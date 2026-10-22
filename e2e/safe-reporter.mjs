import fs from 'node:fs';
// No raw Playwright errors, attachments, HTTP traces or DOM snapshots in CI.
// Assertion locations + named steps identify the failure without credentials.
const xml = value => String(value).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
export default class SafeReporter {
  results = []; expected = 0; steps = new Map(); fatal = false;
  onBegin(_config, suite) { this.expected = suite.allTests().length; }
  onStepBegin(test, _result, step) { if (step.category === 'test.step') this.steps.set(test.id, step.title); }
  onTestEnd(test, result) {
    const cleanupVerified = test.annotations.some(a => a.type === 'stack-cleanup');
    const pass = result.status === 'passed' && result.retry === 0 && cleanupVerified;
    const item = { name: test.title, pass, cleanupVerified, status: result.status, milliseconds: result.duration,
      step: this.steps.get(test.id) ?? 'fixture or browser assertion',
      line: result.errors[0]?.stack?.match(/financial-cycle\.spec\.mjs:\d+:\d+/)?.[0] ?? null,
      diagnostic: result.errors.flatMap(e => e.message?.match(/strict mode violation|Timeout \d+ms exceeded|Test timeout of \d+ms exceeded|toBeVisible|toHaveCount|toBeEnabled|toBeDisabled|toBe\b|toEqual|E2E lifecycle timeout|Isolated backend failed/g) ?? []).join(', ') };
    this.results.push(item);
    process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${item.name}${pass ? '' : ` [${item.step}; ${item.diagnostic}; ${item.line}; details suppressed]`}\n`);
  }
  onError() { this.fatal = true; process.stderr.write('Browser runner error; private details suppressed.\n'); }
  onEnd(result) {
    const passed = this.results.filter(x => x.pass).length;
    const complete = !this.fatal && result.status === 'passed' && this.expected === 14
      && this.results.length === this.expected && passed === this.expected;
    fs.mkdirSync('e2e-results', { recursive: true });
    fs.writeFileSync('e2e-results/summary.json', JSON.stringify({ version: 1, expected: 14,
      executed: this.results.length, passed, complete, tests: this.results }, null, 2));
    fs.writeFileSync('e2e-results/junit.xml', `<?xml version="1.0"?><testsuite name="real-full-stack-chromium" tests="${this.results.length + (complete ? 0 : 1)}" failures="${this.results.filter(x => !x.pass).length + (complete ? 0 : 1)}">${this.results.map(x => `<testcase name="${xml(x.name)}" time="${x.milliseconds / 1000}">${x.pass ? '' : `<failure message="${xml(x.step)}">Private details suppressed; assertion line ${x.line ?? 'unavailable'}.</failure>`}</testcase>`).join('')}${complete ? '' : '<testcase name="required-scenario-count"><failure message="Incomplete required browser run"/></testcase>'}</testsuite>`);
    fs.writeFileSync('e2e-results/summary.md', `Chromium / real Vite / real Express / disposable MongoDB\n\nPassed ${passed}/${this.expected}; required 14. Retries: 0. Complete: ${complete}.\n\n${this.results.map(x => `- ${x.pass ? "PASS" : "FAIL"} ${x.name} — cleanup=${x.cleanupVerified}, ${(x.milliseconds / 1000).toFixed(1)}s`).join("\n")}\n`);
    // Playwright's automatic error-context can include filled authentication inputs.
    fs.rmSync('test-results', { recursive: true, force: true });
    process.stdout.write(`Browser result: ${passed}/${this.expected}; complete=${complete}.\n`);
    return complete ? undefined : { status: 'failed' };
  }
}
