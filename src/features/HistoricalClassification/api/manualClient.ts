/** Ephemeral C preparation transport, deliberately outside Redux/RTK cache/actions. */
import { isCurrentSession } from 'shared/api/sessionBoundary';
import { checkCredentialChange } from 'shared/api/credentialObservation';
import { closedData, stableAssignment, validateClassificationRead, type DecisionState, type StableAssignment } from '../model/contract';
import { parseSourceFacts } from '../model/coherentHistory';
type Dataset = 'expenses' | 'incomes';
export type ManualIntent = { requestId: string; expectedRevision: number | null; state: DecisionState; assignment?: StableAssignment };
export type ReviewRequest = ManualIntent & { version: 'classification-c-v1' };
export type PreparedReview = { request: ReviewRequest; preparationId: string; expiresAt: number;
  facts: Record<string, unknown>; currentDecision: { storedState: DecisionState | null; decisionRevision: number | null } };
export type ManualResult<T> = { ok: true; value: T } | { ok: false; code: 'session_changed' | 'unavailable' | 'conflict' | 'expired' | 'context_lost' | 'unknown_outcome' | 'invalid_response' };
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
      if (!res.ok) {
        let persistence: unknown;
        try {
          const e = closedData(await res.json(), ['version','result','error','persistence']);
          const result = e && closedData(e.result, ['ok','error','persistence']);
          if (e?.version === 'classification-c-v1') persistence = result?.ok === false ? result.persistence : e.persistence;
        } catch { /* Never infer a failed write from an unreadable error. */ }
        return { ok: false, code: res.status === 401 ? 'session_changed' : res.status === 410 ? 'context_lost'
          : mutation && (res.status >= 500 || persistence === 'unknown' || (res.status === 409 && persistence !== 'not_applied')) ? 'unknown_outcome'
            : res.status === 409 ? 'conflict' : 'unavailable' };
      }
      const data: unknown = await res.json();
      return current() && credential() === token ? { ok: true, value: data } : { ok: false, code: 'session_changed' };
    } catch { return { ok: false, code: !current() ? 'session_changed' : mutation ? 'unknown_outcome' : 'unavailable' }; }
  };
  return {
    async prepare(dataset: Dataset, operationId: string, request: ReviewRequest): Promise<ManualResult<PreparedReview>> {
      const command = { kind: 'manual_classification', dataset, operationId, requestId: request.requestId,
        expectedRevision: request.expectedRevision, state: request.state, ...(request.assignment ? { assignment: request.assignment } : {}) };
      const response = await post(dataset, operationId, 'c-v1/prepare', { version: 'classification-c-v1', command }, false);
      if (!response.ok) return response;
      const r = closedData(response.value, ['version','preparationId','expiresAt','command','facts','currentDecision','consistency']);
      const c = r && closedData(r.command, Object.keys(command));
      const assignment = c && Object.prototype.hasOwnProperty.call(c, 'assignment') ? stableAssignment(c.assignment, dataset) : undefined;
      const d = r && validateClassificationRead(r.currentDecision, dataset, operationId);
      const facts = r && parseSourceFacts(r.facts, dataset);
      if (!r || Object.keys(r).length !== 7 || r.version !== 'classification-c-v1' || !uuid(request.requestId)
        || !c || Object.keys(c).length !== Object.keys(command).length || c.kind !== command.kind || c.dataset !== dataset || c.operationId !== operationId
        || c.requestId !== request.requestId || c.expectedRevision !== request.expectedRevision || c.state !== request.state
        || JSON.stringify(assignment) !== JSON.stringify(request.assignment) || !d || d.status === 'blocked' || d.decisionRevision !== request.expectedRevision
        || !facts || typeof r.preparationId !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(r.preparationId)
        || typeof r.expiresAt !== 'number' || !Number.isSafeInteger(r.expiresAt) || r.expiresAt <= Date.now() || r.expiresAt > 253402300799999
        || r.consistency !== 'observed_only_non_atomic') return { ok: false, code: 'invalid_response' };
      return { ok: true, value: { request: { ...request, ...(request.assignment ? { assignment: { ...request.assignment } } : {}) },
        facts: JSON.parse(JSON.stringify(r.facts)), preparationId: r.preparationId, expiresAt: r.expiresAt,
        currentDecision: { storedState: d.storedState, decisionRevision: d.decisionRevision } } };
    },
    async apply(dataset: Dataset, operationId: string, prepared: PreparedReview): Promise<ManualResult<'applied'>> {
      const response = await post(dataset, operationId, 'c-v1/apply', { version: 'classification-c-v1', preparationId: prepared.preparationId, confirmation: 'confirm_prepared_intent' }, true);
      if (!response.ok) return response;
      const envelope = closedData(response.value, ['version','result']);
      const result = envelope && closedData(envelope.result, ['ok','value']);
      const r = result && closedData(result.value, ['version','outcome','storedState','decisionRevision','sourceStatus','confirmed','consistency']);
      if (!envelope || Object.keys(envelope).length !== 2 || envelope.version !== 'classification-c-v1' || !result || Object.keys(result).length !== 2 || result.ok !== true
        || !r || Object.keys(r).length !== 7 || r.version !== 'classification-write-result-v1' || !['created','updated','replayed'].includes(String(r.outcome))
        || r.storedState !== prepared.request.state || r.decisionRevision !== (prepared.request.expectedRevision ?? 0) + 1
        || !['matching_observed','stale','missing','invalid','unavailable'].includes(String(r.sourceStatus)) || r.confirmed !== null || r.consistency !== 'observed_only_non_atomic')
        return { ok: false, code: 'unknown_outcome' };
      return { ok: true, value: 'applied' };
    },
    async reconcile(dataset: Dataset, operationId: string, prepared: PreparedReview): Promise<ManualResult<'applied' | 'indeterminate'>> {
      const response = await post(dataset, operationId, 'c-v1/reconcile', { version: 'classification-c-v1', preparationId: prepared.preparationId }, false);
      if (!response.ok) return response;
      const r = closedData(response.value, ['version','outcome','consistency']);
      if (!r || Object.keys(r).length !== 3 || r.version !== 'classification-c-v1' || !['latest_applied','indeterminate'].includes(String(r.outcome))
        || r.consistency !== 'observed_only_non_atomic') return { ok: false, code: 'invalid_response' };
      return { ok: true, value: r.outcome === 'latest_applied' ? 'applied' : 'indeterminate' };
    },
  };
};
