import { isCurrentSession } from 'shared/api/sessionBoundary';
import { checkCredentialChange } from 'shared/api/credentialObservation';
import {
  closedData,
  type DecisionState,
} from 'features/HistoricalClassification/model/contract';
import { envelope, readDecision, type GroupRead } from '../model/contract';
export type GroupIntent = {
  version: 'classification-group-decision-v3';
  requestId: string;
  expectedRevision: number | null;
  state: DecisionState;
  groupId?: string;
  expectedFacts: unknown;
};
export type GroupDecisionResult =
  | { ok: true; decision: GroupRead }
  | {
      ok: false;
      code: 'unknown' | 'conflict' | 'unavailable' | 'session_changed';
    };
export const groupDecisionRequest = async (o: {
  baseUrl: string;
  generation: number;
  current: () => boolean;
  signal: AbortSignal;
  read: GroupRead;
  intent: GroupIntent;
  reconcile?: boolean;
  transport?: typeof fetch;
}): Promise<GroupDecisionResult> => {
  const current = () =>
    !checkCredentialChange() &&
    !o.signal.aborted &&
    o.current() &&
    isCurrentSession(o.generation);
  if (!current()) return { ok: false, code: 'session_changed' };
  const token = localStorage.getItem('token');
  if (!token) return { ok: false, code: 'session_changed' };
  try {
    const response = await (o.transport ?? fetch)(
      `${o.baseUrl.replace(/\/$/, '')}/classification-groups/operations/${o.read.dataset}/${o.read.operationId}/${o.reconcile ? 'reconcile' : 'decision'}`,
      {
        method: o.reconcile ? 'POST' : 'PUT',
        cache: 'no-store',
        credentials: 'omit',
        signal: o.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(o.intent),
      },
    );
    if (!current() || localStorage.getItem('token') !== token)
      return { ok: false, code: 'session_changed' };
    const raw: unknown = await response.json();
    if (!current() || localStorage.getItem('token') !== token)
      return { ok: false, code: 'session_changed' };
    if (!response.ok) {
      const e = closedData(raw, ['version', 'error', 'persistence']);
      const detail = e && closedData(e.error, ['code']);
      return {
        ok: false,
        code:
          !e ||
          Object.keys(e).length !== 3 ||
          !detail ||
          Object.keys(detail).length !== 1 ||
          typeof detail.code !== 'string' ||
          e.version !== 'classification-groups-v3' ||
          e.persistence !== 'not_applied'
            ? 'unknown'
            : response.status === 409
              ? 'conflict'
              : response.status === 401
                ? 'session_changed'
                : 'unavailable',
      };
    }
    const r = closedData(
        envelope(raw),
        o.reconcile
          ? ['version', 'outcome', 'decision', 'consistency']
          : ['outcome', 'decision'],
      ),
      d = r && readDecision(r.decision, o.read.dataset, o.read.operationId),
      i = o.intent;
    if (
      !r ||
      Object.keys(r).length !== (o.reconcile ? 4 : 2) ||
      !d ||
      d.decisionRevision !== (i.expectedRevision ?? 0) + 1 ||
      d.storedState !== i.state ||
      d.storedGroupId !== (i.groupId ?? null) ||
      ![i.state, 'stale'].some((x) => x === d.status)
    )
      return { ok: false, code: 'unknown' };
    if (o.reconcile) {
      if (
        r.version !== 'classification-group-reconcile-v3' ||
        r.consistency !== 'observed_only_non_atomic' ||
        r.outcome !== 'observed_matching'
      )
        return { ok: false, code: 'unknown' };
    } else if (
      !['created', 'updated', 'replayed'].some((x) => x === r.outcome) ||
      (r.outcome === 'created' && i.expectedRevision !== null) ||
      (r.outcome === 'updated' && i.expectedRevision === null)
    )
      return { ok: false, code: 'unknown' };
    if (
      d.status !== 'stale' &&
      JSON.stringify(d.facts) !== JSON.stringify(i.expectedFacts)
    )
      return { ok: false, code: 'unknown' };
    return { ok: true, decision: d };
  } catch {
    return { ok: false, code: current() ? 'unknown' : 'session_changed' };
  }
};
