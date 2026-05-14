import { ExportCSVButton } from 'features/ExportCSV';
import { Table, TableContainer, Paper, Box, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import { useState } from 'react';
import { EditIncomeModal } from 'widgets/Modals/EditIncomeModal';
import { getRowColorIndexesByDate } from 'shared/lib/utils/getRowColorByDate';
import { IncomeTableHeader } from './IncomeTableHeader';
import { IncomeTableBody } from './IncomeTableBody';
import { selectAllIncomes } from 'entities/Income';

export const IncomeTable = () => {
  const [editId, setEditId] = useState<string | number | undefined>(undefined);
  const incomes = useSelector(selectAllIncomes);

  if (!incomes) {
    return <Typography variant="h6">Нет данных для таблицы доходов</Typography>;
  }

  const sortedIncomes = [...incomes].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const incomesMappedForExport = sortedIncomes.map((income, index) => ({
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
          data-testid="income-table-header"
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
          <IncomeTableHeader />
          <IncomeTableBody
            incomes={sortedIncomes}
            rowColorIndexes={rowColorIndexes}
            onEdit={setEditId}
          />
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
