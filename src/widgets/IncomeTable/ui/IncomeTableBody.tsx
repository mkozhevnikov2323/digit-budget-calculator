import { TableBody } from '@mui/material';
import { IncomeTableRow } from './IncomeTableRow';
import { IncomeSchema } from 'entities/Income';

interface IncomeTableBodyProps {
  incomes: IncomeSchema[];
  rowColorIndexes: number[];
  onEdit: (id: string | number) => void;
}

export const IncomeTableBody = ({
  incomes,
  rowColorIndexes,
  onEdit,
}: IncomeTableBodyProps) => (
  <TableBody>
    {incomes.map((income, idx) => (
      <IncomeTableRow
        key={income._id ?? idx}
        income={income}
        index={idx}
        colorIndex={rowColorIndexes[idx]}
        onEdit={onEdit}
      />
    ))}
  </TableBody>
);
