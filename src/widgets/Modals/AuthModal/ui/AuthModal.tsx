import { AuthForm } from 'features/Authorization';
import { FC } from 'react';
import { Modal } from 'shared/ui/Modal';

interface AuthModalProps {
  open: boolean;
  onClose: (arg: boolean) => void;
}

export const AuthModal: FC<AuthModalProps> = (props) => {
  const { open, onClose } = props;

  return (
    <Modal
      open={open}
      onClose={onClose}
    >
      <AuthForm />
    </Modal>
  );
};
