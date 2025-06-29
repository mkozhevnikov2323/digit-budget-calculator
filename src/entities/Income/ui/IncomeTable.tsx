import { ExportCSVButton } from 'features/ExportCSV';
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
  Button,
} from '@mui/material';
import { useSelector } from 'react-redux';
import { selectAllIncomes } from '../model/selectors';
import { useState } from 'react';
import { EditIncomeModal } from 'widgets/Modals/EditIncomeModal';
import {
  COLORS,
  getRowColorIndexesByDate,
} from 'shared/lib/utils/getRowColorByDate';

export const IncomeTable = () => {
  const [editId, setEditId] = useState<string | number | undefined>(undefined);

  const incomes = useSelector(selectAllIncomes);

  if (!incomes)
    return <Typography variant="h6">Нет данных для таблицы доходов</Typography>;

  const sortedIncomes = incomes
    .slice()
    .sort(
      (a, b) =>
        new Date(a.date as string).getTime() -
        new Date(b.date as string).getTime(),
    );

  const incomesMappedForExport =
    sortedIncomes &&
    sortedIncomes?.map((income, index) => ({
      Номер: index + 1,
      Дата: new Date(income.date).toLocaleDateString(),
      Сумма: income.amount,
      Источник: income.source,
      Комментарий: income.comment || '',
    }));

  const rowColorIndexes = getRowColorIndexesByDate(sortedIncomes);

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
              <TableCell>Управление</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedIncomes.map((income, idx) => (
              <TableRow
                key={income._id || idx}
                sx={{
                  backgroundColor: COLORS[rowColorIndexes[idx]],
                }}
              >
                <TableCell>{idx + 1}</TableCell>
                <TableCell>
                  {new Date(income.date).toLocaleDateString()}
                </TableCell>
                <TableCell>{income.amount}</TableCell>
                <TableCell>{income.source}</TableCell>
                <TableCell>{income.comment}</TableCell>
                <TableCell>
                  <Button
                    onClick={() => setEditId(income._id)}
                    variant="text"
                  >
                    Редактировать
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {editId && (
        <EditIncomeModal
          open={!!editId}
          onClose={() => setEditId(undefined)}
          incomeId={editId}
        />
      )}
    </Box>
  );
};
