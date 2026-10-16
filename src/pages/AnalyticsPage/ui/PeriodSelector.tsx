import { Button, Paper, Stack, TextField, Typography } from '@mui/material';
import type { CalendarPeriod } from 'features/FinancialAnalytics/model/period';
import { currentSelection, previousSelection, shiftSelection, type PeriodSelection } from './selection';

type Props = { value: PeriodSelection; onChange: (value: PeriodSelection) => void; period: CalendarPeriod | null };
const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export const PeriodSelector = ({ value, onChange, period }: Props) => {
  const previous = shiftSelection(value, -1);
  const next = shiftSelection(value, 1);
  const previousMonth = previousSelection();
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
        <Button onClick={() => onChange(currentSelection())}>Текущий месяц</Button>
        <Button disabled={!previousMonth} onClick={() => previousMonth && onChange(previousMonth)}>Предыдущий месяц</Button>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        <TextField select label="Период" size="small" value={value.kind} SelectProps={{ native: true }}
          onChange={(event) => {
            const kind = event.target.value;
            if (kind === 'month' || kind === 'quarter' || kind === 'year' || kind === 'custom') {
              onChange({ ...value, kind, start: period?.firstDate ?? value.start, end: period?.lastDate ?? value.end });
            }
          }}>
          <option value="month">Месяц</option><option value="quarter">Квартал</option>
          <option value="year">Год</option><option value="custom">Произвольный период</option>
        </TextField>
        {value.kind === 'custom' ? <>
          <TextField label="Начальная дата" type="date" size="small" value={value.start} InputLabelProps={{ shrink: true }}
            onChange={(event) => onChange({ ...value, start: event.target.value })} />
          <TextField label="Конечная дата" type="date" size="small" value={value.end} InputLabelProps={{ shrink: true }}
            onChange={(event) => onChange({ ...value, end: event.target.value })} />
        </> : <>
          <TextField label="Год" type="number" size="small" value={value.year} inputProps={{ min: 1, max: 9999, step: 1 }} sx={{ width: { sm: 110 } }}
            onChange={(event) => onChange({ ...value, year: event.target.value })} />
          {value.kind === 'month' && <TextField select label="Месяц" size="small" value={value.month} SelectProps={{ native: true }}
            onChange={(event) => onChange({ ...value, month: Number(event.target.value) })}>
            {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
          </TextField>}
          {value.kind === 'quarter' && <TextField select label="Квартал" size="small" value={Math.floor((value.month - 1) / 3) + 1} SelectProps={{ native: true }}
            onChange={(event) => onChange({ ...value, month: (Number(event.target.value) - 1) * 3 + 1 })}>
            <option value={1}>I: январь — март</option><option value={2}>II: апрель — июнь</option>
            <option value={3}>III: июль — сентябрь</option><option value={4}>IV: октябрь — декабрь</option>
          </TextField>}
          <Button aria-label="Предыдущий календарный период" disabled={!previous} onClick={() => previous && onChange(previous)}>←</Button>
          <Button aria-label="Следующий календарный период" disabled={!next} onClick={() => next && onChange(next)}>→</Button>
        </>}
      </Stack>
      <Typography variant="body2" sx={{ mt: 1 }} aria-live="polite">
        {period ? `${period.firstDate} — ${period.lastDate} (включительно, UTC)` : 'Период не выбран: исправьте даты.'}
      </Typography>
    </Paper>
  );
};
