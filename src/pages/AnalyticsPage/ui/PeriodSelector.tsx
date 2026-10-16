import { Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { currentPeriod, getCalendarRange, shiftPeriod, type PeriodKind, type PeriodSelection } from '../model/period';

type Props = { value: PeriodSelection; onChange: (value: PeriodSelection) => void };
const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export const PeriodSelector = ({ value, onChange }: Props) => {
  let description = '';
  try {
    const range = getCalendarRange(value);
    description = `${range.start} — ${range.end} (UTC)`;
  } catch { /* Validation message is rendered by the page. */ }
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <Button onClick={() => onChange(currentPeriod())}>Текущий месяц</Button>
        <Button onClick={() => onChange(shiftPeriod(currentPeriod(), -1))}>Предыдущий месяц</Button>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        <TextField select label="Период" size="small" value={value.kind} SelectProps={{ native: true }}
          onChange={(event) => onChange({ ...value, kind: event.target.value as PeriodKind })}>
          <option value="month">Месяц</option><option value="quarter">Квартал</option>
          <option value="year">Год</option><option value="custom">Произвольный период</option>
        </TextField>
        {value.kind === 'custom' ? <>
          <TextField label="Начальная дата" type="date" size="small" value={value.start} InputLabelProps={{ shrink: true }}
            onChange={(event) => onChange({ ...value, start: event.target.value })} />
          <TextField label="Конечная дата" type="date" size="small" value={value.end} InputLabelProps={{ shrink: true }}
            onChange={(event) => onChange({ ...value, end: event.target.value })} />
        </> : <>
          <TextField label="Год" type="number" size="small" value={value.year} inputProps={{ min: 2020, max: 9998 }} sx={{ width: { sm: 110 } }}
            onChange={(event) => onChange({ ...value, year: Number(event.target.value) })} />
          {value.kind === 'month' && <TextField select label="Месяц" size="small" value={value.month} SelectProps={{ native: true }}
            onChange={(event) => onChange({ ...value, month: Number(event.target.value) })}>
            {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
          </TextField>}
          {value.kind === 'quarter' && <TextField select label="Квартал" size="small" value={Math.floor((value.month - 1) / 3) + 1} SelectProps={{ native: true }}
            onChange={(event) => onChange({ ...value, month: (Number(event.target.value) - 1) * 3 + 1 })}>
            <option value={1}>I: январь — март</option><option value={2}>II: апрель — июнь</option>
            <option value={3}>III: июль — сентябрь</option><option value={4}>IV: октябрь — декабрь</option>
          </TextField>}
          <Button aria-label="Предыдущий календарный период" onClick={() => onChange(shiftPeriod(value, -1))}>←</Button>
          <Button aria-label="Следующий календарный период" onClick={() => onChange(shiftPeriod(value, 1))}>→</Button>
        </>}
      </Stack>
      <Typography variant="body2" sx={{ mt: 1 }}>{description}</Typography>
    </Paper>
  );
};
