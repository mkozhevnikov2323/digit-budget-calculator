import { useGetExpensesQuery } from '../api/expenseApi';

export const useLoanIssuedExpenses = () => {
  return useGetExpensesQuery({
    category: 'Выдача займа',
    noPagination: true,
  });
};
