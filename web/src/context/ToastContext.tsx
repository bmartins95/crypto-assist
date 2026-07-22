import { createContext, useContext, useRef, useState } from 'react';
import Toast, { ToastKind } from '@/components/Toast';
import { useLocale } from '@/context/LocaleContext';

interface QueuedToast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  showToast: (kind: ToastKind, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const { t } = useLocale();
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  const nextId = useRef(0);

  function showToast(kind: ToastKind, message: string): void {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, kind, message }]);
  }

  function dismiss(id: number): void {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack">
        {toasts.map(toast => (
          <Toast key={toast.id} kind={toast.kind} message={toast.message}
            onDismiss={() => dismiss(toast.id)} closeLabel={t.common_close} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
