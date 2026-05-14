import { TableRow, TableCell, Button } from '@mui/material';
import { ExpenseSchema } from 'entities/Expense';
import { COLORS } from 'shared/lib/utils/getRowColorByDate';

interface ExpenseTableRowProps {
  expense: ExpenseSchema;
  index: number;
  colorIndex: number;
  globalIndex: number;
  onEdit: (id: string) => void;
}

export const ExpenseTableRow = ({
  expense,
  index,
  colorIndex,
  globalIndex,
  onEdit,
}: ExpenseTableRowProps) => (
  <TableRow
    key={expense._id || index}
    sx={{ backgroundColor: COLORS[colorIndex] }}
  >
    <TableCell>{globalIndex}</TableCell>
    <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
    <TableCell>{expense.amount}</TableCell>
    <TableCell>{expense.title}</TableCell>
    <TableCell>{expense.category}</TableCell>
    <TableCell>{expense.recipient}</TableCell>
    <TableCell>{expense.comment}</TableCell>
    <TableCell>
      <Button
        onClick={() => onEdit(expense._id)}
        variant="outlined"
        sx={{
          py: 0,
          textTransform: 'capitalize',
        }}
      >
        Редактировать
      </Button>
    </TableCell>
  </TableRow>
);
