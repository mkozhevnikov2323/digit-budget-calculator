import { useId, useReducer, useState, useTransition } from 'react';
import { Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { monthPeriod, type CalendarPeriod } from 'features/FinancialAnalytics/model/period';
import { transitionReviewSession, type ReviewAction, type ReviewContext, type ReviewSession } from 'features/FinancialClassification/model/reviewSession';
import { ClassificationMonthSelector, type PreviewMonth } from 'features/FinancialClassification/ui/ClassificationMonthSelector';
import { ClassificationReviewView, type ReviewPresentationState } from 'features/FinancialClassification/ui/ClassificationReviewView';
import { createSyntheticMonthReview } from '../model/syntheticMonthReview';

type Draft = { model: ReviewSession; message: string; failed: boolean };
const scenarios: readonly [ReviewPresentationState, string][] = [
  ['ready', 'Операции'], ['loading', 'Загрузка'], ['fetching', 'Обновление'], ['empty', 'Пустой месяц'],
  ['invalid_period', 'Некорректный период'], ['verification_required', 'Требуется проверка владельца'], ['error', 'Ошибка данных'],
];

const SyntheticPreview = ({ selection, period, status, changeMonth }: {
  selection: PreviewMonth; period: CalendarPeriod | null; status: ReviewPresentationState; changeMonth: (value: PreviewMonth) => void;
}) => {
  const initialize = (): Draft => {
    if (!period) return { model: { status: 'inactive' }, message: '', failed: false };
    const initial = createSyntheticMonthReview(period);
    return { model: initial.state, message: initial.ok ? '' : 'Не удалось подготовить вымышленные примеры.', failed: !initial.ok };
  };
  const [draft, dispatch] = useReducer((previous: Draft, action: ReviewAction | { type: 'restart'; context: ReviewContext }): Draft => {
    const result = transitionReviewSession(previous.model, action.type === 'restart' ? { type: 'discard', context: action.context } : action);
    if (!result.ok) return { ...previous, failed: true,
      message: 'Решение не применено: контекст изменился или выбор недопустим. Повторите проверку текущей операции.' };
    if (action.type === 'restart') return { ...initialize(), message: 'Все временные решения сброшены.' };
    return { model: result.state, failed: false, message: action.type === 'reset'
      ? 'Временное решение сброшено.' : 'Решение применено временно. На сервер ничего не отправлено.' };
  }, undefined, initialize);
  const [pending, startTransition] = useTransition();
  const [requested, setRequested] = useState<PreviewMonth | null>(null);
  const [monthDraft, setMonthDraft] = useState(selection);
  const cancelMonth = () => { setRequested(null); setMonthDraft(selection); };
  const dialogId = useId();
  const model = draft.model;
  const entries = model.status === 'active' ? model.entries : [];
  const hasDecisions = entries.some((entry) => entry.decision !== null);
  return <Stack spacing={2} sx={{ minWidth: 0 }}>
    <ClassificationMonthSelector value={monthDraft} pending={pending} onChange={setMonthDraft} onSubmit={() => {
      const next = monthDraft;
      if (next.year === selection.year && next.month === selection.month) return;
      if (hasDecisions) setRequested(next); else changeMonth(next);
    }} />
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ sm: 'center' }}>
      <Typography variant="body2" fontWeight={500} aria-live="polite">{period
        ? `${period.firstDate} — ${period.lastDate} · UTC` : 'Период не выбран'}</Typography>
      {status === 'ready' && <Button disabled={pending || !hasDecisions || model.status !== 'active'} onClick={() => {
        if (model.status === 'active') startTransition(() => dispatch({ type: 'restart', context: model.context }));
      }}>Сбросить все решения</Button>}
    </Stack>
    {draft.message && <Alert severity={draft.failed ? 'error' : 'success'} role={draft.failed ? 'alert' : 'status'} aria-live="polite">{draft.message}</Alert>}
    <ClassificationReviewView status={!period ? 'invalid_period' : draft.failed && model.status !== 'active' ? 'error' : status}
      entries={entries} pending={pending} onAction={(action) => {
        if (model.status === 'active') startTransition(() => dispatch({ ...action, context: model.context, taxonomyVersion: model.context.taxonomyVersion }));
      }} />
    <Dialog open={requested !== null} onClose={cancelMonth} aria-labelledby={dialogId} aria-describedby={`${dialogId}-description`} fullWidth maxWidth="xs">
      <DialogTitle id={dialogId}>Сменить месяц?</DialogTitle>
      <DialogContent><DialogContentText id={`${dialogId}-description`}>Временные решения текущего месяца будут удалены. В новом месяце появятся только вымышленные примеры без классификации.</DialogContentText></DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, p: 2 }}>
        <Button onClick={cancelMonth}>Остаться в текущем месяце</Button>
        <Button variant="contained" onClick={() => { if (requested) changeMonth(requested); }}>Сменить и сбросить</Button>
      </DialogActions>
    </Dialog>
  </Stack>;
};

const ClassificationPreviewPage = () => {
  const [selection, setSelection] = useState<PreviewMonth>({ year: '2028', month: '2' });
  const [scenario, setScenario] = useState<ReviewPresentationState>('ready');
  const period = monthPeriod(Number(selection.year), Number(selection.month));
  const stateId = useId();
  return <Container maxWidth="md" sx={{ py: { xs: 2, sm: 3 }, minWidth: 0 }}>
    <Stack spacing={2.5} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <Box>
        <Chip label="Демо · вымышленные данные" color="info" variant="outlined" size="small" sx={{ mb: 1.5 }} />
        <Typography component="h1" variant="h4" sx={{ fontSize: { xs: '1.65rem', sm: '2rem' }, fontWeight: 600 }}>Классификация операций</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75 }}>Экспериментальный просмотр финансовых операций</Typography>
      </Box>
      <Alert severity="info" role="note">
        Все записи вымышлены. Решения временные: ничего не сохраняется на сервере, доходы и расходы не изменяются.
        Деньги не резервируются, не переводятся и не распределяются. Пять финансовых слоёв предварительные.
        Обновление страницы, смена месяца или уход со страницы удаляют решения.
      </Alert>
      <SyntheticPreview key={JSON.stringify([selection.year, selection.month, scenario])} selection={selection}
        period={period.ok ? period.value : null} status={scenario} changeMonth={setSelection} />
      <Box component="details" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
        <Box component="summary" sx={{ cursor: 'pointer', py: 1 }}>Примеры состояний интерфейса</Box>
        <Typography variant="body2" sx={{ mb: 1.5 }}>Учебные состояния без сетевых запросов. Переключение удаляет временные решения.</Typography>
        <TextField id={stateId} label="Состояние демонстрации" select fullWidth size="small" value={scenario}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }} onChange={(event) => {
            const next = scenarios.find(([value]) => value === event.target.value); if (next) setScenario(next[0]);
          }}>
          {scenarios.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </TextField>
      </Box>
    </Stack>
  </Container>;
};
export default ClassificationPreviewPage;
