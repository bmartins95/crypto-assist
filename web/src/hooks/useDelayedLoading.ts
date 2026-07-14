import { useEffect, useRef, useState } from 'react';

// Avoids two UX failures of naively mirroring `isLoading`: a skeleton flashing
// on responses under `delay` (looks like a bug), and a skeleton disappearing
// before `minDuration` once shown (reads as a strobe).
export function useDelayedLoading(isLoading: boolean, delay = 150, minDuration = 300): boolean {
  const [show, setShow] = useState(false);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    if (isLoading) {
      showTimer = setTimeout(() => {
        shownAt.current = Date.now();
        setShow(true);
      }, delay);
    } else if (show) {
      const elapsed = Date.now() - (shownAt.current ?? 0);
      const remaining = Math.max(0, minDuration - elapsed);
      hideTimer = setTimeout(() => {
        setShow(false);
        shownAt.current = null;
      }, remaining);
    }

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, delay, minDuration]);

  return show;
}
