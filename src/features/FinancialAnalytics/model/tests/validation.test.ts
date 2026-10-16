/** @jest-environment node */
import { validateExpenseResponse, validateIncomeResponse } from '../validation';
import { expense, income, expenseResponse, incomeResponse, selectedPeriod } from './fixtures';

describe.each([
  { dataset: 'expenses', validate: validateExpenseResponse, record: expense, response: expenseResponse },
  { dataset: 'incomes', validate: validateIncomeResponse, record: income, response: incomeResponse },
])('$dataset response completeness and consumed fields', ({ dataset, validate, record, response }) => {
  const period = selectedPeriod();

  it('accepts complete empty arrays and compatible unpaginated metadata', () => {
    expect(validate(response(), period)).toEqual({ ok: true, value: { records: [], totalKopecks: 0 } });
    expect(validate(response([], { limit: 20 }), period).ok).toBe(true);
    expect(validate(response([record()], { limit: 20 }), period).ok).toBe(true);
  });

  it.each([null, undefined, [], {}, { total: 0, page: 1, limit: 0 }].map((payload) => [payload]))('rejects malformed response %p', (payload) => {
    expect(validate(payload, period)).toMatchObject({ ok: false, error: { code: 'invalid_response', dataset } });
  });

  it.each([
    { total: -1 }, { total: 0.5 }, { total: NaN }, { total: Infinity }, { total: '1' },
    { total: Number.MAX_SAFE_INTEGER + 1 }, { total: undefined },
    { page: 0 }, { page: 2 }, { page: '1' }, { page: undefined },
    { limit: -1 }, { limit: 0 }, { limit: 0.5 }, { limit: NaN }, { limit: '1' },
    { limit: Number.MAX_SAFE_INTEGER + 1 }, { limit: undefined },
  ])('rejects invalid or incompatible metadata %p', (metadata) => {
    expect(validate(response([record()], metadata), period)).toMatchObject({
      ok: false, error: { code: 'invalid_metadata', dataset },
    });
  });

  it('rejects a truncated page instead of treating total as a monetary amount', () => {
    expect(validate(response([record()], { total: 2, limit: 20 }), period)).toMatchObject({
      ok: false, error: { code: 'incomplete_response', dataset },
    });
    expect(validate(response([record()], { total: 0 }), period).ok).toBe(false);
  });

  it('rejects duplicate IDs within the dataset', () => {
    expect(validate(response([record(), record()]), period)).toMatchObject({
      ok: false, error: { code: 'duplicate_id', dataset, index: 1 },
    });
  });

  it.each([undefined, null, '', ' ', 'padded ', 'two words', 12])('rejects invalid ID %p', (id) => {
    expect(validate(response([{ ...record(), _id: id }]), period)).toMatchObject({
      ok: false, error: { code: 'invalid_id', dataset, index: 0 },
    });
  });

  it.each([undefined, null, -1, NaN, Infinity, '12', '', 1.005, 0.1 + 0.2])(
    'rejects missing, malformed or unsupported API amount %p', (amount) => {
      const result = validate(response([{ ...record(), amount }]), period);
      expect(result).toMatchObject({ ok: false, error: { code: 'invalid_amount', dataset, index: 0 } });
      expect(result).not.toHaveProperty('value');
    },
  );

  it('accepts a real zero and rejects aggregate overflow', () => {
    expect(validate(response([{ ...record(), amount: 0 }]), period)).toMatchObject({
      ok: true, value: { totalKopecks: 0, records: [{ kopecks: 0 }] },
    });
    expect(validate(response([
      { ...record(), _id: 'first', amount: 5e13 }, { ...record(), _id: 'second', amount: 5e13 },
    ]), period)).toMatchObject({ ok: false, error: { code: 'overflow', dataset } });
  });

  it.each([
    undefined, null, 123, '', 'not a date', '2024-02-30', '2024-02-30T12:00:00Z',
    '2024-02-10T12:00:00', '2024-02-10T24:00:00Z', '2024-02-10T12:60:00Z',
    '2024-02-10T12:00:60Z', '2024-02-10T12:00:00+24:00', '2024-02-10T12:00:00+01:60',
    '2024-02-10T12:00:00.0001Z', '2024-02-10T12:00:00Z\n',
  ])('rejects invalid, ambiguous or unsupported date %p', (date) => {
    expect(validate(response([{ ...record(), date }]), period)).toMatchObject({
      ok: false, error: { code: 'invalid_date', dataset },
    });
  });

  it('compares instants exactly at period boundaries, including offset timestamps', () => {
    for (const date of ['2024-02-01', '2024-02-29T23:59:59.999Z', '2024-03-01T01:00:00+03:00']) {
      expect(validate(response([{ ...record(), date }]), period).ok).toBe(true);
    }
    for (const date of ['2024-01-31T23:59:59.999Z', '2024-03-01T00:00:00Z', '2024-03-01T03:00:00+03:00']) {
      expect(validate(response([{ ...record(), date }]), period)).toMatchObject({
        ok: false, error: { code: 'outside_period', dataset },
      });
    }
  });

  it('rejects non-record entries and invalid periods without mutating input', () => {
    expect(validate(response([null]), period)).toMatchObject({ ok: false, error: { code: 'invalid_record' } });
    expect(validate(response(), { ...period, endExclusive: NaN })).toMatchObject({ ok: false, error: { code: 'invalid_period' } });
    const original = Object.freeze(record());
    const records = Object.freeze([original]);
    const payload = Object.freeze(response(records));
    const before = JSON.stringify(payload);
    const result = validate(payload, period);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(payload)).toBe(before);
    if (result.ok) expect(result.value.records[0]).not.toBe(original);
  });
});

describe('expense category and income source validation', () => {
  it.each([undefined, null, '', '  '])('groups missing/blank category %p explicitly', (category) => {
    expect(validateExpenseResponse(expenseResponse([{ ...expense(), category }]), selectedPeriod())).toMatchObject({
      ok: true, value: { records: [{ category: 'Без категории' }] },
    });
  });

  it.each([1, {}, []].map((category) => [category]))('rejects malformed category %p', (category) => {
    expect(validateExpenseResponse(expenseResponse([expense('e', 1, category)]), selectedPeriod())).toMatchObject({
      ok: false, error: { code: 'invalid_category' },
    });
  });

  it.each([undefined, null, '', ' ', 1, {}])('rejects missing or malformed required income source %p', (source) => {
    const record = { ...income(), source };
    expect(validateIncomeResponse(incomeResponse([record]), selectedPeriod())).toMatchObject({
      ok: false, error: { code: 'invalid_source' },
    });
  });
});
