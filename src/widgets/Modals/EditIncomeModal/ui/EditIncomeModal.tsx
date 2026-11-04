import type { IncomeSchema } from 'entities/Income';
import { FC } from 'react';
import { Modal } from 'shared/ui/Modal';
import { EditIncomeForm } from 'features/EditIncome';

interface EditIncomeModalProps {
  open: boolean;
  onClose: () => void;
  incomeId: string | number;
  initialIncome?: IncomeSchema;
}

export const EditIncomeModal: FC<EditIncomeModalProps> = ({
  open,
  onClose,
  incomeId,
  initialIncome,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    {...(initialIncome ? {title:'Редактировать доход'} : {})}
  >
    <EditIncomeForm
      onClose={onClose}
      incomeId={incomeId}
      initialIncome={initialIncome}
    />
  </Modal>
);
