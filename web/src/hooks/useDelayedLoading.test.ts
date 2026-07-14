import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDelayedLoading } from './useDelayedLoading';

describe('useDelayedLoading', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts hidden', () => {
    const { result } = renderHook(() => useDelayedLoading(true, 150, 300));
    expect(result.current).toBe(false);
  });

  it('does not show the skeleton at all when loading ends before the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ loading }) => useDelayedLoading(loading, 150, 300),
      { initialProps: { loading: true } }
    );
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ loading: false });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe(false);
  });

  it('shows the skeleton once loading outlasts the delay', () => {
    const { result } = renderHook(() => useDelayedLoading(true, 150, 300));
    act(() => { vi.advanceTimersByTime(149); });
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(true);
  });

  it('keeps the skeleton visible for at least minDuration once shown, even if loading ends immediately after', () => {
    const { result, rerender } = renderHook(
      ({ loading }) => useDelayedLoading(loading, 150, 300),
      { initialProps: { loading: true } }
    );
    act(() => { vi.advanceTimersByTime(150); });
    expect(result.current).toBe(true);
    rerender({ loading: false });
    act(() => { vi.advanceTimersByTime(299); });
    expect(result.current).toBe(true);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(false);
  });

  it('hides immediately once minDuration has already elapsed by the time loading ends', () => {
    const { result, rerender } = renderHook(
      ({ loading }) => useDelayedLoading(loading, 150, 300),
      { initialProps: { loading: true } }
    );
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current).toBe(true);
    rerender({ loading: false });
    act(() => { vi.advanceTimersByTime(0); });
    expect(result.current).toBe(false);
  });
});
