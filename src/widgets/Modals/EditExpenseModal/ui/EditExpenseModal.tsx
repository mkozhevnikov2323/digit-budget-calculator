import { FC } from 'react';
import { Modal } from 'shared/ui/Modal';
import { EditExpenseForm } from 'features/EditExpense';

interface EditExpenseModalProps {
  open: boolean;
  onClose: () => void;
  expenseId: string | number;
}
export const EditExpenseModal: FC<EditExpenseModalProps> = ({
  open,
  onClose,
  expenseId,
}) => (
  <Modal
    open={open}
    onClose={onClose}
  >
    <EditExpenseForm
      onClose={onClose}
      expenseId={expenseId}
    />
  </Modal>
);
