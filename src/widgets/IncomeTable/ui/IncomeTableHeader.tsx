import { TableHead, TableRow, TableCell } from '@mui/material';

export const IncomeTableHeader = () => (
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
);
