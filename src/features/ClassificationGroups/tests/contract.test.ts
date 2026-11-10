import {
  readCatalogPage,
  readDecision,
  readGroup,
  readRules,
  readPreview,
  readReport,
  displayName,
  operationFromRead,
} from '../model/contract';
import { loadCatalog } from '../model/catalog';
import { groupCandidates } from '../model/preview';
import {
  approved,
  catalog,
  custom,
  date,
  end,
  group,
  id,
  page,
  proposal,
  read,
  report,
  rule,
  start,
  wrap,
} from './fixtures';
const request = {
  startInclusive: start,
  endExclusive: end,
  includeOperations: true,
};
it('validates custom/system groups, archived references and exact missing/null comments', () => {
  expect(readGroup(group())).not.toBeNull();
  expect(
    readGroup(group({ groupId: 'system:expenses:everyday', origin: 'system' })),
  ).not.toBeNull();
  expect(readGroup({ ...group(), owner: 'a'.repeat(24) })).toBeNull();
  expect(readGroup(group({ revision: 0 }))).toBeNull();
  expect(readGroup(group({ groupId: 'system:incomes:refund' }))).toBeNull();
  expect(
    readDecision(approved({ group: group({ status: 'archived' }) })),
  ).not.toBeNull();
  expect(readDecision(read())).not.toBeNull();
  expect(
    readDecision({
      ...read(),
      facts: { ...(read().facts as object), comment: { kind: 'null' } },
    }),
  ).not.toBeNull();
  expect(
    readDecision({
      ...read(),
      facts: {
        ...(read().facts as object),
        comment: { kind: 'value', value: '' },
      },
    }),
  ).not.toBeNull();
  expect(
    readDecision({
      ...read(),
      confirmed: { economicRole: 'ordinary_expense', layer: 'everyday' },
    }),
  ).toBeNull();
});
it.each(['bad', 'financial-classification-v2', undefined])(
  'rejects mismatched version %s instead of falling back',
  (version) => {
    expect(readDecision({ ...read(), version })).toBeNull();
    expect(readCatalogPage({ version, result: catalog() })).toBeNull();
  },
);
it('rejects inconsistent states, missing fields, invalid source facts and invented effective classification', () => {
  for (const extra of [
    { status: 'approved' },
    { decisionRevision: 1 },
    { storedGroupId: custom },
    { sourceFingerprint: 'bad' },
    { facts: { amount: 12.34, date } },
  ])
    expect(readDecision({ ...read(), ...extra })).toBeNull();
  expect(
    readDecision({ ...approved(), status: 'stale', groupId: custom }),
  ).toBeNull();
  expect(
    readDecision({ ...approved(), status: 'stale', groupId: null }),
  ).not.toBeNull();
});
it('never executes accessors/coercion/toJSON and validates names', () => {
  const getter = jest.fn();
  expect(
    readGroup(
      Object.defineProperty({ ...group() }, 'name', {
        enumerable: true,
        get: getter,
      }),
    ),
  ).toBeNull();
  expect(getter).not.toHaveBeenCalled();
  expect(readGroup({ ...group(), toJSON: getter })).toBeNull();
  for (const s of ['', ' ', ' name', 'a'.repeat(121), '\ud800', 'name\n'])
    expect(displayName(s)).toBe(false);
  expect(displayName('Семья 🚗')).toBe(true);
});
it('loads every catalog page without writes and rejects loops, duplicates or changing definitions', async () => {
  const groups = Array.from({ length: 101 }, (_, i) =>
    group({
      groupId: `custom:10000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      name: 'Группа ' + i,
    }),
  );
  const port = jest
    .fn()
    .mockResolvedValueOnce(page(groups.slice(0, 100), 'f'.repeat(24)))
    .mockResolvedValueOnce(page(groups.slice(100)));
  const result = await loadCatalog(port, () => true);
  expect(result.groups).toHaveLength(101);
  expect(port).toHaveBeenLastCalledWith(
    '/classification-groups?limit=100&after=' + 'f'.repeat(24),
  );
  await expect(
    loadCatalog(
      async () => page(groups.slice(0, 100), 'f'.repeat(24)),
      () => true,
    ),
  ).rejects.toThrow();
  await expect(
    loadCatalog(
      async () => page(),
      () => false,
    ),
  ).rejects.toThrow();
});
it('accepts eight legacy mapped rules without inventing roles, diagnoses archived targets', () => {
  const rows = Array.from({ length: 8 }, (_, i) =>
    rule({
      id: String(i + 1).padStart(24, '0'),
      revision: 0,
      category: 'категория ' + i,
      groupId: 'system:expenses:everyday',
      group: group({ groupId: 'system:expenses:everyday', origin: 'system' }),
    }),
  );
  expect(readRules(wrap({ rules: rows }))).toHaveLength(8);
  expect(
    readRules(
      wrap({
        rules: [
          rule({
            group: group({ status: 'archived' }),
            diagnostic: 'group_inactive',
          }),
        ],
      }),
    ),
  ).toHaveLength(1);
  expect(
    readRules(
      wrap({
        rules: [
          rule({ group: group({ status: 'archived' }), diagnostic: 'ready' }),
        ],
      }),
    ),
  ).toBeNull();
});
it('validates preview identities/etag/facts, only selects eligible unreviewed matching intents', () => {
  const p = proposal(),
    r = {
      version: 'classification-group-preview-v3',
      window: { startInclusive: start, endExclusive: end },
      proposals: [p],
      consistency: 'observed_only_non_atomic',
    };
  expect(
    readPreview(wrap(r), {
      startInclusive: start,
      endExclusive: end,
      operations: [{ dataset: 'expenses', operationId: id }],
    }),
  ).toEqual([p]);
  const rows = [
    { operation: operationFromRead(read(), 1234), decision: read() },
  ];
  expect(groupCandidates([p], rows, [rule()], () => false)).toHaveLength(1);
  expect(
    groupCandidates([p], rows, [rule({ etag: 'c'.repeat(64) })], () => false),
  ).toHaveLength(0);
  expect(groupCandidates([p], rows, [rule()], () => true)).toHaveLength(0);
  expect(
    groupCandidates(
      [proposal({ expectedFacts: {} })],
      rows,
      [rule()],
      () => false,
    ),
  ).toHaveLength(0);
});
it('reconciles signed income/expense totals and archived/unclassified buckets without excluding cashflows', () => {
  const income = approved({
    dataset: 'incomes',
    operationId: '3'.repeat(24),
    groupId: 'system:incomes:loan_repayment',
    storedGroupId: 'system:incomes:loan_repayment',
    group: group({
      groupId: 'system:incomes:loan_repayment',
      dataset: 'incomes',
      origin: 'system',
      name: 'Возврат займа',
    }),
    facts: {
      amount: { format: 'binary64-roundtrip-decimal', value: '12.34' },
      dateEpochMs: Date.parse(date),
      date,
      source: 'Возврат займа',
      comment: { kind: 'missing' },
    },
  });
  const data = report([
    approved({ group: group({ status: 'archived' }) }),
    income,
    read({ operationId: '4'.repeat(24) }),
  ]);
  expect(readReport(wrap(data), request)).not.toBeNull();
  expect(data.totals.expenses.signedKopecks).toBe(-2468);
  expect(data.totals.incomes.signedKopecks).toBe(1234);
  for (const mutate of [
    (x: typeof data) => {
      x.totals.expenses.signedKopecks = 2468;
    },
    (x: typeof data) => {
      x.operations.pop();
    },
    (x: typeof data) => {
      x.groups[0].kopecks = 1;
    },
    (x: typeof data) => {
      x.operations[0].kopecks = 0;
    },
    (x: typeof data) => {
      x.coverage = 'partial' as typeof x.coverage;
    },
  ]) {
    const copy = JSON.parse(JSON.stringify(data));
    mutate(copy);
    expect(readReport(wrap(copy), request)).toBeNull();
  }
  const summary = { ...data, operations: [] };
  expect(
    readReport(wrap(summary), { ...request, includeOperations: false }),
  ).not.toBeNull();
});
it('does not confuse summary-only results with complete operation lists', () => {
  const data = report();
  expect(readReport(wrap({ ...data, operations: [] }), request)).toBeNull();
  expect(readReport(wrap(data), { ...request, startInclusive: 0 })).toBeNull();
});
