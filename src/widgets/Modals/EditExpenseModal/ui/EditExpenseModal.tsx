import type { ExpenseSchema } from 'entities/Expense';
import { FC } from 'react';
import { Modal } from 'shared/ui/Modal';
import { EditExpenseForm } from 'features/EditExpense';

interface EditExpenseModalProps {
  open: boolean;
  onClose: () => void;
  expenseId: string | number;
  initialExpense?: ExpenseSchema;
}
export const EditExpenseModal: FC<EditExpenseModalProps> = ({
  open,
  onClose,
  expenseId,
  initialExpense,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    {...(initialExpense ? {title:'Редактировать расход'} : {})}
  >
    <EditExpenseForm
      onClose={onClose}
      expenseId={expenseId}
      initialExpense={initialExpense}
    />
  </Modal>
);
