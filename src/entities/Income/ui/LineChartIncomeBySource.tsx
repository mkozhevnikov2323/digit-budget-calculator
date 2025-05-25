import { useGetIncomesQuery } from '../api/incomeApi';
import { LineChart } from '@mui/x-charts/LineChart';
import { Paper, Typography } from '@mui/material';
import { IncomeSchema } from '../model/types';

type SourcesByDate = Record<string, Record<string, number>>;

const groupByDateAndSource = (incomes: IncomeSchema[]): SourcesByDate => {
  return incomes.reduce<SourcesByDate>((acc, income) => {
    const dateLabel = new Date(income.date).toLocaleDateString();

    if (!acc[dateLabel]) acc[dateLabel] = {};
    acc[dateLabel][income.source] =
      (acc[dateLabel][income.source] ?? 0) + income.amount;

    return acc;
  }, {});
};

export const LineChartIncomeBySource = () => {
  const { data: incomes = [], isLoading } = useGetIncomesQuery();

  if (isLoading) return <>Загрузка графика...</>;
  if (!incomes.length) return <>Нет данных для отображения графика</>;

  const groupedBySource = groupByDateAndSource(incomes);

  const labels = Object.keys(groupedBySource).sort((a, b) => {
    const ad = new Date(a);
    const bd = new Date(b);
    return ad.getTime() - bd.getTime();
  });

  const allSources = Array.from(
    new Set(
      Object.values(groupedBySource).flatMap((sourcesObj) =>
        Object.keys(sourcesObj),
      ),
    ),
  );

  const series = allSources.map((source) => ({
    label: source,
    data: labels.map((date) => groupedBySource[date][source] ?? 0),
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
        xAxis={[{ scaleType: 'point', data: labels, label: 'Дата' }]}
        series={series}
        height={400}
      />
    </Paper>
  );
};
