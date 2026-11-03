import { useState } from 'react';
import { Stack, TextField } from '@mui/material';
import { FINANCIAL_LAYERS, type FinancialLayer } from 'features/FinancialClassification/model/types';
import { layerLabel, roleLabel } from 'shared/lib/analytics/presentation';
import { ROLE_DATASETS, type ClassificationRead, type DecisionState, type StableRole } from '../model/contract';
import type { HistoryOperation } from '../model/history';
import type { DecisionQuery } from '../api/historyApi';
import { PersistentReview } from './PersistentReview';

type Choice = { state: DecisionState | ''; role: StableRole | ''; layer: FinancialLayer | '' };
export const OperationEditor = ({ operation, decision, scope, onSaved, onRefresh }: {
  operation: HistoryOperation; decision: ClassificationRead;
  scope: Omit<DecisionQuery, 'dataset' | 'operationId'>; onSaved: () => void; onRefresh?: () => void;
}) => {
  const initial: Choice = { state: decision.storedState ?? '', role: decision.confirmed?.economicRole ?? '', layer: decision.confirmed?.layer ?? '' };
  const [choice, setChoice] = useState(initial), [busy, setBusy] = useState(false);
  const normalize = (c: Choice) => [c.state, c.state === 'approved' ? c.role : '', c.state === 'approved' && c.role === 'ordinary_expense' ? c.layer : ''];
  const dirty = JSON.stringify(normalize(choice)) !== JSON.stringify(normalize(initial));
  const valid = !!choice.state && (choice.state !== 'approved' || !!choice.role && (choice.role !== 'ordinary_expense' || !!choice.layer));
  return <Stack spacing={1} aria-label="Редактор классификации">
    <TextField select label="Решение" value={choice.state} disabled={busy} slotProps={{ select: { native: true } }} onChange={e => setChoice({ ...choice, state: e.target.value as Choice['state'] })}>
      <option value="">Не выбрано</option><option value="approved">Классифицировать</option><option value="explicit_unclassified">Явно без классификации</option><option value="cleared">Сбросить решение</option>
    </TextField>
    {choice.state === 'approved' && <>
      <TextField select label="Экономическая роль" value={choice.role} disabled={busy} slotProps={{ select: { native: true } }} onChange={e => setChoice({ ...choice, role: e.target.value as Choice['role'], layer: '' })}>
        <option value="">Не выбрано</option>{(Object.keys(ROLE_DATASETS) as StableRole[]).filter(r => (ROLE_DATASETS[r] as readonly string[]).includes(operation.dataset)).map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
      </TextField>
      {choice.role === 'ordinary_expense' && <TextField select label="Финансовый слой" value={choice.layer} disabled={busy} slotProps={{ select: { native: true } }} onChange={e => setChoice({ ...choice, layer: e.target.value as Choice['layer'] })}>
        <option value="">Не выбрано</option>{FINANCIAL_LAYERS.map(l => <option key={l} value={l}>{layerLabel(l)}</option>)}
      </TextField>}
    </>}
    <PersistentReview key={JSON.stringify(normalize(choice))} operation={operation} decision={decision} scope={scope}
      state={choice.state || 'approved'} dirty={dirty} valid={valid} onBusy={setBusy} onCancel={() => setChoice(initial)}
      assignment={choice.state === 'approved' && choice.role ? { economicRole: choice.role, layer: choice.role === 'ordinary_expense' && choice.layer ? choice.layer : null } : undefined} onSaved={onSaved} onRefresh={onRefresh} />
  </Stack>;
};
