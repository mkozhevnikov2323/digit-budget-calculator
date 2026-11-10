import type {
  Group,
  GroupRead,
  GroupRule,
  Catalog,
  Report,
  Proposal,
} from '../model/contract';
import { systemIds } from '../model/contract';
export const owner = 'a'.repeat(24),
  id = '1'.repeat(24),
  custom = 'custom:10000000-0000-4000-8000-000000000001';
export const date = '2025-01-15T12:00:00.000Z',
  start = Date.UTC(2025, 0, 1),
  end = Date.UTC(2025, 1, 1);
export const wrap = (result: unknown) => ({
  version: 'classification-groups-v3',
  result,
});
export const group = (extra: Partial<Group> = {}): Group => ({
  groupId: custom,
  dataset: 'expenses',
  name: 'Автомобиль',
  origin: 'custom',
  status: 'active',
  revision: 1,
  createdAt: date,
  updatedAt: date,
  ...extra,
});
export const catalog = (groups: Group[] = [group()]): Catalog => ({
  groups,
  initialized: true,
  systemDefinitions: systemIds.map((groupId) => ({
    groupId,
    dataset: groupId.startsWith('system:expenses:') ? 'expenses' : 'incomes',
    name: groupId,
    compatibilityOnly: groupId.includes(':role:'),
  })),
});
export const page = (
  groups: Group[] = [group()],
  nextCursor: string | null = null,
) => wrap({ ...catalog(groups), nextCursor });
export const read = (extra: Partial<GroupRead> = {}): GroupRead => ({
  version: 'classification-group-read-v3',
  dataset: 'expenses',
  operationId: id,
  facts: {
    amount: { format: 'binary64-roundtrip-decimal', value: '12.34' },
    dateEpochMs: Date.parse(date),
    date,
    category: 'Транспорт',
    title: 'Синтетическое топливо',
    recipient: 'Синтетический получатель',
    comment: { kind: 'missing' },
  },
  sourceFingerprint: 'a'.repeat(64),
  sourceFingerprintVersion: 1,
  decisionRevision: null,
  status: 'unreviewed',
  storedState: null,
  storedGroupId: null,
  groupId: null,
  group: null,
  consistency: 'observed_only_non_atomic',
  legacy: false,
  ...extra,
});
export const approved = (extra: Partial<GroupRead> = {}): GroupRead =>
  read({
    status: 'approved',
    storedState: 'approved',
    storedGroupId: custom,
    groupId: custom,
    group: group(),
    decisionRevision: 1,
    ...extra,
  });
export const rule = (extra: Partial<GroupRule> = {}): GroupRule => ({
  id: '2'.repeat(24),
  dataset: 'expenses',
  enabled: true,
  category: 'транспорт',
  groupId: custom,
  group: group(),
  etag: 'b'.repeat(64),
  revision: 1,
  diagnostic: 'ready',
  createdAt: date,
  updatedAt: date,
  ...extra,
});
export const report = (rows: GroupRead[] = [read()]): Report => {
  const operations = rows.map((r) => ({
    ...r,
    kopecks: 1234,
    signedKopecks: r.dataset === 'expenses' ? -1234 : 1234,
  }));
  const sums = {
    expenses: { kopecks: 0, signedKopecks: 0, count: 0 },
    incomes: { kopecks: 0, signedKopecks: 0, count: 0 },
  };
  const groups: Report['groups'] = [];
  for (const o of operations) {
    sums[o.dataset].kopecks += o.kopecks;
    sums[o.dataset].signedKopecks += o.signedKopecks;
    sums[o.dataset].count++;
    const bucket = groups.find(
      (g) => g.dataset === o.dataset && g.groupId === o.groupId,
    );
    if (bucket) {
      bucket.count++;
      bucket.kopecks += o.kopecks;
      bucket.signedKopecks += o.signedKopecks;
    } else
      groups.push({
        dataset: o.dataset,
        groupId: o.groupId,
        name: o.groupId ? o.group!.name : null,
        status: o.groupId ? o.group!.status : null,
        kopecks: o.kopecks,
        signedKopecks: o.signedKopecks,
        count: 1,
      });
  }
  return {
    version: 'classification-group-report-v3',
    window: { startInclusive: start, endExclusive: end },
    totals: sums,
    groups,
    operations,
    coverage: 'complete_recorded_period',
    filtered: false,
    consistency: 'observed_only_non_atomic',
  };
};
export const proposal = (extra: Partial<Proposal> = {}): Proposal => ({
  dataset: 'expenses',
  operationId: id,
  expectedFacts: read().facts,
  expectedRevision: null,
  sourceStatus: 'unreviewed',
  eligible: true,
  match: {
    ruleId: rule().id,
    ruleEtag: rule().etag,
    groupId: custom,
    diagnostic: 'ready',
  },
  ...extra,
});
