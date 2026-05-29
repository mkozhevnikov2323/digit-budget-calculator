import { useMemo } from 'react';
import { useGetExpensesQuery } from '../api/expenseApi';
import type { LoanGroup, LoanOperation } from '../model/types';
import { IncomeSchema, useGetIncomesQuery } from 'entities/Income';

export const useLoanHistory = () => {
  const {
    data: expensesData,
    isLoading: isLoadingExpenses,
    error: expensesError,
  } = useGetExpensesQuery({
    category: 'Выдача займа',
    noPagination: true,
  });

  const {
    data: incomesData,
    isLoading: isLoadingIncomes,
    error: incomesError,
  } = useGetIncomesQuery({ noPagination: true });

  const loanGroups = useMemo((): LoanGroup[] => {
    const expenses = expensesData?.expenses ?? [];
    const incomes = incomesData?.incomes ?? [];

    const issuedMap = new Map<string, typeof expenses>();
    for (const exp of expenses) {
      const key = exp.recipient || 'Без получателя';
      if (!issuedMap.has(key)) issuedMap.set(key, []);
      issuedMap.get(key)!.push(exp);
    }

    const result: LoanGroup[] = [];

    for (const [recipient, issuedLoans] of issuedMap.entries()) {
      const returns = incomes.filter(
        (inc: IncomeSchema) =>
          inc.source === 'Возврат займа' && inc.comment === recipient,
      );

      const issuedOps: LoanOperation[] = issuedLoans.map((loan) => ({
        _id: loan._id,
        date: loan.date,
        amount: loan.amount,
        type: 'issued' as const,
        title: loan.title,
        comment: loan.comment,
      }));

      const returnedOps: LoanOperation[] = returns.map((ret) => ({
        _id: ret._id,
        date: ret.date,
        amount: ret.amount,
        type: 'returned' as const,
        source: ret.source,
        comment: ret.comment,
      }));

      const operations = [...issuedOps, ...returnedOps].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

      const totalIssued = issuedOps.reduce((sum, op) => sum + op.amount, 0);
      const totalReturned = returnedOps.reduce((sum, op) => sum + op.amount, 0);
      const totalAmount = totalIssued - totalReturned;

      result.push({
        recipient,
        totalAmount,
        operations,
      });
    }

    return result.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [expensesData?.expenses, incomesData?.incomes]);

  return {
    loanGroups,
    isLoading: isLoadingExpenses || isLoadingIncomes,
    error: expensesError || incomesError,
  };
};
