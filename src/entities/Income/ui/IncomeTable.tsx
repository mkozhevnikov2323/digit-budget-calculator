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

export const IncomeTable = () => {
  const { data: incomes = [], isLoading } = useGetIncomesQuery();

  if (isLoading) return <>Loading...</>;

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
          data={incomes}
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
            {incomes.map((income, idx) => (
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
