import { FC } from 'react';
import { Modal } from 'shared/ui/Modal';
import { EditIncomeForm } from 'features/EditIncome';

interface EditIncomeModalProps {
  open: boolean;
  onClose: () => void;
  incomeId: string | number;
}

export const EditIncomeModal: FC<EditIncomeModalProps> = ({
  open,
  onClose,
  incomeId,
}) => (
  <Modal
    open={open}
    onClose={onClose}
  >
    <EditIncomeForm
      onClose={onClose}
      incomeId={incomeId}
    />
  </Modal>
);
