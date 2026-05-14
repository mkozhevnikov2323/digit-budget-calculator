import { TableBody } from '@mui/material';
import { ExpenseTableRow } from './ExpenseTableRow';
import { ExpenseSchema } from 'entities/Expense';

interface ExpenseTableBodyProps {
  expenses: ExpenseSchema[];
  rowColorIndexes: number[];
  page: number;
  limit: number;
  onEdit: (id: string) => void;
}

export const ExpenseTableBody = ({
  expenses,
  rowColorIndexes,
  page,
  limit,
  onEdit,
}: ExpenseTableBodyProps) => (
  <TableBody>
    {expenses.map((expense, idx) => (
      <ExpenseTableRow
        key={expense._id}
        expense={expense}
        index={idx}
        colorIndex={rowColorIndexes[idx]}
        globalIndex={(page - 1) * limit + idx + 1}
        onEdit={onEdit}
      />
    ))}
  </TableBody>
);
