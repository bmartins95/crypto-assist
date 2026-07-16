import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onCancel();
  }

  return (
    <>
      <div className="confirm-backdrop" onClick={onCancel} />
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onKeyDown={handleKeyDown}
      >
        <div className="confirm-dialog-title" id="confirm-dialog-title">{title}</div>
        <div className="confirm-dialog-msg" id="confirm-dialog-message">{message}</div>
        <div className="confirm-dialog-actions">
          <button type="button" className="settings-btn" onClick={onCancel} ref={cancelRef}>{cancelLabel}</button>
          <button type="button" className="settings-btn settings-btn--danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </>
  );
}
