import { validateExpenseResponse, validateIncomeResponse } from '../../FinancialAnalytics/model/validation';
import type { CalendarPeriod } from '../../FinancialAnalytics/model/period';
import type { AnalyticsError } from '../../FinancialAnalytics/model/types';
import type { CheckedOperationSnapshot, OperationIdentity, SourceCategory } from './types';

/** Context supplied by the caller, never a backend concurrency version. */
export type LocalSnapshotRevision = OperationIdentity & {
  readonly kind: 'caller_local';
  readonly revision: string;
};
/** Optional explicit evidence, checked against the exact original source. No FK. */
export type ExpenseCategoryEvidence = OperationIdentity & {
  readonly dataset: 'expenses';
  readonly category: SourceCategory;
};
export type ClassificationSnapshotInput = {
  readonly expenseResponse: unknown;
  readonly incomeResponse: unknown;
  readonly period: CalendarPeriod;
  readonly ownerScope: string;
  readonly revisions: readonly LocalSnapshotRevision[];
  readonly categoryEvidence?: readonly ExpenseCategoryEvidence[];
};
export type ClassificationSnapshots = {
  readonly revisionAuthority: 'caller_local';
  readonly expenses: readonly Extract<CheckedOperationSnapshot, { dataset: 'expenses' }>[];
  readonly incomes: readonly Extract<CheckedOperationSnapshot, { dataset: 'incomes' }>[];
};
type MetadataReason = 'missing' | 'malformed' | 'owner_mismatch' | 'unknown_operation' | 'duplicate' | 'source_mismatch';
export type SnapshotAdapterError = AnalyticsError
  | { readonly code: 'invalid_owner_scope' }
  | { readonly code: 'invalid_revision_metadata' | 'inconsistent_category_provenance'; readonly reason: MetadataReason };
export type SnapshotAdapterResult =
  | { readonly ok: true; readonly value: ClassificationSnapshots }
  | { readonly ok: false; readonly error: SnapshotAdapterError };

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const identity = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && !/\s/.test(value);
const operationIdentity = (value: unknown): value is OperationIdentity => object(value) &&
  identity(value.ownerScope) && identity(value.transactionId) && (value.dataset === 'expenses' || value.dataset === 'incomes');
const localRevision = (value: unknown): value is LocalSnapshotRevision => operationIdentity(value) &&
  'kind' in value && value.kind === 'caller_local' && 'revision' in value && identity(value.revision);
const sourceCategory = (value: unknown): value is SourceCategory => object(value) && (
  value.kind === 'absent' ? !('value' in value) && !('dictionaryStatus' in value)
    : value.kind === 'label' && typeof value.value === 'string' &&
      (value.dictionaryStatus === 'unresolved' || value.dictionaryStatus === 'ambiguous')
);
const categoryEvidence = (value: unknown): value is ExpenseCategoryEvidence => operationIdentity(value) &&
  value.dataset === 'expenses' && 'category' in value && sourceCategory(value.category);
const revisionList = (value: unknown): value is readonly LocalSnapshotRevision[] =>
  Array.isArray(value) && [...value].every(localRevision);
const evidenceList = (value: unknown): value is readonly ExpenseCategoryEvidence[] =>
  Array.isArray(value) && [...value].every(categoryEvidence);
const metadataError = (
  code: 'invalid_revision_metadata' | 'inconsistent_category_provenance', reason: MetadataReason,
): SnapshotAdapterResult => ({ ok: false, error: { code, reason } });

/** Pure synthetic integration step. Validates both full responses before any
 * output. Only Phase 1 supplies checked money/timestamps; no live-data wiring,
 * authorization, authoritative revisions or persistence is implemented. */
export const buildClassificationSnapshots = (input: ClassificationSnapshotInput): SnapshotAdapterResult => {
  if (!object(input) || !identity(input.ownerScope)) return { ok: false, error: { code: 'invalid_owner_scope' } };
  const expenses = validateExpenseResponse(input.expenseResponse, input.period);
  if (!expenses.ok) return expenses;
  const incomes = validateIncomeResponse(input.incomeResponse, input.period);
  if (!incomes.ok) return incomes;

  const ids = {
    expenses: new Set(expenses.value.records.map((record) => record.id)),
    incomes: new Set(incomes.value.records.map((record) => record.id)),
  };
  if (input.revisions === undefined) return metadataError('invalid_revision_metadata', 'missing');
  if (!revisionList(input.revisions)) {
    return metadataError('invalid_revision_metadata', 'malformed');
  }
  const revisions = { expenses: new Map<string, string>(), incomes: new Map<string, string>() };
  for (const item of input.revisions) {
    if (item.ownerScope !== input.ownerScope) return metadataError('invalid_revision_metadata', 'owner_mismatch');
    if (!ids[item.dataset].has(item.transactionId)) return metadataError('invalid_revision_metadata', 'unknown_operation');
    const collection = revisions[item.dataset];
    if (collection.has(item.transactionId)) return metadataError('invalid_revision_metadata', 'duplicate');
    collection.set(item.transactionId, item.revision);
  }
  if (revisions.expenses.size !== ids.expenses.size || revisions.incomes.size !== ids.incomes.size) {
    return metadataError('invalid_revision_metadata', 'missing');
  }

  // Provenance-only join after authoritative response validation. Do not read
  // raw amounts/dates or reconstruct category strings from analytics grouping.
  const raw = input.expenseResponse;
  if (!object(raw) || !Array.isArray(raw.expenses)) return metadataError('inconsistent_category_provenance', 'malformed');
  const originalCategories = new Map<string, SourceCategory>();
  for (const record of raw.expenses) {
    if (!object(record) || typeof record._id !== 'string' ||
        !ids.expenses.has(record._id) || originalCategories.has(record._id) ||
        (record.category != null && typeof record.category !== 'string')) {
      return metadataError('inconsistent_category_provenance', 'malformed');
    }
    originalCategories.set(record._id, typeof record.category === 'string'
      ? { kind: 'label', value: record.category, dictionaryStatus: 'unresolved' } : { kind: 'absent' });
  }
  if (originalCategories.size !== ids.expenses.size) return metadataError('inconsistent_category_provenance', 'missing');

  const evidence = input.categoryEvidence === undefined ? [] : input.categoryEvidence;
  if (!evidenceList(evidence)) {
    return metadataError('inconsistent_category_provenance', 'malformed');
  }
  const supplied = new Set<string>();
  for (const item of evidence) {
    if (item.ownerScope !== input.ownerScope) return metadataError('inconsistent_category_provenance', 'owner_mismatch');
    const original = originalCategories.get(item.transactionId);
    if (!original) return metadataError('inconsistent_category_provenance', 'unknown_operation');
    if (supplied.has(item.transactionId)) return metadataError('inconsistent_category_provenance', 'duplicate');
    supplied.add(item.transactionId);
    const category = item.category;
    if (category.kind === 'absent' ? original.kind !== 'absent'
      : original.kind !== 'label' || category.value !== original.value) {
      return metadataError('inconsistent_category_provenance', 'source_mismatch');
    }
    originalCategories.set(item.transactionId, category.kind === 'absent' ? { kind: 'absent' }
      : { kind: 'label', value: category.value, dictionaryStatus: category.dictionaryStatus });
  }

  // Fresh arrays, deterministic code-unit ID order, no mutation of either input.
  const byId = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  return { ok: true, value: {
    revisionAuthority: 'caller_local',
    expenses: [...expenses.value.records].sort(byId).map((record) => ({
      ownerScope: input.ownerScope, dataset: 'expenses', transactionId: record.id,
      // Exact coverage was checked above. No fallback revision/category exists.
      revision: revisions.expenses.get(record.id)!,
      facts: { timestamp: record.timestamp, kopecks: record.kopecks, category: originalCategories.get(record.id)! },
    })),
    incomes: [...incomes.value.records].sort(byId).map((record) => ({
      ownerScope: input.ownerScope, dataset: 'incomes', transactionId: record.id,
      revision: revisions.incomes.get(record.id)!,
      facts: { timestamp: record.timestamp, kopecks: record.kopecks, sourceLabel: record.source },
    })),
  } };
};
