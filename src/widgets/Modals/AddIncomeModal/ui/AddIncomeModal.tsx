import { FC, useCallback, useId, useRef, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { Modal } from 'shared/ui/Modal';
import { AddIncomeForm } from 'features/AddIncome';
import type { IncomeSubmissionState } from 'features/AddIncome/ui/AddIncomeForm';

interface AddIncomeModalProps {
  open: boolean;
  onClose: () => void;
}

export const AddIncomeModal: FC<AddIncomeModalProps> = ({ open, onClose }) => {
  const criticalState = useRef<IncomeSubmissionState>({ isBusy: false, hasUncertainResult: false });
  const [isBusy, setIsBusy] = useState(false);
  const [acknowledgementOpen, setAcknowledgementOpen] = useState(false);
  const confirmationTitleId = useId();

  const onSubmissionStateChange = useCallback((state: IncomeSubmissionState) => {
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
      <Modal open={open} onClose={requestClose} closeDisabled={isBusy} title="Добавление дохода">
        <AddIncomeForm onSubmissionStateChange={onSubmissionStateChange} />
      </Modal>
      <Dialog
        open={open && acknowledgementOpen}
        onClose={() => setAcknowledgementOpen(false)}
        aria-labelledby={confirmationTitleId}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id={confirmationTitleId}>Закрыть результат сохранения дохода?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Доход мог уже сохраниться. Проверьте историю доходов перед повторным вводом.
            При закрытии сообщение о неопределённом результате будет скрыто.
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
