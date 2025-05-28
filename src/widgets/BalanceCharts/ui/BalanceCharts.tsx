import { Paper, Typography, CircularProgress, Alert } from '@mui/material';
import { ChartsReferenceLine } from '@mui/x-charts';
import { BarChart } from '@mui/x-charts/BarChart';
import { useGetBalanceQuery } from 'entities/Balance';

const barColors = ['#388e3c', '#d32f2f', '#1976d2'];

export const BarChartBalance = () => {
  const { data, isLoading, error } = useGetBalanceQuery();

  if (isLoading) {
    return (
      <Paper sx={{ mt: 2, p: 2, textAlign: 'center' }}>
        <CircularProgress />
      </Paper>
    );
  }
  if (error) {
    return (
      <Paper sx={{ mt: 2, p: 2 }}>
        <Alert severity="error">Ошибка при загрузке баланса</Alert>
      </Paper>
    );
  }

  const xLabels = ['Доходы', 'Расходы', 'Баланс'];
  const values = [data?.income ?? 0, data?.expense ?? 0, data?.balance ?? 0];

  return (
    <Paper sx={{ mt: 2, p: 2, mb: 4 }}>
      <Typography
        variant="h6"
        mb={2}
      >
        Диаграмма баланса
      </Typography>
      <BarChart
        xAxis={[
          {
            data: xLabels,
            label: 'Показатели',
          },
        ]}
        series={[
          {
            data: [values[0], null, null],
            color: barColors[0],
            label: 'Доходы',
          },
          {
            data: [null, values[1], null],
            color: barColors[1],
            label: 'Расходы',
          },
          {
            data: [null, null, values[2]],
            color: barColors[2],
            label: 'Баланс',
          },
        ]}
        height={400}
      >
        <ChartsReferenceLine y={0} />
      </BarChart>
    </Paper>
  );
};
