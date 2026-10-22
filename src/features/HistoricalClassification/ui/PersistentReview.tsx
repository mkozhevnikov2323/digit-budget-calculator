import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Alert, Button, Checkbox, FormControlLabel, Stack, Typography } from '@mui/material';
import { baseApi, apiBaseUrl } from 'shared/api/baseApi';
import { createManualClient, type PreparedReview, type ReviewRequest } from '../api/manualClient';
import type { DecisionQuery } from '../api/historyApi';
import type { ClassificationRead, DecisionState, StableAssignment } from '../model/contract';
import type { HistoryOperation } from '../model/history';

/** Keyed by operation/draft/session/period. Proofs stay only in component memory. */
export const PersistentReview = ({ operation, scope, decision, state, assignment, onSaved }: {
  operation: HistoryOperation; scope: Omit<DecisionQuery, 'dataset' | 'operationId'>; decision: ClassificationRead;
  state: DecisionState; assignment?: StableAssignment; onSaved: () => void;
}) => {
  const dispatch = useDispatch();
  const [prepared, setPrepared] = useState<PreparedReview | null>(null), [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [message, setMessage] = useState('');
  const live = useRef(true), active = useRef(false), controller = useRef(new AbortController());
  const [context] = useState(() => crypto.randomUUID());
  useEffect(() => {
    live.current = true;
    // StrictMode remount must not reuse an aborted controller.
    controller.current = new AbortController();
    const reset = (event: PageTransitionEvent) => {
      if (event.type === 'pageshow' && !event.persisted) return;
      live.current = false; controller.current.abort(); setPrepared(null); setChecked(false); setUncertain(false);
      setMessage('После возврата на страницу обновите состояние. Исход отправленного сохранения мог остаться неопределённым.');
    };
    window.addEventListener('pagehide', reset); window.addEventListener('pageshow', reset);
    return () => { live.current = false; controller.current.abort(); window.removeEventListener('pagehide', reset); window.removeEventListener('pageshow', reset); };
  }, []);
  const client = () => createManualClient({ baseUrl: apiBaseUrl, generation: scope.sessionGeneration,
    current: () => live.current, signal: controller.current.signal });
  const success = () => {
    setPrepared(null); setChecked(false); setUncertain(false);
    setMessage('Сервер подтвердил сохранение. Актуальность классификации проверяется заново.');
    dispatch(baseApi.util.invalidateTags(['Expense', 'Income'])); onSaved();
  };
  const run = async (action: 'prepare' | 'apply' | 'reconcile') => {
    if (active.current || !live.current) return;
    active.current = true; setBusy(true); setMessage('');
    try {
      if (action === 'prepare') {
        const request: ReviewRequest = { version: 'classification-review-request-v1', browserReviewContext: context,
          requestId: crypto.randomUUID(), expectedRevision: decision.decisionRevision, state, ...(assignment ? { assignment } : {}) };
        const result = await client().prepare(operation.dataset, operation.operationId, request);
        if (!live.current) return;
        if (result.ok) { setPrepared(result.value); setChecked(false); }
        else setMessage(result.code === 'conflict' ? 'Ревизия изменилась. Обновите историю и повторите ручную проверку.' : 'Подготовка проверки недоступна. Введённый выбор сохранён в памяти.');
      } else if (prepared) {
        if (action === 'apply' && (!checked || uncertain || Date.now() >= prepared.expiresAt * 1000)) {
          setMessage('Нужно заново подготовить и проверить факты.'); return;
        }
        const result = await client()[action](operation.dataset, operation.operationId, prepared);
        if (!live.current) return;
        if (result.ok && result.value === 'applied') success();
        else if (result.ok) { setUncertain(true); setMessage('Результат остаётся неопределённым. Новая запись автоматически не отправляется.'); }
        else if (result.code === 'unknown_outcome') { setUncertain(true); setMessage('Ответ о сохранении не получен. Запись могла сохраниться. Доступна только проверка результата.'); }
        else { if (action === 'apply') setPrepared(null);
          setMessage(result.code === 'conflict' ? 'Конфликт решения или изменённые факты. Обновите историю; выбор сохранён.'
            : result.code === 'expired' ? 'Срок проверки истёк. Истёкший proof не используется для новой записи.'
              : 'Действие недоступно. Успешное сохранение не подтверждено; выбор сохранён.'); }
      }
    } finally { active.current = false; if (live.current) setBusy(false); }
  };
  return <Stack spacing={1} component="section" aria-label="Сохранение ручной классификации">
    <Typography>Текущее серверное решение: {decision.status}; {decision.confirmed?.economicRole ?? 'без подтверждённой роли'} / {decision.confirmed?.layer ?? 'без слоя'}. Новое решение: {state} / {assignment?.economicRole ?? 'без роли'} / {assignment?.layer ?? 'без слоя'}.</Typography>
    <Button disabled={busy || uncertain || decision.status === 'blocked'} onClick={() => void run('prepare')}>Подготовить серверную проверку</Button>
    {prepared && <>
      <Typography component="h4">Факты, проверенные сервером для этого решения</Typography>
      <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(prepared.facts, null, 2)}
        {'\nUTC: '}{new Date(Number(prepared.facts.dateEpochMs)).toISOString()}</Typography>
      <Typography>Срок допуска: {new Date(prepared.expiresAt * 1000).toISOString()}. Наблюдение неатомарное; изменения после чтения возможны.</Typography>
      <FormControlLabel control={<Checkbox checked={checked} disabled={busy || uncertain} onChange={e => setChecked(e.target.checked)} />}
        label="Я проверил(а) именно серверные факты и явно подтверждаю новое решение" />
      <Button disabled={busy || uncertain || !checked || Date.now() >= prepared.expiresAt * 1000} onClick={() => void run('apply')}>Сохранить классификацию на сервере</Button>
      {uncertain && <Button disabled={busy} onClick={() => void run('reconcile')}>Проверить результат без записи</Button>}
    </>}
    {busy && <Typography role="status">Ожидание сервера…</Typography>}
    {message && <Alert severity={uncertain ? 'warning' : 'info'}>{message}</Alert>}
    {!live.current && <Button onClick={onSaved}>Обновить состояние после возврата</Button>}
  </Stack>;
};
