import { useId } from 'react';
import { Button, Paper, Stack, TextField, Typography } from '@mui/material';
export type PreviewMonth = Readonly<{ year: string; month: string }>;
const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export const ClassificationMonthSelector = ({ value, pending = false, onChange, onSubmit }: {
  value: PreviewMonth; pending?: boolean; onChange: (value: PreviewMonth) => void; onSubmit: () => void;
}) => {
  const id = useId();
  return <Paper component="section" aria-label="Месяц демонстрации" variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
    <Stack component="form" spacing={1.5} noValidate onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField id={`${id}-month`} label="Месяц" select size="small" value={value.month} disabled={pending}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }} sx={{ minWidth: { sm: 160 } }}
          onChange={(event) => onChange({ ...value, month: event.target.value })}>
          {months.map((name, index) => <option key={name} value={String(index + 1)}>{name}</option>)}
        </TextField>
        <TextField id={`${id}-year`} label="Год" type="number" size="small" value={value.year} disabled={pending}
          slotProps={{ htmlInput: { min: 1, max: 9999, step: 1 } }} sx={{ width: { xs: '100%', sm: 120 } }}
          onChange={(event) => onChange({ ...value, year: event.target.value })} />
        <Button type="submit" variant="outlined" disabled={pending}>Показать месяц</Button>
      </Stack>
      <Typography variant="caption" color="text.secondary">Выбор месяца меняет только вымышленные примеры. Даты отображаются в UTC.</Typography>
    </Stack>
  </Paper>;
};
