import { FC } from 'react';
import { Modal } from 'shared/ui/Modal';
import { AddIncomeForm } from 'features/AddIncome';

interface AddIncomeModalProps {
  open: boolean;
  onClose: () => void;
}

export const AddIncomeModal: FC<AddIncomeModalProps> = ({ open, onClose }) => (
  <Modal
    open={open}
    onClose={onClose}
  >
    <AddIncomeForm />
  </Modal>
);
