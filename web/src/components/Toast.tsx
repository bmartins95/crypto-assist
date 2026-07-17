import { useEffect } from 'react';

export type ToastKind = 'success' | 'error';

interface ToastProps {
  kind: ToastKind;
  message: string;
  onDismiss: () => void;
  closeLabel: string;
}

const AUTO_DISMISS_MS = 5000;

export default function Toast({ kind, message, onDismiss, closeLabel }: ToastProps) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [message, onDismiss]);

  return (
    <div className={`toast toast--${kind}`} role="status" aria-live="polite">
      <i className={`ti ti-${kind === 'success' ? 'circle-check' : 'alert-circle'}`} aria-hidden="true" />
      <span className="toast-msg">{message}</span>
      <button type="button" className="toast-close" onClick={onDismiss} aria-label={closeLabel}>
        <i className="ti ti-x" aria-hidden="true" />
      </button>
    </div>
  );
}
