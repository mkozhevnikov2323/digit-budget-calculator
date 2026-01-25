import {
  Box,
  TableContainer,
  Typography,
  Table,
  TableCell,
  TableHead,
  TableBody,
  TableRow,
  Paper,
} from '@mui/material';
import { ExpenseSchema } from 'entities/Expense';
import { COLORS } from 'shared/lib/utils/getRowColorByDate';

interface MonthlySummaryExpenseTableProps {
  expenses: ExpenseSchema[] | undefined;
}

export const MonthlySummaryExpenseTable = ({
  expenses,
}: MonthlySummaryExpenseTableProps) => {
  const monthlySummary: { [key: string]: number } = {};

  expenses?.forEach((expense) => {
    const { category, amount } = expense;
    monthlySummary[category] = (monthlySummary[category] || 0) + amount;
  });

  const summaryData = Object.entries(monthlySummary).sort(
    ([, sumA], [, sumB]) => sumB - sumA,
  );

  return (
    <Box>
      <Typography>Сводная таблица по категориям:</Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Категория</TableCell>
              <TableCell>Сумма</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {summaryData.map(([category, sum], idx) => (
              <TableRow
                key={idx}
                sx={{
                  backgroundColor: COLORS[idx % 2],
                }}
              >
                <TableCell>{category}</TableCell>
                <TableCell>{sum.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
