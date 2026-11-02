import { Typography } from '@mui/material';
import { factLabel, timeLabel } from 'shared/lib/analytics/presentation';
/** Exact source strings, display labels only. No rounding or financial coercion. */
export const SourceFactsView = ({
  facts,
}: {
  facts: Record<string, unknown>;
}) => {
  const text = Object.entries(facts)
    .filter(([key]) => key !== 'date')
    .map(([key, value]) => {
      if (key === 'dateEpochMs' && typeof value === 'number')
        return `Дата и время: ${timeLabel(value)}`;
      if (
        key === 'amount' &&
        value &&
        typeof value === 'object' &&
        'value' in value
      )
        return `Сумма: ${String(value.value)}`;
      if (
        key === 'comment' &&
        value &&
        typeof value === 'object' &&
        'kind' in value
      ) {
        return `Комментарий: ${value.kind === 'missing' ? 'отсутствует' : value.kind === 'null' ? 'не задан' : 'value' in value ? String(value.value) : 'недоступен'}`;
      }
      return `${factLabel(key)}: ${value === null ? 'не задан' : value === '' ? '(пустая строка)' : String(value)}`;
    })
    .join('\n');
  return (
    <Typography
      component="pre"
      sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
    >
      {text}
    </Typography>
  );
};
