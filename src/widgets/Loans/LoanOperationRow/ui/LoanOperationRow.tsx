import { TableRow, TableCell, Chip } from '@mui/material';
import { LoanOperation } from 'entities/Expense';

const ROW_COLORS = {
  issued: 'rgba(255, 82, 82, 0.08)',
  returned: 'rgba(76, 175, 80, 0.08)',
};

interface LoanOperationRowProps {
  operation: LoanOperation;
  index: number;
}

export const LoanOperationRow = ({ operation }: LoanOperationRowProps) => {
  const isReturned = operation.type === 'returned';

  return (
    <TableRow
      sx={{
        backgroundColor: ROW_COLORS[operation.type],
        '&:hover': { backgroundColor: ROW_COLORS[operation.type] + '80' },
      }}
    >
      <TableCell>{new Date(operation.date).toLocaleDateString()}</TableCell>
      <TableCell>
        <Chip
          label={isReturned ? 'Возврат' : 'Выдача'}
          color={isReturned ? 'success' : 'error'}
          size="small"
          variant="outlined"
          sx={{ fontWeight: 500 }}
        />
      </TableCell>
      <TableCell
        sx={{
          color: isReturned ? 'success.main' : 'error.main',
          fontWeight: 600,
        }}
      >
        {isReturned ? '-' : '+'}
        {operation.amount.toLocaleString()} ₽
      </TableCell>
      <TableCell>{operation.title || operation.source || '—'}</TableCell>
      <TableCell>{operation.comment || '—'}</TableCell>
    </TableRow>
  );
};
