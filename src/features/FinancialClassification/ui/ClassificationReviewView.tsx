import { Alert, CircularProgress, Stack, Typography } from '@mui/material';
import type { ReviewEntry } from '../model/reviewSession';
import { ClassificationOperationCard, type ClassificationInteraction } from './ClassificationOperationCard';
import { ClassificationReviewSummary } from './ClassificationReviewSummary';

export type ReviewPresentationState = 'ready' | 'loading' | 'fetching' | 'empty' | 'invalid_period' | 'verification_required' | 'error';
type Props = { status: ReviewPresentationState; entries: readonly ReviewEntry[];
  pending?: boolean; onAction: (action: ClassificationInteraction) => void };

/** Pure presentation: no transport, owner verification, storage or decisions. */
export const ClassificationReviewView = ({ status, entries, pending = false, onAction }: Props) => {
  if (status === 'loading' || status === 'fetching') return <Stack role="status" aria-live="polite" direction="row" spacing={2} alignItems="center" sx={{ py: 3 }}>
    <CircularProgress size={24} aria-label="Ожидание операций" /><Typography>{status === 'loading' ? 'Загрузка операций…' : 'Обновление операций…'}</Typography>
  </Stack>;
  if (status === 'invalid_period') return <Alert severity="warning">Укажите корректные месяц и год от 1 до 9999. Операции не показаны.</Alert>;
  if (status === 'verification_required') return <Alert severity="info">Для реальных операций потребуется проверка владельца. Это пример состояния интерфейса, проверка сессии здесь не выполняется.</Alert>;
  if (status === 'error') return <Alert severity="error">Не удалось подготовить операции. Проверьте данные периода и повторите просмотр. Прежние операции скрыты.</Alert>;
  if (status === 'empty' || !entries.length) return <Alert severity="info">В этом периоде нет операций для классификации. Выберите другой месяц.</Alert>;
  return <Stack spacing={2} sx={{ minWidth: 0 }} aria-busy={pending}>
    <ClassificationReviewSummary entries={entries} />
    <Typography component="h2" variant="h6">Операции периода</Typography>
    {pending && <Typography role="status">Применение временного решения…</Typography>}
    {entries.map((entry, index) => <ClassificationOperationCard key={JSON.stringify([entry.operation.dataset, entry.operation.transactionId])}
      entry={entry} number={index + 1} pending={pending} onAction={onAction} />)}
  </Stack>;
};
