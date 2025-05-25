import { FC } from 'react';
import { Modal } from 'shared/ui/Modal';
import { AddExpenseForm } from 'features/AddExpense';

interface AddExpenseModalProps {
  open: boolean;
  onClose: () => void;
}

export const AddExpenseModal: FC<AddExpenseModalProps> = ({
  open,
  onClose,
}) => (
  <Modal
    open={open}
    onClose={onClose}
  >
    <AddExpenseForm />
  </Modal>
);
