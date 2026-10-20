import { useId, useState } from 'react';
import { Alert, Box, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import { formatKopecks } from '../../FinancialAnalytics/model/money';
import type { ReviewEntry } from '../model/reviewSession';
import type { CheckedOperationSnapshot, ClassificationAssignment } from '../model/types';
import { layerLabels, manualOptions, roleLabels } from './reviewPresentation';

export type ClassificationInteraction =
  | { type: 'approve'; operation: CheckedOperationSnapshot; assignment: ClassificationAssignment }
  | { type: 'leave_unclassified' | 'reset'; operation: CheckedOperationSnapshot };
type Props = { entry: ReviewEntry; number: number; pending?: boolean; onAction: (action: ClassificationInteraction) => void };

export const ClassificationOperationCard = ({ entry, number, pending = false, onAction }: Props) => {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [selection, setSelection] = useState('');
  const { operation, resolution } = entry;
  const amount = formatKopecks(operation.facts.kopecks);
  const date = new Date(operation.facts.timestamp);
  const validDate = Number.isFinite(date.getTime());
  const disabled = pending || !amount.ok || !validDate;
  const options = manualOptions(operation.dataset);
  const chosen = options.find((option) => option.key === selection);
  const approved = resolution.state === 'approved';
  const explicit = resolution.state === 'explicit_unclassified';
  const status = approved ? 'Подтверждено вручную' : explicit ? 'Оставлено без классификации' : 'Не проверено';
  const title = `${operation.dataset === 'expenses' ? 'Расход' : 'Поступление'} ${number}`;
  return (
    <Paper component="article" aria-labelledby={id} variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0, borderRadius: 2 }}>
      <Stack spacing={2} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ sm: 'center' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography id={id} component="h3" variant="subtitle1" fontWeight={600}>{title}</Typography>
            <Typography variant="caption" color="text.secondary">Вымышленный пример · {validDate
              ? <time dateTime={date.toISOString()}>{date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })} (UTC)</time>
              : 'Дата недоступна'}</Typography>
          </Box>
          {amount.ok ? <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0,
            color: operation.dataset === 'incomes' ? 'success.dark' : 'text.primary' }}>{amount.value}</Typography>
            : <Alert severity="error">Сумма недоступна: некорректное значение.</Alert>}
        </Stack>
        <Box>
          <Typography variant="caption" color="text.secondary">{operation.dataset === 'expenses' ? 'Исходная категория' : 'Источник поступления'}</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{operation.dataset === 'expenses'
            ? operation.facts.category.kind === 'label' ? operation.facts.category.value : 'Категория отсутствует'
            : operation.facts.sourceLabel}</Typography>
        </Box>
        <Chip label={status} size="small" variant={approved ? 'filled' : 'outlined'} color={approved ? 'success' : explicit ? 'info' : 'default'}
          sx={{ alignSelf: 'flex-start', maxWidth: '100%', height: 'auto', minHeight: 26, '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 } }} />
        {approved && <Box sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1 }}>
          <Typography variant="body2">Роль: {roleLabels[resolution.confirmed.economicRole]}</Typography>
          <Typography variant="body2" color="text.secondary">{resolution.confirmed.economicRole === 'ordinary_expense'
            ? `Предварительный слой: ${layerLabels[resolution.confirmed.layer]}` : 'Слой расходов не назначается'}</Typography>
          <Typography variant="caption" color="text.secondary">Временное ручное решение</Typography>
        </Box>}
        {editing ? <Stack component="form" aria-label={`Ручной выбор: ${title}`} spacing={1.5} onSubmit={(event) => {
          event.preventDefault();
          if (chosen && !disabled) { onAction({ type: 'approve', operation, assignment: chosen.assignment }); setEditing(false); setSelection(''); }
        }}>
          <TextField id={`${id}-choice`} select fullWidth size="small" label="Ручная классификация" value={selection} disabled={disabled}
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }} onChange={(event) => setSelection(event.target.value)}>
            <option value="">Выберите роль и назначение</option>
            {options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="contained" type="submit" disabled={disabled || !chosen}>Применить</Button>
            <Button type="button" disabled={pending} onClick={() => { setEditing(false); setSelection(''); }}>Отмена</Button>
          </Stack>
        </Stack> : <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
          <Button variant="outlined" disabled={disabled} onClick={() => setEditing(true)}>Выбрать классификацию</Button>
          <Button disabled={disabled} onClick={() => onAction({ type: 'leave_unclassified', operation })}>Оставить без классификации</Button>
          <Button disabled={disabled || entry.decision === null} onClick={() => onAction({ type: 'reset', operation })}>Сбросить решение</Button>
        </Stack>}
      </Stack>
    </Paper>
  );
};
