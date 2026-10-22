import { Alert, Checkbox, FormControlLabel, Stack, Typography } from '@mui/material';
import { monthKeys } from 'features/FinancialAnalytics/model/period';
import type { CoherentHistory } from 'features/HistoricalClassification/model/coherentHistory';
import { eligibleRecordingMonths } from '../model/recordingEvidence';

export const RecordingEvidenceControls = ({ cohort, confirmed, onChange, asOf }: {
  cohort: CoherentHistory; confirmed: readonly string[]; onChange: (months: string[]) => void; asOf: number;
}) => {
  const keys = monthKeys(cohort.history.period), eligible = eligibleRecordingMonths(cohort, asOf);
  return <Stack spacing={1} component="section" aria-label="Подтверждение полноты записи месяцев">
    <Alert severity="info" role="note">Подтвердите, что вы проверили полноту записи реальных расходов каждого месяца, включая месяцы без записей. Это ваше временное подтверждение в памяти, не серверное или криптографическое доказательство. Обновление истории, смена периода/сессии и закрытие удаляют его.</Alert>
    {keys.ok && keys.value.map(key => <FormControlLabel key={key} control={<Checkbox checked={confirmed.includes(key)} disabled={!eligible.includes(key)}
      onChange={e => onChange(e.target.checked ? [...confirmed, key] : confirmed.filter(m => m !== key))} />}
      label={`Подтверждаю полноту записи ${key}${eligible.includes(key) ? '' : ' — месяц не завершён или выбран не полностью'}`} />)}
    <Typography>Без подтверждения: {keys.ok ? keys.value.filter(key => !confirmed.includes(key)).join(', ') || 'нет' : 'период недоступен'}.</Typography>
  </Stack>;
};
