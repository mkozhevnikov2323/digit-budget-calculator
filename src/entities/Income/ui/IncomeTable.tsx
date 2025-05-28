import { ExportCSVButton } from 'features/ExportCSV';
import { useGetIncomesQuery } from '../api/incomeApi';
import {
  Table,
  TableHead,
  TableCell,
  TableRow,
  TableBody,
  Paper,
  TableContainer,
  Box,
  Typography,
} from '@mui/material';
import { sortByDate } from 'shared/lib/utils/utils';

export const IncomeTable = () => {
  const { data: incomes = [], isLoading } = useGetIncomesQuery();

  if (isLoading) return <>Loading...</>;

  const sortedIncomes = sortByDate(incomes);

  const incomesMappedForExport =
    sortedIncomes &&
    sortedIncomes?.map((income, index) => ({
      Номер: index + 1,
      Дата: new Date(income.date).toLocaleDateString(),
      Сумма: income.amount,
      Источник: income.source,
      Комментарий: income.comment || '',
    }));

  return (
    <Box>
      <Box
        mb={2}
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography
          datatest-id="Headers table"
          variant="h6"
        >
          Таблица доходов
        </Typography>
        <ExportCSVButton
          data={incomesMappedForExport}
          filename="incomes.csv"
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>№</TableCell>
              <TableCell>Дата</TableCell>
              <TableCell>Сумма</TableCell>
              <TableCell>Источник</TableCell>
              <TableCell>Комментарий</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedIncomes.map((income, idx) => (
              <TableRow key={idx}>
                <TableCell>{idx + 1}</TableCell>
                <TableCell>
                  {new Date(income.date).toLocaleDateString()}
                </TableCell>
                <TableCell>{income.amount}</TableCell>
                <TableCell>{income.source}</TableCell>
                <TableCell>{income.comment}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
