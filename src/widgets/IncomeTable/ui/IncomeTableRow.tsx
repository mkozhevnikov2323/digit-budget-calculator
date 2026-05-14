import { TableRow, TableCell, Button } from '@mui/material';
import { IncomeSchema } from 'entities/Income';
import { COLORS } from 'shared/lib/utils/getRowColorByDate';

interface IncomeTableRowProps {
  income: IncomeSchema;
  index: number;
  colorIndex: number;
  onEdit: (id: string | number) => void;
}

export const IncomeTableRow = ({
  income,
  index,
  colorIndex,
  onEdit,
}: IncomeTableRowProps) => (
  <TableRow
    key={income._id ?? index}
    sx={{ backgroundColor: COLORS[colorIndex] }}
  >
    <TableCell>{index + 1}</TableCell>
    <TableCell>{new Date(income.date).toLocaleDateString()}</TableCell>
    <TableCell>{income.amount}</TableCell>
    <TableCell>{income.source}</TableCell>
    <TableCell>{income.comment}</TableCell>
    <TableCell>
      <Button
        onClick={() => onEdit(income._id ?? index)}
        variant="text"
      >
        Редактировать
      </Button>
    </TableCell>
  </TableRow>
);
