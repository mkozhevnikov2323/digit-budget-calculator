/** Single explicit command transport. No preparation, mutation retry or cache invalidation. */
import { isCurrentSession } from 'shared/api/sessionBoundary';
import { checkCredentialChange } from 'shared/api/credentialObservation';
import { closedData, validateClassificationRead, type ClassificationRead, type StableAssignment } from '../model/contract';
import type { HistoryOperation } from '../model/history';
export type DecisionIntent = { requestId: string; expectedRevision: number | null; state: 'approved' | 'explicit_unclassified'; assignment?: StableAssignment };
export const expectedSourceFacts = (operation: HistoryOperation) => ({
  amount: { format: 'binary64-roundtrip-decimal', value: Object.is(operation.facts.amount, -0) ? '-0' : String(operation.facts.amount) },
  dateEpochMs: operation.timestamp, date: new Date(operation.timestamp).toISOString(),
  ...(operation.dataset === 'expenses' ? { category: operation.facts.category, title: operation.facts.title, recipient: operation.facts.recipient } : { source: operation.facts.source }),
  comment: !Object.prototype.hasOwnProperty.call(operation.facts, 'comment') ? { kind: 'missing' } : operation.facts.comment === null ? { kind: 'null' } : { kind: 'value', value: operation.facts.comment },
});
export type DecisionResult = { ok: true; decision: ClassificationRead } | { ok: false; code: 'conflict' | 'unknown' | 'unavailable' | 'session_changed' };
export const putDecision = async (options: { baseUrl: string; generation: number; current: () => boolean; signal: AbortSignal; operation: HistoryOperation; intent: DecisionIntent; transport?: typeof fetch }): Promise<DecisionResult> => {
  const current = () => !checkCredentialChange() && !options.signal.aborted && options.current() && isCurrentSession(options.generation);
  if (!current()) return {ok:false,code:'session_changed'};
  const token = localStorage.getItem('token');
  if (!token) return {ok:false,code:'session_changed'};
  try {
    const response = await (options.transport ?? fetch)(`${options.baseUrl.replace(/\/$/,'')}/classifications/${options.operation.dataset}/${encodeURIComponent(options.operation.operationId)}/decision`, {
      method:'PUT',cache:'no-store',credentials:'omit',signal:options.signal,
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({version:'classification-decision-v1',...options.intent,expectedFacts:expectedSourceFacts(options.operation)}),
    });
    if (!current() || localStorage.getItem('token') !== token) return {ok:false,code:'session_changed'};
    const raw: unknown = await response.json();
    if (!current() || localStorage.getItem('token') !== token) return {ok:false,code:'session_changed'};
    if (!response.ok) {
      const e=closedData(raw,['version','ok','error','persistence']);
      return {ok:false,code:e?.version !== 'classification-decision-v1' || e.persistence !== 'not_applied' ? 'unknown' : response.status === 409 ? 'conflict' : response.status === 401 ? 'session_changed' : 'unavailable'};
    }
    const r=closedData(raw,['version','outcome','decision']);
    const d=r && validateClassificationRead(r.decision,options.operation.dataset,options.operation.operationId), intent=options.intent;
    if (!r || Object.keys(r).length!==3 || r.version!=='classification-decision-v1' || !['created','updated','replayed'].includes(String(r.outcome))
      || r.outcome==='created' && intent.expectedRevision!==null || r.outcome==='updated' && intent.expectedRevision===null
      || !d || d.decisionRevision!==(intent.expectedRevision??0)+1 || d.storedState!==intent.state || ![intent.state,'stale'].includes(d.status)
      || d.status==='approved' && (d.confirmed?.economicRole!==intent.assignment?.economicRole || d.confirmed?.layer!==intent.assignment?.layer)) return {ok:false,code:'unknown'};
    return {ok:true,decision:d};
  } catch {return {ok:false,code:current()?'unknown':'session_changed'};}
};
