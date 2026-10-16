/** @jest-environment node */
import { toAnalyticsQueryParams } from '../apiRange';
import { yearPeriod } from '../period';
import { selectedPeriod } from './fixtures';

describe('inclusive backend date adapter', () => {
  it('maps the half-open leap-month interval to the complete inclusive final day', () => {
    const period = selectedPeriod();
    const result = toAnalyticsQueryParams(period);
    expect(result).toEqual({ ok: true, value: {
      startDate: '2024-02-01T00:00:00.000Z', endDate: '2024-02-29T23:59:59.999Z', noPagination: true,
    } });
    if (!result.ok) throw new Error('Expected valid query params');
    expect(Date.parse(result.value.endDate) + 1).toBe(period.endExclusive);
  });

  it('supports a single day and a range across years without next-day leakage', () => {
    expect(toAnalyticsQueryParams(selectedPeriod('2024-12-31', '2024-12-31'))).toMatchObject({
      ok: true, value: { startDate: '2024-12-31T00:00:00.000Z', endDate: '2024-12-31T23:59:59.999Z' },
    });
    expect(toAnalyticsQueryParams(selectedPeriod('2024-12-31', '2025-01-02'))).toMatchObject({
      ok: true, value: { endDate: '2025-01-02T23:59:59.999Z' },
    });
  });

  it.each([
    { startInclusive: NaN }, { endExclusive: Infinity }, { endExclusive: Date.parse('2024-02-29T23:59:59Z') },
    { firstDate: '2024-02-30' }, { firstDate: '2024-03-01' }, { lastDate: '2024-01-01' },
  ])('rejects forged or invalid selected periods %p before creating requests', (overrides) => {
    expect(toAnalyticsQueryParams({ ...selectedPeriod(), ...overrides })).toMatchObject({
      ok: false, error: { code: 'invalid_period' },
    });
  });

  it('handles the highest supported selected year without sending year 10000 to the API', () => {
    const period = yearPeriod(9999);
    if (!period.ok) throw new Error('Expected supported selected year');
    expect(toAnalyticsQueryParams(period.value)).toMatchObject({
      ok: true, value: { endDate: '9999-12-31T23:59:59.999Z' },
    });
  });

  it('does not mutate the selected period', () => {
    const period = Object.freeze(selectedPeriod());
    const original = { ...period };
    toAnalyticsQueryParams(period);
    expect(period).toEqual(original);
  });
});
