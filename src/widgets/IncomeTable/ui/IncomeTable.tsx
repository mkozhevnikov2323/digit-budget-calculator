import {
  Table,
  TableContainer,
  Paper,
  Box,
  Typography,
  Pagination,
} from '@mui/material';
import { ExportCSVButton } from 'features/ExportCSV';
import { useState } from 'react';
import { getRowColorIndexesByDate } from 'shared/lib/utils/getRowColorByDate';
import { EditIncomeModal } from 'widgets/Modals/EditIncomeModal';
import { useDispatch, useSelector } from 'react-redux';

import { MonthSelector } from 'shared/ui/MonthSelector';
import { YearSelector } from 'shared/ui/YearSelector';
import { IncomeTableHeader } from './IncomeTableHeader';
import { IncomeTableBody } from './IncomeTableBody';
import {
  selectAllIncomes,
  selectIncomeFilters,
  selectIncomePagination,
  setMonth,
  setPage,
  setYear,
  useSyncIncomesWithStore,
} from 'entities/Income';

export const IncomeTable = () => {
  const [editId, setEditId] = useState<string | number | undefined>(undefined);
  const dispatch = useDispatch();

  const incomes = useSelector(selectAllIncomes) ?? [];
  const { total, page, limit } = useSelector(selectIncomePagination);
  const { year, month } = useSelector(selectIncomeFilters);
  const { isLoading } = useSyncIncomesWithStore();

  if (isLoading) {
    return <Typography>Загрузка...</Typography>;
  }

  const incomesMappedForExport = incomes.map((income, index) => ({
    Номер: (page - 1) * limit + index + 1,
    Дата: new Date(income.date).toLocaleDateString(),
    Сумма: income.amount,
    Источник: income.source,
    Комментарий: income.comment || '',
  }));

  const rowColorIndexes = getRowColorIndexesByDate(incomes);

  return (
    <Box>
      <Box
        mb={2}
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Typography variant="h6">Таблица доходов</Typography>
        <ExportCSVButton
          data={incomesMappedForExport}
          filename="incomes.csv"
        />
      </Box>

      <Box
        mb={2}
        sx={{ display: 'flex', gap: 2 }}
      >
        <YearSelector
          currentYear={year}
          onChangeYear={(y) => dispatch(setYear(y))}
          sx={{ minWidth: 120 }}
        />
        <MonthSelector
          currentMonth={month}
          onChangeMonth={(m) => dispatch(setMonth(m))}
          sx={{ minWidth: 150 }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <IncomeTableHeader />
          <IncomeTableBody
            incomes={incomes}
            rowColorIndexes={rowColorIndexes}
            page={page}
            limit={limit}
            onEdit={setEditId}
          />
        </Table>
      </TableContainer>

      <Box
        mt={2}
        display="flex"
        justifyContent="center"
      >
        <Pagination
          count={Math.ceil(total / limit)}
          page={page}
          onChange={(_, value) => dispatch(setPage(value))}
          color="primary"
        />
      </Box>

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
