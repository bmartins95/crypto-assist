import { useState } from 'react';

interface ErrorStateProps {
  title: string;
  message: string;
  retryLabel: string;
  retryingLabel: string;
  exitLabel?: string;
  onRetry: () => Promise<void>;
  onExit?: () => void;
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export default function ErrorState({ title, message, retryLabel, retryingLabel, exitLabel, onRetry, onExit }: ErrorStateProps) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } catch {
      // A rejection just means the retry failed — the persistent error card is
      // already the visible failure state, so resetting the button (below) for
      // another attempt is the correct feedback; nothing further to show.
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="auth-error-state">
      <div className="auth-error-icon-wrap">
        <AlertIcon />
      </div>
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="auth-error-actions">
        <button
          type="button"
          className={`auth-btn auth-btn-primary${retrying ? ' auth-btn-spinning' : ''}`}
          onClick={handleRetry}
          disabled={retrying}
        >
          <RefreshIcon />
          <span>{retrying ? retryingLabel : retryLabel}</span>
        </button>
        {onExit && exitLabel && (
          <button type="button" className="auth-btn auth-btn-ghost" onClick={onExit}>
            {exitLabel}
          </button>
        )}
      </div>
    </div>
  );
}
