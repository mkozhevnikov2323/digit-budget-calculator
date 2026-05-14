import { TableHead, TableRow, TableCell } from '@mui/material';

export const ExpenseTableHeader = () => (
  <TableHead>
    <TableRow>
      <TableCell>№</TableCell>
      <TableCell>Дата</TableCell>
      <TableCell>Сумма</TableCell>
      <TableCell>Название</TableCell>
      <TableCell>Категория</TableCell>
      <TableCell>Получатель</TableCell>
      <TableCell>Комментарий</TableCell>
      <TableCell>Управление</TableCell>
    </TableRow>
  </TableHead>
);
