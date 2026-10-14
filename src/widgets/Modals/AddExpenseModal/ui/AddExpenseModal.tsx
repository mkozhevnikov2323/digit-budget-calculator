import { FC, useCallback, useRef, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { Modal } from 'shared/ui/Modal';
import { AddExpenseForm } from 'features/AddExpense';
import type { ExpenseSubmissionState } from 'features/AddExpense/ui/AddExpenseForm';

interface AddExpenseModalProps {
  open: boolean;
  onClose: () => void;
}

export const AddExpenseModal: FC<AddExpenseModalProps> = ({
  open,
  onClose,
}) => {
  const criticalState = useRef<ExpenseSubmissionState>({ isBusy: false, hasUncertainResult: false });
  const [isBusy, setIsBusy] = useState(false);
  const [acknowledgementOpen, setAcknowledgementOpen] = useState(false);

  const onSubmissionStateChange = useCallback((state: ExpenseSubmissionState) => {
    // Close handlers must observe this immediately, before React commits state.
    criticalState.current = state;
    setIsBusy(state.isBusy);
  }, []);

  const requestClose = () => {
    if (criticalState.current.isBusy) return;
    if (criticalState.current.hasUncertainResult) {
      setAcknowledgementOpen(true);
      return;
    }
    onClose();
  };

  const confirmClose = () => {
    if (criticalState.current.isBusy) return;
    setAcknowledgementOpen(false);
    criticalState.current = { isBusy: false, hasUncertainResult: false };
    onClose();
  };

  return (
    <>
      <Modal open={open} onClose={requestClose} closeDisabled={isBusy}
        title="Добавление расходов" maxWidth="lg" fullWidth>
        <AddExpenseForm onSubmissionStateChange={onSubmissionStateChange} />
      </Modal>
      <Dialog open={open && acknowledgementOpen} onClose={() => setAcknowledgementOpen(false)}
        aria-labelledby="expense-close-confirmation-title" maxWidth="xs" fullWidth>
        <DialogTitle id="expense-close-confirmation-title">Закрыть результат сохранения?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Часть расходов могла сохраниться. Результат последнего запроса может быть неопределённым.
            Проверьте историю расходов перед повторным вводом этой покупки.
            При закрытии информация о результате будет скрыта.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAcknowledgementOpen(false)} autoFocus>Остаться</Button>
          <Button onClick={confirmClose}>Проверю историю, закрыть</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
