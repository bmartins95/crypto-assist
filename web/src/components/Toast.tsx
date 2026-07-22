import { useEffect, useRef } from 'react';

export type ToastKind = 'success' | 'error';

interface ToastProps {
  kind: ToastKind;
  message: string;
  onDismiss: () => void;
  closeLabel: string;
}

const AUTO_DISMISS_MS = 5000;

export default function Toast({ kind, message, onDismiss, closeLabel }: ToastProps) {
  // Read through a ref rather than depending on `onDismiss` directly — when
  // several toasts are piled in a shared stack, adding/removing any one of
  // them re-renders the rest with a new (but equivalent) onDismiss closure;
  // depending on it here would restart every other toast's countdown too.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const id = window.setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [message]);

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
