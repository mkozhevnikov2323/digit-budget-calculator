import { useMemo, useState } from 'react';
import { Alert, Button, CircularProgress, Container, Stack, Typography } from '@mui/material';
import { HistoricalClassification } from 'features/HistoricalClassification/ui/HistoricalClassification';
import { ClassificationStatistics } from 'features/ClassificationStatistics/ui/ClassificationStatistics';
import { ExpenseForecast } from 'features/ExpenseForecast/ui/ExpenseForecast';
import { BudgetPlanning } from 'features/BudgetPlanning/ui/BudgetPlanning';
import { useFinancialAnalytics } from 'features/FinancialAnalytics/model/useFinancialAnalytics';
import type { AnalyticsError, AnalyticsErrorCode } from 'features/FinancialAnalytics/model/types';
import { currentSelection, selectedPeriod } from './selection';
import { PeriodSelector } from './PeriodSelector';
import { AnalyticsResults } from './AnalyticsResults';
import { RecurrenceSection } from 'features/RecurrenceAnalytics/ui/RecurrenceSection';

const errorMessages: Record<AnalyticsErrorCode, string> = {
  invalid_period: 'Некорректный период. Проверьте выбранные даты.',
  invalid_response: 'Получен некорректный ответ с операциями периода.',
  invalid_metadata: 'Не удалось подтвердить полноту ответа с операциями.',
  incomplete_response: 'Получен неполный список операций периода.',
  invalid_record: 'В истории обнаружена некорректная запись.',
  invalid_id: 'В истории обнаружен некорректный идентификатор операции.',
  duplicate_id: 'В ответе обнаружены повторяющиеся операции.',
  invalid_date: 'В истории обнаружена некорректная дата операции.',
  outside_period: 'В ответе присутствуют операции вне выбранного периода.',
  invalid_amount: 'В истории обнаружена некорректная денежная сумма.',
  invalid_category: 'В истории обнаружена некорректная категория расхода.',
  invalid_source: 'В истории обнаружен некорректный источник поступления.',
  overflow: 'Суммы превышают безопасный диапазон расчёта.',
  request_failed: 'Не удалось загрузить операции выбранного периода.',
  unavailable_response: 'Нет полного ответа с данными выбранного периода.',
};

const analyticsErrorMessage = (error: AnalyticsError): string =>
  error.code === 'invalid_amount' && error.cause === 'unsupported_precision'
    ? 'В исторических данных есть сумма с неподдерживаемой точностью (более двух знаков после запятой). Автоматическое округление не выполняется.'
    : errorMessages[error.code];

const AnalyticsPage = () => {
  const [selection, setSelection] = useState(currentSelection);
  const [showClassification, setShowClassification] = useState(false);
  const period = useMemo(() => selectedPeriod(selection), [selection]);
  const analytics = useFinancialAnalytics(period.ok ? period.value : null);
  const periodError = period.ok ? '' : period.error === 'invalid_range'
    ? 'Начальная дата не должна быть позже конечной. Исправьте выбранный период.'
    : 'Укажите корректные даты и год от 1 до 9999.';

  return (
    <Container maxWidth="lg" sx={{ py: 2, minWidth: 0 }}>
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <Typography variant="h4" component="h1">Финансовая аналитика</Typography>
        <PeriodSelector value={selection} onChange={setSelection} period={period.ok ? period.value : null} />
        <Typography variant="body2" color="text.secondary">
          Показаны записанные операции. В суммы уже входят выдача займа (расход) и возврат займа (поступление), если они есть в периоде; повторно они не прибавляются.
          Это не стоимость жизни, не заработанный доход и не остаток банковского счёта. Разность поступлений и расходов не означает свободные деньги или сбережения.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Границы отчёта и месячная группировка используют UTC. Это временное соглашение; постоянный часовой пояс отчётности ещё не утверждён.
        </Typography>
        {periodError ? <Alert severity="error">{periodError} Итоги не рассчитаны.</Alert>
          : analytics.status === 'loading' || analytics.status === 'fetching'
            ? <Stack direction="row" spacing={1} alignItems="center" role="status" aria-live="polite">
              <CircularProgress size={24} aria-label="Загрузка финансовой аналитики" />
              <Typography>{analytics.status === 'fetching' ? 'Обновление операций периода…' : 'Загрузка операций периода…'}</Typography>
            </Stack>
            : analytics.status === 'error' ? <Alert severity="error">{analyticsErrorMessage(analytics.error)} Итоги периода не рассчитаны.</Alert>
              : analytics.status === 'ready' ? <AnalyticsResults data={analytics.data} /> : null}
        <RecurrenceSection />
        <Button onClick={() => setShowClassification(value => !value)}>Классификация исторических операций</Button>
        {showClassification && period.ok && <HistoricalClassification key={`${period.value.startInclusive}/${period.value.endExclusive}`} period={period.value} />}
        {period.ok && <ClassificationStatistics key={`${period.value.startInclusive}/${period.value.endExclusive}`} period={period.value} />}
        <ExpenseForecast />
        <BudgetPlanning />
      </Stack>
    </Container>
  );
};

export default AnalyticsPage;
