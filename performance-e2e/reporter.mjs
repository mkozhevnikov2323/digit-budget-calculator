import fs from 'node:fs';
import SafeReporter from '../e2e/safe-reporter.mjs';
export default class P12Reporter extends SafeReporter {
  onEnd(result) {
    const passed = this.results.filter(x => x.pass).length;
    const complete = !this.fatal && result.status === 'passed' && this.expected === 6
      && this.results.length === 6 && passed === 6;
    fs.mkdirSync('p12-e2e-results', { recursive: true });
    fs.writeFileSync('p12-e2e-results/summary.json', JSON.stringify({ version: 1, expected: 6,
      executed: this.results.length, passed, complete, tests: this.results }, null, 2) + '\n');
    fs.rmSync('test-results-p12', { recursive: true, force: true });
    process.stdout.write(`P12 browser result: ${passed}/${this.expected}; complete=${complete}; retries=0.\n`);
    return complete ? undefined : { status: 'failed' };
  }
}
