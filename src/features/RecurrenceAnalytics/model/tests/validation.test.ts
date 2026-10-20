import { validateRecurrence } from '../validation';
import { fixedWindow, recurrenceFixture } from './fixtures';

const now = new Date('2025-04-15T00:00:00Z');
const dto = recurrenceFixture();
const observation = (changes: Record<string, unknown>) => ({ ...dto,
  observations: [{ ...dto.observations[0], ...changes }, ...dto.observations.slice(1)] });
const group = (changes: Record<string, unknown>) => observation({ group: { ...dto.observations[0].group, ...changes } });
const missing = (key: string) => { const result = recurrenceFixture(); Reflect.deleteProperty(result, key); return result; };
const freeze = <T,>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
};

describe('strict observations-v0 response boundary', () => {
  it('accepts immutable complete evidence and returns fresh checked data', () => {
    const input = freeze(recurrenceFixture());
    const result = validateRecurrence(input, fixedWindow, now);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
    expect(result?.observations[0].activeMonths).not.toBe(input.observations[0].activeMonths);
  });
  it('accepts genuine empty observations only with all known metadata', () => {
    expect(validateRecurrence({ ...dto, observations: [] }, fixedWindow, now)?.observations).toEqual([]);
  });
  it('does not copy client owner/session/cache scope into the validated DTO', () => {
    const requested = { ...fixedWindow, userId: 'fictional-owner', sessionGeneration: 99, requestScope: 'fictional-scope' };
    expect(validateRecurrence(dto, requested, now)?.window).toEqual(fixedWindow);
  });
  it.each([
    ['null', null], ['array', []], ['version', { ...dto, version: 'observations-v1' }],
    ['missing version', missing('version')], ['missing window', missing('window')],
    ['missing coverage', missing('coverage')], ['missing observations', missing('observations')],
    ['extra field', { ...dto, confidence: 99 }],
    ['stale period', { ...dto, window: { ...fixedWindow, startMonth: '2024-12' } }],
    ['unknown coverage', { ...dto, coverage: { ...dto.coverage, source: 'unknown' } }],
    ['claimed continuity', { ...dto, coverage: { ...dto.coverage, historicalContinuity: 'complete' } }],
    ['atomic claim', { ...dto, coverage: { ...dto.coverage, atomicSnapshot: true } }],
    ['wrong limit', { ...dto, coverage: { ...dto.coverage, maxRecordsPerDataset: 1001 } }],
    ['incomplete coverage', { ...dto, coverage: { source: 'stored_records_only' } }],
    ['unexpected coverage key', { ...dto, coverage: { ...dto.coverage, state: 'complete' } }],
    ['unknown dataset', group({ dataset: 'loans' })], ['unknown level', group({ level: 'regular' })],
    ['income similar', group({ dataset: 'incomes', level: 'similar_expense', title: 'Fictional', recipient: 'Fictional' })],
    ['unverified dictionary ID', group({ identity: { provenance: 'verified_id', value: 'fictional-id' } })],
    ['missing provenance', group({ identity: { value: 'Fictional' } })],
    ['empty identity', group({ identity: { provenance: 'label_only', value: ' ' } })],
    ['extra identity key', group({ identity: { provenance: 'label_only', value: 'Fictional', owner: 'untrusted' } })],
    ['unexpected category title', group({ title: 'Fictional' })],
    ['zero operations', observation({ operationCount: 0 })],
    ['too many operations', observation({ operationCount: 1001 })],
    ['fractional operations', observation({ operationCount: 3.1 })],
    ['string count', observation({ operationCount: '4' })],
    ['NaN count', observation({ operationCount: NaN })],
    ['active count mismatch', observation({ activeMonthCount: 2 })],
    ['more active months than operations', observation({ operationCount: 2 })],
    ['unordered months', observation({ activeMonths: ['2025-02', '2025-01', '2025-03'] })],
    ['duplicate months', observation({ activeMonths: ['2025-01', '2025-01', '2025-03'] })],
    ['outside window', observation({ activeMonths: ['2024-12', '2025-02', '2025-03'] })],
    ['noncanonical month', observation({ activeMonths: ['2025-1', '2025-02', '2025-03'] })],
    ['bad interval', observation({ intervalsInMonths: [1, 2] })],
    ['missing interval', observation({ intervalsInMonths: [1] })],
    ['bad series', observation({ longestConsecutiveMonths: 2 })],
    ['extra observation key', observation({ confidence: 0.9 })],
    ['duplicate groups', { ...dto, observations: [...dto.observations, dto.observations[0]] }],
    ['missing parent category', { ...dto, observations: dto.observations.slice(1) }],
    ['excessive observations', { ...dto, observations: Array(3001).fill(dto.observations[0]) }],
  ])('rejects %s atomically', (_name, input) => {
    expect(validateRecurrence(input, fixedWindow, now)).toBeNull();
  });
  it('checks aggregate dataset and parent/child bounds', () => {
    const extra = { ...dto.observations[0], operationCount: 1000,
      group: { ...dto.observations[0].group, identity: { provenance: 'label_only', value: 'Another category' } } };
    expect(validateRecurrence({ ...dto, observations: [...dto.observations, extra] }, fixedWindow, now)).toBeNull();
    const child = { ...dto.observations[1], group: { ...dto.observations[1].group, title: 'Another shop' } };
    expect(validateRecurrence({ ...dto, observations: [...dto.observations, child] }, fixedWindow, now)).toBeNull();
    expect(validateRecurrence(observation({ activeMonthCount: 1, activeMonths: ['2025-01'],
      intervalsInMonths: [], longestConsecutiveMonths: 1 }), fixedWindow, now)).toBeNull();
  });
  it('preserves exact Unicode and special-key labels without normalizing identities', () => {
    const input = recurrenceFixture(fixedWindow, '__proto__ ☕ е\u0301');
    expect(validateRecurrence(input, fixedWindow, now)).toEqual(input);
  });
  it('requires enough category records for months not represented by similar groups', () => {
    const input = recurrenceFixture();
    input.observations[1] = { ...input.observations[1], operationCount: 4, activeMonthCount: 1,
      activeMonths: ['2025-01'], intervalsInMonths: [], longestConsecutiveMonths: 1 };
    expect(validateRecurrence(input, fixedWindow, now)).toBeNull();
  });
  it('accepts boundary counts without double counting category and similar evidence', () => {
    const input = recurrenceFixture(); input.observations.forEach(x => { x.operationCount = 1000; });
    expect(validateRecurrence(input, fixedWindow, now)).toEqual(input);
  });
});
