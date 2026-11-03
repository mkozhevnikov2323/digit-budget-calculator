import { useAnalyticsState } from 'features/AnalyticsState/model/useAnalyticsState';
import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Alert, Button, Divider, Stack, Typography } from '@mui/material';
import { baseApi, apiBaseUrl } from 'shared/api/baseApi';
import { createManualClient, type PreparedReview, type ReviewRequest } from '../api/manualClient';
import type { DecisionQuery } from '../api/historyApi';
import type { ClassificationRead, DecisionState, StableAssignment } from '../model/contract';
import { parseSourceFacts } from '../model/coherentHistory';
import type { HistoryOperation } from '../model/history';

/** Keyed by operation/draft/session/period. Preparation IDs stay only in component memory. */
export const PersistentReview = ({ operation, scope, decision, state, assignment, onSaved, dirty = true, valid = true, onCancel, onBusy, onRefresh }: {
  operation: HistoryOperation; scope: Omit<DecisionQuery, 'dataset' | 'operationId'>; decision: ClassificationRead;
  state: DecisionState; assignment?: StableAssignment; onSaved: () => void; onRefresh?: () => void; dirty?: boolean; valid?: boolean; onCancel?: () => void; onBusy?: (busy: boolean) => void;
}) => {
  const dispatch = useDispatch();
  // A risk flag may survive tab navigation, but the preparation ID never does.
  const [unresolved,setUnresolved]=useAnalyticsState(`unresolved/${operation.dataset}/${operation.operationId}`,false);
  const [prepared, setPrepared] = useState<PreparedReview | null>(null);
  const [expiredPreparation, setExpiredPreparation] = useState<PreparedReview | null>(null);
  useEffect(() => {
    if (!prepared) return;
    const timer = setTimeout(() => setExpiredPreparation(prepared), Math.max(0, Math.min(2147483647, prepared.expiresAt - Date.now())));
    return () => clearTimeout(timer);
  }, [prepared]);
  const [attempt, setAttempt] = useState(0), [preparing, setPreparing] = useState(false), [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(unresolved), [message, setMessage] = useState('');
  const preparationEpoch = useRef(0);
  const live = useRef(true), active = useRef(false), controller = useRef(new AbortController());
  useEffect(() => {
    live.current = true;
    // StrictMode remount must not reuse an aborted controller.
    controller.current = new AbortController();
    const reset = (event: PageTransitionEvent) => {
      if (event.type === 'pageshow' && !event.persisted) return;
      live.current = false; controller.current.abort(); setPrepared(null);  setUncertain(false);
      setMessage('После возврата на страницу обновите состояние. Исход отправленного сохранения мог остаться неопределённым.');
    };
    window.addEventListener('pagehide', reset); window.addEventListener('pageshow', reset);
    return () => { live.current = false; controller.current.abort(); window.removeEventListener('pagehide', reset); window.removeEventListener('pageshow', reset); };
  }, []);
  const client = () => createManualClient({ baseUrl: apiBaseUrl, generation: scope.sessionGeneration,
    current: () => live.current, signal: controller.current.signal });
  const success = () => {
    setUnresolved(false); setPrepared(null);  setUncertain(false);
    setMessage('Классификация сохранена.');
    dispatch(baseApi.util.invalidateTags(['Classification'])); onSaved();
  };
  const matches = (target: PreparedReview) => {
  const facts = parseSourceFacts(target.facts, operation.dataset);
  return !!facts && Object.is(facts.amount, operation.facts.amount) && Date.parse(facts.date) === operation.timestamp
    && ['category', 'title', 'recipient', 'source', 'comment'].every(k => Object.prototype.hasOwnProperty.call(facts,k) === Object.prototype.hasOwnProperty.call(operation.facts,k)
      && facts[k as keyof typeof facts] === operation.facts[k as keyof typeof operation.facts]);
  };
  const factsMatch = !!prepared && matches(prepared);
  const run = async (action: 'apply' | 'reconcile' | 'unclassified') => {
    if (active.current || !live.current) return;
    active.current = true; setBusy(true); setMessage('');
    try {
      let target = prepared;
      if (action === 'unclassified') {
        if (uncertain || blocked || decision.status === 'blocked' || decision.status === 'explicit_unclassified') return;
        onBusy?.(true);++preparationEpoch.current;setPrepared(null);
        const result = await client().prepare(operation.dataset, operation.operationId, {version:'classification-c-v1',requestId:crypto.randomUUID(),expectedRevision:decision.decisionRevision,state:'explicit_unclassified'});
        if (!live.current) return;
        if (!result.ok) { setBlocked(true);setMessage('Не удалось подготовить действие. Обновите состояние перед новой попыткой.');return; }
        target=result.value;
        if (!matches(target) || Date.now() >= target.expiresAt) {setBlocked(true);setMessage('Факты изменились или проверка истекла. Обновите историю.');return;}
        setPrepared(target);
      }
      if (target) {
        if (action !== 'reconcile' && ((action !== 'unclassified' && (!dirty || !valid)) || !matches(target) || blocked || uncertain || Date.now() >= target.expiresAt)) {
          setMessage('Нужно заново подготовить и проверить факты.'); return;
        }
        if(action!=='reconcile'){setUnresolved(true);onBusy?.(true);}
        const result = await client()[action === 'reconcile' ? 'reconcile' : 'apply'](operation.dataset, operation.operationId, target);
        if (!live.current) return;
        if (result.ok && result.value === 'applied') success();
        else if (result.ok) { setUncertain(true); setMessage('Результат остаётся неопределённым. Новая запись автоматически не отправляется.'); }
        else if (result.code === 'context_lost') { setPrepared(null);  setUncertain(true); setMessage('Срок проверки истёк или контекст утрачен. Исход сохранения неизвестен. Обновите состояние без повторной записи.'); }
        else if (result.code === 'unknown_outcome') { setUncertain(true); setMessage('Ответ о сохранении не получен. Запись могла сохраниться. Доступна только проверка результата.'); }
        else { if(action!=='reconcile' && result.code!=='session_changed'){setUnresolved(false);setBlocked(true);}
          if (action !== 'reconcile' || result.code === 'session_changed') setPrepared(null);
          if (result.code === 'session_changed') {  setUncertain(true); }
          setMessage(result.code === 'session_changed' ? 'Сессия изменилась или истекла. Текущая проверка закрыта; исход прежнего сохранения может быть неопределённым.'
            : result.code === 'conflict' ? 'Конфликт решения или изменённые факты. Обновите историю; выбор сохранён.'
            : result.code === 'expired' ? 'Срок проверки истёк. Контекст больше недоступен; обновите состояние без повторной записи.'
              : 'Действие недоступно. Успешное сохранение не подтверждено; выбор сохранён.'); }
      }
    } finally { active.current = false; if (live.current) {setBusy(false);onBusy?.(false);} }
  };
  const economicRole = assignment?.economicRole, layer = assignment?.layer;
  useEffect(() => {
    if (!live.current || !dirty || !valid || uncertain || blocked || decision.status === 'blocked') return;
    const epoch = ++preparationEpoch.current;
    const abort = new AbortController(); let retired = false;
    setPreparing(true); setPrepared(null);
    const request: ReviewRequest = { version: 'classification-c-v1', requestId: crypto.randomUUID(), expectedRevision: decision.decisionRevision, state,
      ...(economicRole ? { assignment: { economicRole, layer: layer ?? null } } : {}) };
    const transport = createManualClient({ baseUrl: apiBaseUrl, generation: scope.sessionGeneration, current: () => live.current && !retired, signal: abort.signal });
    void transport.prepare(operation.dataset, operation.operationId, request).then(result => {
      if (retired || !live.current || active.current || epoch !== preparationEpoch.current) return;
      setPreparing(false);
      if (result.ok) setPrepared(result.value);
      else { setMessage(result.code === 'conflict' ? 'Данные изменились. Обновите состояние; выбор сохранён.' : 'Подготовка недоступна. Выбор сохранён.'); if (result.code === 'conflict' || result.code === 'session_changed') setBlocked(true); }
    });
    return () => { retired = true; abort.abort(); };
  }, [dirty, valid, uncertain, blocked, decision.status, decision.decisionRevision, state, economicRole, layer, scope.sessionGeneration, operation.dataset, operation.operationId, attempt]);
  return <Stack spacing={1} component="section" aria-label="Сохранение ручной классификации">
    {prepared && !factsMatch && <Alert severity="warning">Факты изменились. Закройте операцию и обновите историю перед новым выбором. Сохранение заблокировано.</Alert>}
    {prepared && uncertain && <Button disabled={busy} onClick={() => void run('reconcile')}>Проверить результат без записи</Button>}
    {preparing && <Typography role="status">Подготовка выбранного решения…</Typography>}
    <Stack direction="row" spacing={1}>
      <Button disabled={!dirty || busy || uncertain} onClick={onCancel}>Отмена</Button>
      <Button disabled={!dirty || !valid || !prepared || !factsMatch || expiredPreparation === prepared || preparing || busy || uncertain || blocked || !live.current || Date.now() >= prepared.expiresAt} onClick={() => void run('apply')}>{decision.status === 'approved' ? 'Сохранить изменения' : 'Классифицировать'}</Button>
    </Stack>
    {dirty && valid && !preparing && (!prepared || expiredPreparation === prepared || Date.now() >= prepared.expiresAt) && !blocked && !uncertain && <Button onClick={() => setAttempt(n => n + 1)}>Повторить подготовку</Button>}
    <Divider />
    <Button variant="outlined" color="inherit" disabled={busy || uncertain || blocked || !live.current || decision.status === 'blocked' || decision.status === 'explicit_unclassified'} onClick={() => void run('unclassified')}>Оставить без классификации</Button>
    {unresolved && !prepared && <Alert severity="warning">Предыдущая запись могла сохраниться. Контекст подтверждения не восстановлен.</Alert>}
    {busy && <Typography role="status">Ожидание сервера…</Typography>}
    {(uncertain || blocked) && <Button disabled={busy} onClick={() => { setPrepared(null); setUnresolved(false); (onRefresh ?? onSaved)(); }}>Обновить состояние без повторной записи</Button>}
    {message && <Alert severity={uncertain ? 'warning' : 'info'}>{message}</Alert>}
    {!live.current && <Button onClick={onRefresh ?? onSaved}>Обновить состояние после возврата</Button>}
  </Stack>;
};
