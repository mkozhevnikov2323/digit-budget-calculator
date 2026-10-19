import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { skipToken, type QueryStatus } from '@reduxjs/toolkit/query';
import { useStore } from 'react-redux';
import type { RootState } from 'app/providers/store/store';
import { useVerifiedOwner } from '../../../entities/User/model/useVerifiedOwner';
import { expenseApi, useGetExpensesQuery } from '../../../entities/Expense/api/expenseApi';
import { incomeApi, useGetIncomesQuery } from '../../../entities/Income/api/incomeApi';
import { isCurrentSession } from 'shared/api/sessionBoundary';
import { monthPeriod, type CalendarPeriod } from '../../FinancialAnalytics/model/period';
import { toAnalyticsQueryParams } from '../../FinancialAnalytics/model/apiRange';
import { validateExpenseResponse, validateIncomeResponse } from '../../FinancialAnalytics/model/validation';
import { buildClassificationSnapshots, type ClassificationSnapshots, type LocalSnapshotRevision, type SnapshotAdapterError } from './snapshotAdapter';

export type OwnerClassificationContext = Readonly<{
  userId: string;
  sessionGeneration: number;
  periodKey: string;
  loadGeneration: string;
}>;
export type OwnerClassificationData =
  | { readonly status: 'blocked'; readonly reason: 'unauthenticated' | 'verifying' | 'verification_error' | 'invalid_period' }
  | { readonly status: 'loading' | 'fetching' }
  | { readonly status: 'error'; readonly error: SnapshotAdapterError; readonly retry: () => void }
  | { readonly status: 'ready'; readonly context: OwnerClassificationContext; readonly data: ClassificationSnapshots };

type Dataset = 'expenses' | 'incomes';
const datasets: readonly Dataset[] = ['expenses', 'incomes'];
type QueryState = { status: QueryStatus; requestId?: string; data?: unknown };
type Pair = Record<Dataset, QueryState>;
const queryState = ({ status, requestId, data }: QueryState): QueryState => ({ status, requestId, data });
type Round = {
  key: string;
  entry: object;
  context: OwnerClassificationContext;
  read: () => Pair;
  targets: Partial<Record<Dataset, string>>;
  sources?: Pair;
  finished: boolean;
  failed: boolean;
  retry: boolean;
  phase: 'loading' | 'fetching';
};
type Publication = { key: string; entry: object; result: OwnerClassificationData; sources?: Pair };

/** Only one complete canonical UTC month. Calendar and request conversions stay
 * in Phase 1; this is a scope restriction, not a second date implementation. */
const selectedMonth = (period: CalendarPeriod | null) => {
  if (!period || typeof period.firstDate !== 'string') return null;
  const month = monthPeriod(Number(period.firstDate.slice(0, 4)), Number(period.firstDate.slice(5, 7)));
  if (!month.ok || period.firstDate !== month.value.firstDate || period.lastDate !== month.value.lastDate ||
      period.startInclusive !== month.value.startInclusive || period.endExclusive !== month.value.endExclusive) return null;
  const params = toAnalyticsQueryParams(month.value);
  return params.ok ? { period: month.value, params: params.value, key: month.value.firstDate.slice(0, 7) } : null;
};
const unchanged = (sources: Pair, current: Pair) => datasets.every((dataset) =>
  sources[dataset].requestId === current[dataset].requestId &&
  sources[dataset].status === current[dataset].status && sources[dataset].data === current[dataset].data);

/** One coordinator per future review composition. No production consumer yet.
 * Query hooks own subscriptions; this coordinator only refetches existing GETs.
 * Never use query-promise data/requestId as ownership proof: RTK can deduplicate
 * an initiation and its promise subsequently selects the shared cache entry. */
export const useOwnerClassificationData = (period: CalendarPeriod | null): OwnerClassificationData => {
  const owner = useVerifiedOwner();
  const month = useMemo(() => selectedMonth(period),
    [period?.firstDate, period?.lastDate, period?.startInclusive, period?.endExclusive]);
  const enabled = owner.status === 'verified' && month !== null;
  const key = enabled ? JSON.stringify([owner.owner.userId, owner.owner.sessionGeneration, month.key]) : null;
  const [entry, setEntry] = useState({ key, marker: {} });
  // Record every rendered context change before commit, including A/B/A and
  // verified/verifying/verified. Returning to the same key is a new lifecycle.
  if (entry.key !== key) setEntry({ key, marker: {} });
  const args = enabled ? month.params : skipToken;
  const expenses = useGetExpensesQuery(args);
  const incomes = useGetIncomesQuery(args);
  const store = useStore<RootState>();
  const instance = useId();
  const sequence = useRef(0); // accepted-load identity only, never auth generation
  const active = useRef<Round | null>(null);
  // Only obsolete in-flight requests are retained, as metadata selectors. Prune
  // on each commit; no response payloads or history of accepted records is kept.
  const obsoletePending = useRef(new Map<string, () => QueryState>());
  const [publication, publish] = useState<Publication | null>(null);
  const read = useMemo(() => {
    if (!month) return null;
    const expense = expenseApi.endpoints.getExpenses.select(month.params);
    const income = incomeApi.endpoints.getIncomes.select(month.params);
    return (): Pair => ({ expenses: queryState(expense(store.getState())), incomes: queryState(income(store.getState())) });
  }, [month, store]);
  const retry = useCallback(() => {
    const round = active.current;
    if (!round || !round.failed || round.retry) return;
    round.retry = true;
    publish({ key: round.key, entry: round.entry, result: { status: 'fetching' } });
  }, []);

  // Intentionally run the small metadata coordinator after every commit. Each
  // target is assigned once per round; validation/publication is done once.
  // No timer, promise-completion refresh chain or payload-identity refresh proof.
  useEffect(() => {
    for (const [id, select] of obsoletePending.current) {
      const query = select();
      if (query.requestId !== id || query.status !== 'pending') obsoletePending.current.delete(id);
    }
    const retire = (round: Round) => {
      const readPair = round.read;
      const pair = readPair();
      for (const dataset of datasets) {
        const query = pair[dataset];
        if (query.status === 'pending' && query.requestId && query.requestId === round.targets[dataset]) {
          obsoletePending.current.set(query.requestId, () => readPair()[dataset]);
        }
      }
    };
    if (!enabled || !key || !read || !isCurrentSession(owner.owner.sessionGeneration)) {
      if (active.current) retire(active.current);
      active.current = null;
      if (publication) publish(null);
      return;
    }
    const previousRound = active.current;
    let pair = read();
    const sameContext = previousRound !== null && previousRound.key === key && previousRound.entry === entry.marker;
    const replaced = previousRound && datasets.some((dataset) => previousRound.targets[dataset] &&
      previousRound.targets[dataset] !== pair[dataset].requestId);
    const sources = previousRound?.sources;
    const edited = sources && datasets.some((dataset) => sources[dataset].status === 'fulfilled' &&
      sources[dataset].data !== pair[dataset].data);
    let round = previousRound;
    if (!round || !sameContext || round.retry || replaced || edited) {
      const previous = round;
      if (previous) retire(previous);
      sequence.current += 1;
      round = { key, entry: entry.marker, context: { ...owner.owner, periodKey: month.key,
        loadGeneration: `${instance}/${sequence.current}` }, read, targets: {}, finished: false, failed: false, retry: false,
        phase: previous && sameContext ? 'fetching' : 'loading' };
      // A fast external refresh can settle before React sees pending. Its new
      // requestId is evidence of a new request even with structural sharing.
      if (previous && sameContext && !previous.retry) for (const dataset of datasets) {
        const query = pair[dataset];
        if (query.requestId && query.requestId !== previous.targets[dataset] && query.status === 'fulfilled') {
          round.targets[dataset] = query.requestId;
        }
      }
      active.current = round;
      publish({ key, entry: entry.marker, result: { status: round.phase } });
    }
    const currentRound = round;
    for (const dataset of datasets) {
      if (currentRound.targets[dataset]) continue;
      let query = pair[dataset];
      if (query.status === 'pending' && query.requestId && obsoletePending.current.has(query.requestId)) continue;
      if (query.status !== 'pending') {
        // Existing hooks are subscribed by this effect. refetch shares an
        // already-running request; fulfilled cache requires a fresh request.
        if (dataset === 'expenses') expenses.refetch(); else incomes.refetch();
        pair = read(); query = pair[dataset];
      }
      if (query.requestId) currentRound.targets[dataset] = query.requestId;
    }
    pair = read();
    if (!isCurrentSession(owner.owner.sessionGeneration)) return;
    if (currentRound.finished) return;
    const failed = datasets.find((dataset) => currentRound.targets[dataset] === pair[dataset].requestId && pair[dataset].status === 'rejected');
    const finish = (result: OwnerClassificationData) => {
      currentRound.finished = true; currentRound.failed = result.status === 'error'; currentRound.sources = pair;
      publish({ key, entry: entry.marker, result, sources: pair });
    };
    if (failed) {
      finish({ status: 'error', error: { code: 'request_failed', dataset: failed }, retry });
      return;
    }
    if (!datasets.every((dataset) => currentRound.targets[dataset] && currentRound.targets[dataset] === pair[dataset].requestId &&
        pair[dataset].status === 'fulfilled' && pair[dataset].data !== undefined)) return;
    const checkedExpenses = validateExpenseResponse(pair.expenses.data, month.period);
    const checkedIncomes = validateIncomeResponse(pair.incomes.data, month.period);
    if (!checkedExpenses.ok || !checkedIncomes.ok) {
      finish({ status: 'error', error: !checkedExpenses.ok ? checkedExpenses.error :
        !checkedIncomes.ok ? checkedIncomes.error : { code: 'unavailable_response' }, retry });
      return;
    }
    const revisions: LocalSnapshotRevision[] = [
      ...checkedExpenses.value.records.map((record): LocalSnapshotRevision => ({ kind: 'caller_local',
        ownerScope: owner.owner.userId, dataset: 'expenses', transactionId: record.id, revision: currentRound.context.loadGeneration })),
      ...checkedIncomes.value.records.map((record): LocalSnapshotRevision => ({ kind: 'caller_local',
        ownerScope: owner.owner.userId, dataset: 'incomes', transactionId: record.id, revision: currentRound.context.loadGeneration })),
    ];
    const adapted = buildClassificationSnapshots({ expenseResponse: pair.expenses.data, incomeResponse: pair.incomes.data,
      ownerScope: owner.owner.userId, period: month.period, revisions });
    finish(adapted.ok ? { status: 'ready', context: currentRound.context, data: adapted.value }
      : { status: 'error', error: adapted.error, retry });
  });

  // Render-time guards hide a publication before the coordinator's effect can
  // run. Previous context, partial requests and refetch data never reach ready.
  if (owner.status !== 'verified') return { status: 'blocked', reason: owner.status };
  if (!month || !key || !read) return { status: 'blocked', reason: 'invalid_period' };
  if (!publication || publication.key !== key || publication.entry !== entry.marker) return { status: 'loading' };
  const sources = publication.sources;
  if (sources) {
    const current = read();
    if (publication.result.status === 'ready' ? !unchanged(sources, current) :
      datasets.some((dataset) => sources[dataset].requestId !== current[dataset].requestId ||
        (sources[dataset].status === 'fulfilled' && sources[dataset].data !== current[dataset].data))) {
      return { status: 'fetching' };
    }
  }
  return publication.result;
};
