import { fireEvent, render, screen } from '@testing-library/react';
import { Modal } from '../ui/Modal';

describe('Modal defaults and close guard', () => {
  it.each(['button', 'escape', 'backdrop'])('preserves default title and closing by %s', (mechanism) => {
    const onClose = jest.fn();
    render(<Modal open onClose={onClose}>Existing content</Modal>);
    const dialog = screen.getByRole('dialog', { name: 'Вход / Регистрация' });
    expect(dialog).toHaveClass('MuiDialog-paperWidthSm');
    expect(dialog).not.toHaveClass('MuiDialog-paperFullWidth');
    if (mechanism === 'button') fireEvent.click(screen.getByRole('button', { name: 'close' }));
    else if (mechanism === 'escape') fireEvent.keyDown(dialog, { key: 'Escape' });
    else {
      fireEvent.mouseDown(dialog.parentElement!);
      fireEvent.click(dialog.parentElement!);
    }
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('blocks all close events when closeDisabled is set', () => {
    const onClose = jest.fn();
    render(<Modal open onClose={onClose} closeDisabled>Existing content</Modal>);
    const dialog = screen.getByRole('dialog');
    const closeButton = screen.getByRole('button', { name: 'close' });
    expect(closeButton).toBeDisabled();
    fireEvent.click(closeButton);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(dialog.parentElement!);
    expect(onClose).not.toHaveBeenCalled();
  });
});
