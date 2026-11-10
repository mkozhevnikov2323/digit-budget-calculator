import { rublesToKopecks } from 'features/FinancialAnalytics/model/money';
import {
  canonicalId,
  closedData,
  type DecisionState,
} from 'features/HistoricalClassification/model/contract';
import { parseSourceFacts } from 'features/HistoricalClassification/model/coherentHistory';
import type { HistoryOperation } from 'features/HistoricalClassification/model/history';
export type Dataset = 'expenses' | 'incomes';
export const systemIds = [
  ...[
    'everyday',
    'irregular',
    'emergency',
    'major_goals',
    'long_term_capital',
  ].map((x) => `system:expenses:${x}`),
  ...[
    'ordinary_income',
    'loan_repayment',
    'refund',
    'internal_transfer',
    'capital_movement',
  ].map((x) => `system:incomes:${x}`),
  ...['loan_issuance', 'internal_transfer', 'capital_movement'].map(
    (x) => `system:expenses:role:${x}`,
  ),
];
export const groupId = (x: unknown): x is string =>
  typeof x === 'string' &&
  (systemIds.includes(x) ||
    (x.length === 43 &&
      /^custom:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
        x,
      )));
export const dataset = (x: unknown): x is Dataset =>
  x === 'expenses' || x === 'incomes';
const integer = (x: unknown): x is number =>
  typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const revision = (x: unknown): x is number => integer(x) && x > 0;
const date = (x: unknown): x is string =>
  typeof x === 'string' &&
  Number.isFinite(Date.parse(x)) &&
  new Date(x).toISOString() === x;
const digest = (x: unknown): x is string =>
  typeof x === 'string' && x.length === 64 && /^[a-f0-9]{64}$/.test(x);
export const displayName = (x: unknown): x is string =>
  typeof x === 'string' &&
  x === x.trim() &&
  x.length > 0 &&
  x.length <= 120 &&
  !/[\u0000-\u001f\u007f\ud800-\udfff]/u.test(x);
const scopedId = (target: string, ds: Dataset) =>
  !target.startsWith('system:') || target.startsWith(`system:${ds}:`);
export type Group = {
  groupId: string;
  dataset: Dataset;
  name: string;
  origin: 'system' | 'custom';
  status: 'active' | 'disabled' | 'archived';
  revision: number;
  createdAt?: string;
  updatedAt?: string;
  virtual?: true;
};
export type Definition = {
  groupId: string;
  dataset: Dataset;
  name: string;
  compatibilityOnly: boolean;
};
export type Catalog = {
  groups: Group[];
  initialized: boolean;
  systemDefinitions: Definition[];
};
export const envelope = (input: unknown): unknown => {
  const r = closedData(input, ['version', 'result']);
  return r &&
    Object.keys(r).length === 2 &&
    r.version === 'classification-groups-v3'
    ? r.result
    : undefined;
};
export const readGroup = (
  input: unknown,
  allowVirtual = false,
): Group | null => {
  const r = closedData(input, [
    'groupId',
    'dataset',
    'name',
    'origin',
    'status',
    'revision',
    'createdAt',
    'updatedAt',
    ...(allowVirtual ? ['virtual'] : []),
  ]);
  if (
    !r ||
    !groupId(r.groupId) ||
    !dataset(r.dataset) ||
    !scopedId(r.groupId, r.dataset) ||
    !displayName(r.name) ||
    !['system', 'custom'].some((x) => x === r.origin) ||
    !['active', 'disabled', 'archived'].some((x) => x === r.status) ||
    (r.origin === 'system') !== r.groupId.startsWith('system:') ||
    (r.origin === 'system' && r.status === 'archived')
  )
    return null;
  if (r.virtual === true) {
    if (
      !allowVirtual ||
      r.revision !== 0 ||
      r.origin !== 'system' ||
      Object.keys(r).length !== 7
    )
      return null;
  } else if (
    Object.keys(r).length !== 8 ||
    !revision(r.revision) ||
    !date(r.createdAt) ||
    !date(r.updatedAt) ||
    r.createdAt > r.updatedAt
  )
    return null;
  return r as Group;
};
export const readCatalogPage = (input: unknown) => {
  const r = closedData(envelope(input), [
    'groups',
    'initialized',
    'nextCursor',
    'systemDefinitions',
  ]);
  if (
    !r ||
    Object.keys(r).length !== 4 ||
    !Array.isArray(r.groups) ||
    r.groups.length > 100 ||
    typeof r.initialized !== 'boolean' ||
    (r.nextCursor !== null && !canonicalId(r.nextCursor)) ||
    !Array.isArray(r.systemDefinitions) ||
    r.systemDefinitions.length !== 13
  )
    return null;
  const groups: Group[] = [],
    systemDefinitions: Definition[] = [];
  for (const raw of r.groups) {
    const g = readGroup(raw);
    if (!g) return null;
    groups.push(g);
  }
  for (const raw of r.systemDefinitions) {
    const d = closedData(raw, [
      'groupId',
      'dataset',
      'name',
      'compatibilityOnly',
    ]);
    if (
      !d ||
      Object.keys(d).length !== 4 ||
      typeof d.groupId !== 'string' ||
      !systemIds.includes(d.groupId) ||
      !dataset(d.dataset) ||
      !scopedId(d.groupId, d.dataset) ||
      !displayName(d.name) ||
      typeof d.compatibilityOnly !== 'boolean'
    )
      return null;
    systemDefinitions.push(d as Definition);
  }
  if (
    new Set(groups.map((g) => g.groupId)).size !== groups.length ||
    new Set(systemDefinitions.map((g) => g.groupId)).size !== 13
  )
    return null;
  return {
    groups,
    systemDefinitions,
    initialized: r.initialized,
    nextCursor: r.nextCursor as string | null,
  };
};
export type GroupRead = {
  version: 'classification-group-read-v3';
  dataset: Dataset;
  operationId: string;
  facts: unknown;
  sourceFingerprint: string;
  sourceFingerprintVersion: 1;
  decisionRevision: number | null;
  status: DecisionState | 'unreviewed' | 'stale';
  storedState: DecisionState | null;
  storedGroupId: string | null;
  groupId: string | null;
  group: Group | null;
  consistency: 'observed_only_non_atomic';
  legacy: boolean;
};
const decisionFields = [
  'version',
  'dataset',
  'operationId',
  'facts',
  'sourceFingerprint',
  'sourceFingerprintVersion',
  'decisionRevision',
  'status',
  'storedState',
  'storedGroupId',
  'groupId',
  'group',
  'consistency',
  'legacy',
];
export const readDecision = (
  input: unknown,
  ds?: Dataset,
  id?: string,
): GroupRead | null => {
  const r = closedData(input, decisionFields);
  if (
    !r ||
    Object.keys(r).length !== 14 ||
    r.version !== 'classification-group-read-v3' ||
    !dataset(r.dataset) ||
    (ds !== undefined && r.dataset !== ds) ||
    !canonicalId(r.operationId) ||
    (id !== undefined && r.operationId !== id) ||
    !parseSourceFacts(r.facts, r.dataset) ||
    !digest(r.sourceFingerprint) ||
    r.sourceFingerprintVersion !== 1 ||
    r.consistency !== 'observed_only_non_atomic' ||
    typeof r.legacy !== 'boolean'
  )
    return null;
  const state = (x: unknown) =>
    ['approved', 'explicit_unclassified', 'cleared'].some((s) => x === s);
  if (r.status === 'unreviewed') {
    if (
      r.decisionRevision !== null ||
      r.storedState !== null ||
      r.storedGroupId !== null ||
      r.groupId !== null ||
      r.group !== null ||
      r.legacy !== false
    )
      return null;
  } else if (
    !revision(r.decisionRevision) ||
    !state(r.storedState) ||
    (r.status !== 'stale' && r.status !== r.storedState)
  )
    return null;
  if (r.storedState === 'approved') {
    const g = readGroup(r.group, true);
    if (
      !g ||
      !groupId(r.storedGroupId) ||
      g.groupId !== r.storedGroupId ||
      g.dataset !== r.dataset ||
      r.groupId !== (r.status === 'approved' ? r.storedGroupId : null)
    )
      return null;
  } else if (r.storedGroupId !== null || r.group !== null || r.groupId !== null)
    return null;
  if (!state(r.status) && r.status !== 'unreviewed' && r.status !== 'stale')
    return null;
  return {
    ...r,
    group: r.group === null ? null : readGroup(r.group, true),
  } as GroupRead;
};
export type GroupRule = {
  id: string;
  dataset: Dataset;
  enabled: boolean;
  category?: string;
  title?: string;
  source?: string;
  groupId: string;
  group: Group | null;
  etag: string;
  revision: number;
  diagnostic: 'ready' | 'disabled' | 'group_missing' | 'group_inactive';
  createdAt: string;
  updatedAt: string;
};
export const readRule = (input: unknown): GroupRule | null => {
  const r = closedData(input, [
    'id',
    'dataset',
    'enabled',
    'category',
    'title',
    'source',
    'groupId',
    'group',
    'etag',
    'revision',
    'diagnostic',
    'createdAt',
    'updatedAt',
  ]);
  if (
    !r ||
    !canonicalId(r.id) ||
    !dataset(r.dataset) ||
    typeof r.enabled !== 'boolean' ||
    !groupId(r.groupId) ||
    !scopedId(r.groupId, r.dataset) ||
    !digest(r.etag) ||
    !integer(r.revision) ||
    !date(r.createdAt) ||
    !date(r.updatedAt) ||
    r.createdAt > r.updatedAt ||
    !['ready', 'disabled', 'group_missing', 'group_inactive'].some(
      (x) => x === r.diagnostic,
    )
  )
    return null;
  const text = (x: unknown) =>
    typeof x === 'string' &&
    x.length > 0 &&
    x.length <= 8192 &&
    x === x.trim().toLowerCase();
  if (
    r.dataset === 'expenses'
      ? !text(r.category) ||
        Object.prototype.hasOwnProperty.call(r, 'source') ||
        (Object.prototype.hasOwnProperty.call(r, 'title') && !text(r.title))
      : !text(r.source) ||
        Object.prototype.hasOwnProperty.call(r, 'category') ||
        Object.prototype.hasOwnProperty.call(r, 'title')
  )
    return null;
  const group = r.group === null ? null : readGroup(r.group, true);
  if (
    (r.group !== null && !group) ||
    (group && (group.groupId !== r.groupId || group.dataset !== r.dataset))
  )
    return null;
  const expected = !r.enabled
    ? 'disabled'
    : !group || group.virtual
      ? 'group_missing'
      : group.status !== 'active'
        ? 'group_inactive'
        : 'ready';
  if (r.diagnostic !== expected) return null;
  return { ...r, group } as GroupRule;
};
export const readRules = (input: unknown): GroupRule[] | null => {
  const r = closedData(envelope(input), ['rules']);
  if (
    !r ||
    Object.keys(r).length !== 1 ||
    !Array.isArray(r.rules) ||
    r.rules.length > 5000
  )
    return null;
  const rows: GroupRule[] = [];
  for (const raw of r.rules) {
    const row = readRule(raw);
    if (!row) return null;
    rows.push(row);
  }
  return new Set(rows.map((r) => r.id)).size === rows.length ? rows : null;
};
export type Total = { kopecks: number; signedKopecks: number; count: number };
export type Bucket = Total & {
  dataset: Dataset;
  groupId: string | null;
  name: string | null;
  status: Group['status'] | null;
};
export type Report = {
  version: 'classification-group-report-v3';
  window: { startInclusive: number; endExclusive: number };
  totals: Record<Dataset, Total>;
  groups: Bucket[];
  operations: (GroupRead & { kopecks: number; signedKopecks: number })[];
  coverage: 'complete_recorded_period';
  filtered: boolean;
  consistency: 'observed_only_non_atomic';
};
export type ReportRequest = {
  startInclusive: number;
  endExclusive: number;
  includeOperations: boolean;
  dataset?: Dataset;
  groupId?: string | null;
};
const total = (v: unknown, ds: Dataset): v is Total => {
  const r = closedData(v, ['kopecks', 'signedKopecks', 'count']);
  return (
    !!r &&
    Object.keys(r).length === 3 &&
    integer(r.kopecks) &&
    integer(r.count) &&
    r.signedKopecks === (ds === 'expenses' ? -r.kopecks : r.kopecks)
  );
};
export const readReport = (
  input: unknown,
  request: ReportRequest,
): Report | null => {
  const r = closedData(envelope(input), [
      'version',
      'window',
      'totals',
      'groups',
      'operations',
      'coverage',
      'filtered',
      'consistency',
    ]),
    w = r && closedData(r.window, ['startInclusive', 'endExclusive']),
    t = r && closedData(r.totals, ['expenses', 'incomes']);
  if (
    !r ||
    Object.keys(r).length !== 8 ||
    r.version !== 'classification-group-report-v3' ||
    !w ||
    Object.keys(w).length !== 2 ||
    w.startInclusive !== request.startInclusive ||
    w.endExclusive !== request.endExclusive ||
    !t ||
    !total(t.expenses, 'expenses') ||
    !total(t.incomes, 'incomes') ||
    Object.keys(t).length !== 2 ||
    t.expenses.count + t.incomes.count > 50000 ||
    !Array.isArray(r.groups) ||
    r.groups.length > 50000 ||
    !Array.isArray(r.operations) ||
    r.operations.length > 1000 ||
    r.coverage !== 'complete_recorded_period' ||
    r.consistency !== 'observed_only_non_atomic' ||
    r.filtered !==
      (request.dataset !== undefined || request.groupId !== undefined)
  )
    return null;
  const totals: Record<Dataset, Total> = {
    expenses: t.expenses,
    incomes: t.incomes,
  };
  const groups: Bucket[] = [],
    operations: Report['operations'] = [],
    keys = new Set<string>();
  for (const raw of r.groups) {
    const b = closedData(raw, [
      'dataset',
      'groupId',
      'name',
      'status',
      'kopecks',
      'signedKopecks',
      'count',
    ]);
    if (
      !b ||
      Object.keys(b).length !== 7 ||
      !dataset(b.dataset) ||
      !total(
        { kopecks: b.kopecks, signedKopecks: b.signedKopecks, count: b.count },
        b.dataset,
      )
    )
      return null;
    if (b.groupId === null) {
      if (b.name !== null || b.status !== null) return null;
    } else if (
      !groupId(b.groupId) ||
      !scopedId(b.groupId, b.dataset) ||
      !displayName(b.name) ||
      !['active', 'disabled', 'archived'].some((x) => x === b.status)
    )
      return null;
    const key = `${b.dataset}/${b.groupId}`;
    if (keys.has(key)) return null;
    keys.add(key);
    groups.push(b as Bucket);
  }
  for (const ds of ['expenses', 'incomes'] as const) {
    const sum = groups
      .filter((b) => b.dataset === ds)
      .reduce(
        (s, b) => ({
          kopecks: s.kopecks + b.kopecks,
          count: s.count + b.count,
        }),
        { kopecks: 0, count: 0 },
      );
    if (
      !integer(sum.kopecks) ||
      sum.kopecks !== totals[ds].kopecks ||
      sum.count !== totals[ds].count
    )
      return null;
  }
  keys.clear();
  for (const raw of r.operations) {
    const a = closedData(raw, [...decisionFields, 'kopecks', 'signedKopecks']);
    if (!a || Object.keys(a).length !== 16) return null;
    const { kopecks, signedKopecks, ...d } = a,
      read = readDecision(d);
    if (!read || !total({ kopecks, signedKopecks, count: 1 }, read.dataset))
      return null;
    const facts = parseSourceFacts(read.facts, read.dataset)!;
    const checkedAmount = rublesToKopecks(facts.amount);
    if (!checkedAmount.ok || checkedAmount.value !== kopecks) return null;
    const ts = Date.parse(facts.date),
      key = `${read.dataset}/${read.operationId}`;
    if (
      ts < request.startInclusive ||
      ts >= request.endExclusive ||
      keys.has(key) ||
      (request.dataset !== undefined && read.dataset !== request.dataset) ||
      (request.groupId !== undefined && read.groupId !== request.groupId)
    )
      return null;
    keys.add(key);
    operations.push({
      ...read,
      kopecks: kopecks as number,
      signedKopecks: signedKopecks as number,
    });
  }
  if (
    (!request.includeOperations && operations.length) ||
    (request.includeOperations &&
      !r.filtered &&
      operations.length !== t.expenses.count + t.incomes.count)
  )
    return null;
  if (request.includeOperations) {
    for (const ds of ['expenses', 'incomes'] as const) {
      const buckets = groups.filter(
        (b) =>
          b.dataset === ds &&
          (request.dataset === undefined || ds === request.dataset) &&
          (request.groupId === undefined || b.groupId === request.groupId),
      );
      const expected = buckets.reduce(
        (s, b) => ({
          count: s.count + b.count,
          kopecks: s.kopecks + b.kopecks,
        }),
        { count: 0, kopecks: 0 },
      );
      const ops = operations.filter((o) => o.dataset === ds);
      if (
        ops.length !== expected.count ||
        ops.reduce((s, o) => s + o.kopecks, 0) !== expected.kopecks
      )
        return null;
    }
  }
  return { ...r, window: w, totals, groups, operations } as Report;
};
export const operationFromRead = (
  read: GroupRead,
  kopecks: number,
): HistoryOperation => ({
  dataset: read.dataset,
  operationId: read.operationId,
  timestamp: Date.parse(parseSourceFacts(read.facts, read.dataset)!.date),
  kopecks,
  facts: parseSourceFacts(read.facts, read.dataset)!,
});
export type Proposal = {
  dataset: Dataset;
  operationId: string;
  expectedFacts: unknown;
  expectedRevision: number | null;
  sourceStatus: GroupRead['status'];
  eligible: boolean;
  match: {
    ruleId: string;
    ruleEtag: string;
    groupId: string;
    diagnostic: GroupRule['diagnostic'];
  } | null;
};
export const readPreview = (
  input: unknown,
  request: {
    startInclusive: number;
    endExclusive: number;
    operations: { dataset: Dataset; operationId: string }[];
  },
): Proposal[] | null => {
  const r = closedData(envelope(input), [
      'version',
      'window',
      'proposals',
      'consistency',
    ]),
    w = r && closedData(r.window, ['startInclusive', 'endExclusive']);
  if (
    !r ||
    Object.keys(r).length !== 4 ||
    r.version !== 'classification-group-preview-v3' ||
    !w ||
    Object.keys(w).length !== 2 ||
    w.startInclusive !== request.startInclusive ||
    w.endExclusive !== request.endExclusive ||
    r.consistency !== 'observed_only_non_atomic' ||
    !Array.isArray(r.proposals) ||
    r.proposals.length !== request.operations.length
  )
    return null;
  const proposals: Proposal[] = [];
  for (let i = 0; i < r.proposals.length; i++) {
    const p = closedData(r.proposals[i], [
      'dataset',
      'operationId',
      'expectedFacts',
      'expectedRevision',
      'sourceStatus',
      'eligible',
      'match',
    ]);
    const identity = request.operations[i];
    if (
      !p ||
      Object.keys(p).length !== 7 ||
      p.dataset !== identity.dataset ||
      p.operationId !== identity.operationId ||
      !parseSourceFacts(p.expectedFacts, identity.dataset) ||
      (p.expectedRevision !== null && !revision(p.expectedRevision)) ||
      ![
        'unreviewed',
        'approved',
        'explicit_unclassified',
        'cleared',
        'stale',
      ].some((x) => x === p.sourceStatus) ||
      typeof p.eligible !== 'boolean'
    )
      return null;
    const m =
      p.match === null
        ? null
        : closedData(p.match, ['ruleId', 'ruleEtag', 'groupId', 'diagnostic']);
    if (
      (p.match !== null &&
        (!m ||
          Object.keys(m).length !== 4 ||
          !canonicalId(m.ruleId) ||
          !digest(m.ruleEtag) ||
          !groupId(m.groupId) ||
          !scopedId(m.groupId, identity.dataset) ||
          !['ready', 'disabled', 'group_missing', 'group_inactive'].some(
            (x) => x === m.diagnostic,
          ))) ||
      p.eligible !==
        (p.sourceStatus === 'unreviewed' && m?.diagnostic === 'ready')
    )
      return null;
    proposals.push(p as Proposal);
  }
  return proposals;
};
