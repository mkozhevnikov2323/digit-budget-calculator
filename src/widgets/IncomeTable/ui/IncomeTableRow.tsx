import { TableRow, TableCell, Button } from '@mui/material';
import { IncomeSchema } from 'entities/Income';
import { COLORS } from 'shared/lib/utils/getRowColorByDate';

interface IncomeTableRowProps {
  income: IncomeSchema;
  index: number;
  colorIndex: number;
  globalIndex: number;
  onEdit: (id: string) => void;
}

export const IncomeTableRow = ({
  income,
  index,
  colorIndex,
  globalIndex,
  onEdit,
}: IncomeTableRowProps) => (
  <TableRow
    key={income._id || index}
    sx={{ backgroundColor: COLORS[colorIndex] }}
  >
    <TableCell>{globalIndex}</TableCell>
    <TableCell>{new Date(income.date).toLocaleDateString()}</TableCell>
    <TableCell>{income.amount}</TableCell>
    <TableCell>{income.source}</TableCell>
    <TableCell>{income.comment}</TableCell>
    <TableCell>
      <Button
        onClick={() => onEdit(income._id)}
        variant="text"
      >
        Редактировать
      </Button>
    </TableCell>
  </TableRow>
);
