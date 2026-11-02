import { useMemo } from 'react';
import { Alert, Container, Stack, Typography } from '@mui/material';
import { useAnalyticsState } from 'features/AnalyticsState/model/useAnalyticsState';
import { currentSelection, selectedPeriod } from './selection';
import { PeriodSelector } from './PeriodSelector';
import { HistoricalClassification } from 'features/HistoricalClassification/ui/HistoricalClassification';
import { RealClassificationStatistics } from 'features/ClassificationStatistics/ui/RealClassificationStatistics';

export const AnalyticsFeaturePage = ({
  mode,
}: {
  mode: 'history' | 'classification' | 'classification-stats' | 'planning';
}) => {
  const [selection, setSelection] = useAnalyticsState(
    'selection',
    currentSelection,
  );
  const period = useMemo(() => selectedPeriod(selection), [selection]);
  const title = {
    history: 'История операций',
    classification: 'Классификация',
    'classification-stats': 'Статистика классификации',
    planning: 'Планирование бюджета',
  }[mode];
  return (
    <Container
      maxWidth="lg"
      sx={{ py: 2, minWidth: 0 }}
    >
      <Stack spacing={2}>
        <Typography
          variant="h4"
          component="h1"
        >
          {title}
        </Typography>
        <PeriodSelector
          value={selection}
          onChange={setSelection}
          period={period.ok ? period.value : null}
        />
        <Typography>
          Учитываются записанные расходы и поступления выбранного периода.
          Полнота записи и полнота классификации проверяются отдельно. Границы
          периода — UTC.
        </Typography>
        {mode === 'planning' ? (
          <RealClassificationStatistics
            period={period.ok ? period.value : null}
            mode="planning"
          />
        ) : period.ok ? (
          mode === 'history' || mode === 'classification' ? (
            <HistoricalClassification
              key={`${mode}/${period.value.startInclusive}/${period.value.endExclusive}`}
              period={period.value}
              readOnly={mode === 'history'}
            />
          ) : (
            <RealClassificationStatistics
              period={period.value}
              mode="statistics"
            />
          )
        ) : (
          <Alert severity="error">
            Укажите корректный период. Данные не загружены и итоги не
            рассчитаны.
          </Alert>
        )}
      </Stack>
    </Container>
  );
};
