import { FC } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Modal } from 'shared/ui/Modal';
import { selectIsAuthModalOpen } from '../model/selectors';
import { closeAuthModal } from '../model/authorizationSlice';
import { AuthForm } from './AuthForm';

export const AuthModal: FC = () => {
  const dispatch = useDispatch();
  const open = useSelector(selectIsAuthModalOpen);

  const handleClose = () => {
    dispatch(closeAuthModal());
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
    >
      <AuthForm />
    </Modal>
  );
};
