import { useGetIncomesQuery } from '../api/incomeApi';
import { LineChart } from '@mui/x-charts/LineChart';
import { Paper, Typography } from '@mui/material';
import { IncomeSchema } from '../model/types';
import { parseDateString } from 'shared/lib/utils/utils';

type SourcesByDate = Record<string, number>;

const groupByDateAndSource = (incomes: IncomeSchema[]) => {
  const grouped: Record<string, SourcesByDate> = {};

  incomes.forEach((income) => {
    const dateLabel = new Date(income.date).toLocaleDateString();

    if (!grouped[dateLabel]) grouped[dateLabel] = {};
    grouped[dateLabel][income.source] =
      (grouped[dateLabel][income.source] ?? 0) + income.amount;
  });

  const sortedDates = Object.keys(grouped).sort((a, b) => {
    const dateA = parseDateString(a);
    const dateB = parseDateString(b);
    return dateA.getTime() - dateB.getTime();
  });

  return { grouped, sortedDates };
};

export const LineChartIncomeBySource = () => {
  const { data: incomes = [], isLoading } = useGetIncomesQuery();

  if (isLoading) return <>Загрузка графика...</>;
  if (!incomes.length) return <>Нет данных для отображения графика</>;

  const { grouped, sortedDates } = groupByDateAndSource(incomes);

  const allSources = Array.from(
    new Set(
      Object.values(grouped).flatMap((categoriesObj) =>
        Object.keys(categoriesObj),
      ),
    ),
  );

  const series = allSources.map((category) => ({
    label: category,
    data: sortedDates.map((date) => grouped[date][category] ?? 0),
  }));

  return (
    <Paper sx={{ mt: 2, p: 2 }}>
      <Typography
        variant="h6"
        mb={2}
      >
        Динамика доходов по источникам и датам
      </Typography>
      <LineChart
        xAxis={[
          {
            scaleType: 'point',
            data: sortedDates,
            label: 'Дата',
          },
        ]}
        series={series}
        height={400}
      />
    </Paper>
  );
};
