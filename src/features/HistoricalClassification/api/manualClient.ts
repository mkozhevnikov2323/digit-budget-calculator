/** Ephemeral proof transport, deliberately outside Redux/RTK cache/actions. */
import { isCurrentSession } from 'shared/api/sessionBoundary';
import { checkCredentialChange } from 'shared/api/credentialObservation';
import { closedData, stableAssignment, STABLE_TAXONOMY, type DecisionState, type StableAssignment } from '../model/contract';
import { parseSourceFacts } from '../model/coherentHistory';
type Dataset = 'expenses' | 'incomes';
export type ManualIntent = { requestId: string; expectedRevision: number | null; state: DecisionState; assignment?: StableAssignment };
export type ReviewRequest = ManualIntent & { version: 'classification-review-request-v1'; browserReviewContext: string };
export type PreparedReview = { request: ReviewRequest; reviewProof: string; expiresAt: number;
  facts: Record<string, unknown>; currentDecision: { storedState: DecisionState | null; decisionRevision: number | null } };
export type ManualResult<T> = { ok: true; value: T } | { ok: false; code: 'session_changed' | 'unavailable' | 'conflict' | 'expired' | 'unknown_outcome' | 'invalid_response' };
const uuid = (x: unknown): x is string => typeof x === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);

export const createManualClient = (options: { baseUrl: string; generation: number; current: () => boolean; signal: AbortSignal;
  transport?: typeof fetch; credential?: () => string | null }) => {
  const transport = options.transport ?? fetch, credential = options.credential ?? (() => localStorage.getItem('token'));
  const current = () => !checkCredentialChange() && !options.signal.aborted && options.current() && isCurrentSession(options.generation);
  const post = async (dataset: Dataset, id: string, action: string, body: unknown, mutation: boolean): Promise<ManualResult<unknown>> => {
    if (!current()) return { ok: false, code: 'session_changed' };
    const token = credential(); if (!token) return { ok: false, code: 'session_changed' };
    try {
      const res = await transport(`${options.baseUrl.replace(/\/$/, '')}/classifications/${dataset}/${encodeURIComponent(id)}/${action}`, {
        method: 'POST', cache: 'no-store', credentials: 'omit', signal: options.signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!current() || credential() !== token) return { ok: false, code: 'session_changed' };
      // Never preserve Request/Response, raw driver text or sensitive server errors.
      if (!res.ok) return { ok: false, code: res.status === 409 ? 'conflict' : res.status === 410 ? 'expired'
        : mutation && res.status >= 500 ? 'unknown_outcome' : 'unavailable' };
      const data: unknown = await res.json();
      return current() && credential() === token ? { ok: true, value: data } : { ok: false, code: 'session_changed' };
    } catch { return { ok: false, code: !current() ? 'session_changed' : mutation ? 'unknown_outcome' : 'unavailable' }; }
  };
  return {
    async prepare(dataset: Dataset, operationId: string, request: ReviewRequest): Promise<ManualResult<PreparedReview>> {
      const response = await post(dataset, operationId, 'reviews', request, false); if (!response.ok) return response;
      const r = closedData(response.value, ['version', 'dataset', 'operationId', 'taxonomyVersion', 'browserReviewContext',
        'currentDecision', 'intent', 'facts', 'reviewProof', 'expiresAt', 'consistency']);
      const intent = r && closedData(r.intent, ['requestId', 'expectedRevision', 'state', 'assignment']);
      const d = r && closedData(r.currentDecision, ['storedState', 'decisionRevision']);
      const f = r && closedData(r.facts, ['amount', 'dateEpochMs', 'comment', ...(dataset === 'expenses' ? ['category', 'title', 'recipient'] : ['source'])]);
      const normalized = f && typeof f.dateEpochMs === 'number' && Number.isFinite(new Date(f.dateEpochMs).getTime())
        ? parseSourceFacts({ ...f, date: new Date(f.dateEpochMs).toISOString() }, dataset) : null;
      const assignment = intent && Object.prototype.hasOwnProperty.call(intent, 'assignment') ? stableAssignment(intent.assignment, dataset) : undefined;
      if (!r || Object.keys(r).length !== 11 || r.version !== 'classification-review-v1' || r.dataset !== dataset || r.operationId !== operationId
        || r.taxonomyVersion !== STABLE_TAXONOMY || r.browserReviewContext !== request.browserReviewContext || !uuid(request.requestId)
        || !intent || intent.requestId !== request.requestId || intent.expectedRevision !== request.expectedRevision || intent.state !== request.state
        || JSON.stringify(assignment) !== JSON.stringify(request.assignment) || !d || Object.keys(d).length !== 2
        || d.decisionRevision !== request.expectedRevision || (d.decisionRevision === null ? d.storedState !== null : !['approved', 'explicit_unclassified', 'cleared'].includes(String(d.storedState)))
        || !normalized || typeof r.reviewProof !== 'string' || r.reviewProof.length > 4096 || !/^crp1\.[a-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(r.reviewProof)
        || typeof r.expiresAt !== 'number' || !Number.isSafeInteger(r.expiresAt) || r.expiresAt < 0 || r.expiresAt > 253402300799
        || r.consistency !== 'observed_only_non_atomic') return { ok: false, code: 'invalid_response' };
      // Copy safe JSON only; no RTK Query cache or browser storage.
      return { ok: true, value: { request: { ...request, ...(request.assignment ? { assignment: { ...request.assignment } } : {}) },
        facts: JSON.parse(JSON.stringify(f)), reviewProof: r.reviewProof, expiresAt: r.expiresAt,
        currentDecision: { storedState: d.storedState as DecisionState | null, decisionRevision: request.expectedRevision } } };
    },
    async apply(dataset: Dataset, operationId: string, prepared: PreparedReview): Promise<ManualResult<'applied'>> {
      const response = await post(dataset, operationId, 'commands', { ...prepared.request, version: 'classification-command-v1', reviewProof: prepared.reviewProof }, true);
      if (!response.ok) return response;
      const r = closedData(response.value, ['version', 'dataset', 'operationId', 'requestId', 'outcome', 'storedState', 'decisionRevision', 'sourceStatus', 'confirmed', 'consistency']);
      const c = prepared.request;
      if (!r || Object.keys(r).length !== 10 || r.version !== 'classification-write-ack-v1' || r.dataset !== dataset || r.operationId !== operationId || r.requestId !== c.requestId
        || !['created', 'updated', 'replayed'].includes(String(r.outcome)) || r.storedState !== c.state || r.decisionRevision !== (c.expectedRevision === null ? 1 : c.expectedRevision + 1)
        || !['matching_observed', 'stale', 'missing', 'invalid', 'unavailable'].includes(String(r.sourceStatus)) || r.confirmed !== null || r.consistency !== 'observed_only_non_atomic')
        return { ok: false, code: 'unknown_outcome' };
      return { ok: true, value: 'applied' };
    },
    async reconcile(dataset: Dataset, operationId: string, prepared: PreparedReview): Promise<ManualResult<'applied' | 'indeterminate'>> {
      const response = await post(dataset, operationId, 'commands/reconcile', { ...prepared.request, version: 'classification-reconcile-request-v1', reviewProof: prepared.reviewProof }, false);
      if (!response.ok) return response;
      const r = closedData(response.value, ['version', 'dataset', 'operationId', 'requestId', 'result', 'receipt', 'confirmed', 'consistency']);
      if (!r || Object.keys(r).length !== 8 || r.version !== 'classification-reconcile-v1' || r.dataset !== dataset || r.operationId !== operationId
        || r.requestId !== prepared.request.requestId || r.confirmed !== null || r.consistency !== 'observed_only_non_atomic') return { ok: false, code: 'invalid_response' };
      if (r.result === 'indeterminate' && r.receipt === null) return { ok: true, value: 'indeterminate' };
      const receipt = closedData(r.receipt, ['storedState', 'decisionRevision', 'sourceStatus']);
      if (r.result !== 'latest_applied' || !receipt || Object.keys(receipt).length !== 3 || receipt.storedState !== prepared.request.state
        || receipt.decisionRevision !== (prepared.request.expectedRevision === null ? 1 : prepared.request.expectedRevision + 1)
        || !['matching_observed', 'stale'].includes(String(receipt.sourceStatus))) return { ok: false, code: 'invalid_response' };
      return { ok: true, value: 'applied' };
    },
  };
};
