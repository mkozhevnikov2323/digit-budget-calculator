import { useMemo, useState } from 'react';
import { Alert, CircularProgress, Container, Stack, Typography } from '@mui/material';
import { skipToken } from '@reduxjs/toolkit/query';
import { useGetExpensesQuery } from 'entities/Expense/api/expenseApi';
import { useGetIncomesQuery } from 'entities/Income/api/incomeApi';
import { assertCompleteResponse, buildAnalytics } from '../model/calculations';
import { currentPeriod, getCalendarRange, getGranularity, toApiRange } from '../model/period';
import { PeriodSelector } from './PeriodSelector';
import { AnalyticsResults } from './AnalyticsResults';

const AnalyticsPage = () => {
  const [selection, setSelection] = useState(() => currentPeriod());
  const period = useMemo(() => {
    try {
      const range = getCalendarRange(selection);
      return { range, params: { ...toApiRange(range), noPagination: true }, granularity: getGranularity(range, selection.kind), error: '' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Некорректный период.' };
    }
  }, [selection]);
  const expenses = useGetExpensesQuery(period.params ?? skipToken);
  const incomes = useGetIncomesQuery(period.params ?? skipToken);
  // currentData, unlike data, never reuses another period's cached payload.
  const loading = expenses.isLoading || expenses.isFetching || incomes.isLoading || incomes.isFetching;
  const queryFailed = expenses.isError || incomes.isError;
  const result = useMemo(() => {
    if (!period.range || !period.granularity || loading || queryFailed) return {};
    try {
      if (!expenses.currentData || !incomes.currentData) throw new Error('Нет полного ответа API для выбранного периода.');
      assertCompleteResponse(expenses.currentData, expenses.currentData.expenses);
      assertCompleteResponse(incomes.currentData, incomes.currentData.incomes);
      return { data: buildAnalytics(expenses.currentData.expenses, incomes.currentData.incomes, period.range, period.granularity) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Не удалось рассчитать итоги.' };
    }
  }, [period, loading, queryFailed, expenses.currentData, incomes.currentData]);

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <Typography variant="h4" component="h1">Финансовая аналитика</Typography>
        <PeriodSelector value={selection} onChange={setSelection} />
        <Typography variant="body2" color="text.secondary">
          Показаны записанные операции. В суммы входят выдача займа (расход) и возврат займа (приход), если они есть в периоде.
          Это не стоимость жизни, не заработанный доход и не остаток банковского счёта. Разность сумм не означает свободные деньги.
          Границы дней и группировка дат — UTC, одинаково для доходов и расходов.
        </Typography>
        {period.error ? <Alert severity="error">{period.error}</Alert>
          : queryFailed ? <Alert severity="error">Не удалось загрузить {expenses.isError && incomes.isError ? 'доходы и расходы' : expenses.isError ? 'расходы' : 'доходы'} выбранного периода. Итоги не рассчитаны.</Alert>
          : loading ? <Stack direction="row" spacing={1} alignItems="center" role="status"><CircularProgress size={24} /><Typography>Загрузка операций периода…</Typography></Stack>
          : result.error ? <Alert severity="error">{result.error} Итоги не показаны.</Alert>
          : result.data ? <AnalyticsResults data={result.data} /> : null}
      </Stack>
    </Container>
  );
};

export default AnalyticsPage;
