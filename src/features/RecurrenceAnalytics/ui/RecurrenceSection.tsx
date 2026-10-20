import { useEffect, useId, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { useRecurrenceAnalytics } from '../model/useRecurrenceAnalytics';
import { previousCompletedMonths, type RecurrenceLookback } from '../model/window';
import { groupKey } from '../model/validation';
import type { RecurrenceObservation } from '../model/types';

const ObservationGroup = ({ title, explanation, observations }: {
  title: string; explanation: string; observations: readonly RecurrenceObservation[];
}) => {
  const id = useId();
  const [visible, setVisible] = useState(20);
  return <Box component="section" aria-labelledby={id} sx={{ minWidth: 0 }}>
    <Typography id={id} component="h3" variant="h6">{title}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{explanation}</Typography>
    {observations.length === 0 ? <Typography>Группы наблюдений не найдены.</Typography> : <>
      <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 1,
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        {observations.slice(0, visible).map(observation => {
          const group = observation.group;
          return <Paper component="li" variant="outlined" key={groupKey(group)} sx={{ p: 2, minWidth: 0, overflowWrap: 'anywhere' }}>
            <Typography component="h4" variant="subtitle1">
              {group.level === 'similar_expense' ? `${group.title} — ${group.recipient}` : group.identity.value}
            </Typography>
            {group.level === 'similar_expense' && <Typography variant="body2">Категория: {group.identity.value}</Typography>}
            <Box component="dl" sx={{ my: 1, '& dt': { color: 'text.secondary' }, '& dd': { ml: 0, mb: 1 } }}>
              <dt>Записанных операций</dt><dd>{observation.operationCount}</dd>
              <dt>Активных месяцев</dt><dd>{observation.activeMonthCount}</dd>
              <dt>Самая длинная серия, мес.</dt><dd>{observation.longestConsecutiveMonths}</dd>
            </Box>
            <details><summary tabIndex={0}>Месяцы и интервалы</summary>
              <Typography variant="body2">Активные месяцы (UTC): {observation.activeMonths.join(', ')}</Typography>
              {observation.intervalsInMonths.length > 0 && <Typography variant="body2">
                Между активными месяцами: {observation.intervalsInMonths.join(', ')} мес.
              </Typography>}
            </details>
          </Paper>;
        })}
      </Box>
      {visible < observations.length && <Button sx={{ mt: 1 }} onClick={() => setVisible(value => value + 20)}>
        Показать ещё группы: {title} ({Math.min(visible, observations.length)} из {observations.length})
      </Button>}
    </>}
  </Box>;
};

export const RecurrenceSection = () => {
  const id = useId();
  const [months, setMonths] = useState<RecurrenceLookback>(3);
  const [now, setNow] = useState(() => new Date());
  // Advance at the UTC month boundary even on a long-lived open page. Cap the
  // timer to one day (browsers cannot represent arbitrary month-long delays).
  useEffect(() => {
    const next = new Date(now);
    next.setUTCFullYear(now.getUTCFullYear(), now.getUTCMonth() + 1, 1); next.setUTCHours(0, 0, 0, 0);
    const timer = setTimeout(() => setNow(new Date()), Math.max(1, Math.min(next.getTime() - now.getTime(), 86400000)));
    return () => clearTimeout(timer);
  }, [now]);
  const window = previousCompletedMonths(months, now);
  const state = useRecurrenceAnalytics(window);
  const errors = {
    request: 'Не удалось загрузить наблюдения. Попробуйте ещё раз.',
    invalid_response: 'Ответ сервера не соответствует формату наблюдений. Данные не показаны.',
    oversized: months === 3
      ? 'История превышает лимит 1000 операций в одном из наборов даже за 3 завершённых месяца. Наблюдения пока недоступны; основной отчёт работает независимо.'
      : 'История за этот период превышает лимит 1000 операций в одном из наборов. Выберите более короткий период.',
    unauthorized: 'Нет доступа к наблюдениям. Войдите снова.',
  };
  return <Paper component="section" aria-labelledby={id} variant="outlined" sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Typography id={id} component="h2" variant="h5">Повторяемость операций</Typography>
      <Typography variant="body2" color="text.secondary">
        Это исторические наблюдения по записанным операциям, а не подтверждение регулярных платежей или финансовая классификация.
        Результат не доказывает непрерывность ведения учёта. Расходы и поступления могли быть прочитаны в разное время.
      </Typography>
      <TextField select label="Период повторяемости (UTC)" size="small" value={months} SelectProps={{ native: true }}
        sx={{ width: { xs: '100%', sm: 340 } }} onChange={event => {
          const value = Number(event.target.value);
          if (value === 3 || value === 6 || value === 12) { setMonths(value); setNow(new Date()); }
        }}>
        <option value={3}>Предыдущие 3 завершённых месяца</option>
        <option value={6}>Предыдущие 6 завершённых месяцев</option>
        <option value={12}>Предыдущие 12 завершённых месяцев</option>
      </TextField>
      {window && <Typography variant="body2">С {window.startMonth} до начала {window.endMonthExclusive} (UTC)</Typography>}
      <Typography variant="body2" color="text.secondary">Серия — последовательные месяцы с записями этой группы.</Typography>
      {state.status === 'blocked' ? <Typography>{state.reason === 'unauthenticated' ? 'Войдите, чтобы просмотреть наблюдения.'
        : state.reason === 'verifying' ? 'Проверка пользователя перед загрузкой наблюдений…'
          : state.reason === 'invalid_period' ? 'Не удалось определить завершённые месяцы.' : 'Не удалось подтвердить пользователя для наблюдений.'}</Typography>
        : state.status === 'loading' || state.status === 'refreshing' ? <Stack direction="row" spacing={1} alignItems="center" role="status" aria-live="polite">
          <CircularProgress size={24} aria-label="Загрузка наблюдений повторяемости" />
          <Typography>{state.status === 'refreshing' ? 'Обновление наблюдений…' : 'Загрузка наблюдений…'}</Typography>
        </Stack>
          : state.status === 'error' ? <Alert severity={state.reason === 'oversized' ? 'warning' : 'error'}
            action={<Button color="inherit" onClick={state.retry}>Повторить загрузку наблюдений</Button>}>{errors[state.reason]}</Alert>
            : <>
              {state.data.observations.length === 0 && <Typography>
                За выбранный период группы наблюдений не найдены. Это не доказывает отсутствие операций или перерыв в учёте.
              </Typography>}
              <ObservationGroup title="Категории расходов" explanation="Категория объединяет разные операции. Её активность не означает повторение одного платежа."
                observations={state.data.observations.filter(x => x.group.dataset === 'expenses' && x.group.level === 'category_or_source')} />
              <ObservationGroup title="Похожие расходные операции" explanation="Совпадают тексты категории, названия и получателя. Суммы и назначение платежей здесь не сравниваются."
                observations={state.data.observations.filter(x => x.group.level === 'similar_expense')} />
              <ObservationGroup title="Источники поступлений" explanation="Группы по точному названию источника. Эти записи не гарантируют будущих поступлений."
                observations={state.data.observations.filter(x => x.group.dataset === 'incomes')} />
            </>}
    </Stack>
  </Paper>;
};
