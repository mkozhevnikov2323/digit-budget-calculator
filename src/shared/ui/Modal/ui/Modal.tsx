import React, { ReactNode, useId } from 'react';
import { styled } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import type { DialogProps } from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
  title?: ReactNode;
  maxWidth?: DialogProps['maxWidth'];
  fullWidth?: boolean;
  closeDisabled?: boolean;
}

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialogContent-root': {
    padding: theme.spacing(2),
  },
  '& .MuiDialogActions-root': {
    padding: theme.spacing(1),
  },
}));

export const Modal = ({
  open, onClose, children, title = 'Вход / Регистрация',
  maxWidth, fullWidth, closeDisabled = false,
}: ModalProps) => {
  const titleId = useId();
  const requestClose = () => {
    if (!closeDisabled) onClose();
  };
  return (
    <React.Fragment>
      <BootstrapDialog
        onClose={requestClose}
        disableEscapeKeyDown={closeDisabled}
        maxWidth={maxWidth}
        fullWidth={fullWidth}
        aria-labelledby={titleId}
        open={open}
      >
        <DialogTitle
          sx={{ m: 0, p: 2, pr: 7 }}
          id={titleId}
        >
          {title}
        </DialogTitle>
        <IconButton
          aria-label="close"
          onClick={requestClose}
          disabled={closeDisabled}
          sx={(theme) => ({
            position: 'absolute',
            right: 8,
            top: 8,
            color: theme.palette.grey[500],
          })}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent dividers>{children}</DialogContent>
      </BootstrapDialog>
    </React.Fragment>
  );
};
