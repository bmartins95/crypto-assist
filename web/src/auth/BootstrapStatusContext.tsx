import { createContext, useContext } from 'react';

export type BootstrapStatus = 'pending' | 'ready' | 'error';

// Default of 'ready' is a safe fallback for anything rendered outside
// AppBootstrapGate (e.g. in isolated component tests).
export const BootstrapStatusContext = createContext<BootstrapStatus>('ready');

export function useBootstrapStatus(): BootstrapStatus {
  return useContext(BootstrapStatusContext);
}
