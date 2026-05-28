import { TableBody } from '@mui/material';
import { IncomeTableRow } from './IncomeTableRow';
import { IncomeSchema } from 'entities/Income';

interface IncomeTableBodyProps {
  incomes: IncomeSchema[];
  rowColorIndexes: number[];
  page: number;
  limit: number;
  onEdit: (id: string) => void;
}

export const IncomeTableBody = ({
  incomes,
  rowColorIndexes,
  page,
  limit,
  onEdit,
}: IncomeTableBodyProps) => (
  <TableBody>
    {incomes.map((income, idx) => (
      <IncomeTableRow
        key={income._id}
        income={income}
        index={idx}
        colorIndex={rowColorIndexes[idx]}
        globalIndex={(page - 1) * limit + idx + 1}
        onEdit={onEdit}
      />
    ))}
  </TableBody>
);
