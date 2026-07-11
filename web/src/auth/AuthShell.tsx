import type { ReactNode } from 'react';

interface AuthShellProps {
  children: ReactNode;
}

export default function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="auth-shell">
      <div className="auth-glow" aria-hidden="true" />
      <div className="auth-stage">{children}</div>
    </div>
  );
}
