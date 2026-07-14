import { useEffect, useRef, useState } from 'react';

// True once `isActive` has stayed continuously true for longer than `thresholdMs`
// — used to escalate a slow load (likely a cold backend) into a more informative
// state without reacting to every brief, sub-threshold loading blip.
export function useElapsedOver(isActive: boolean, thresholdMs: number): boolean {
  const [over, setOver] = useState(false);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      startedAt.current = null;
      setOver(false);
      return;
    }
    if (startedAt.current === null) startedAt.current = Date.now();
    const remaining = Math.max(0, thresholdMs - (Date.now() - startedAt.current));
    const id = setTimeout(() => setOver(true), remaining);
    return () => clearTimeout(id);
  }, [isActive, thresholdMs]);

  return over;
}
