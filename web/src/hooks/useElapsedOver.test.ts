import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useElapsedOver } from './useElapsedOver';

describe('useElapsedOver', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('stays false while never active', () => {
    const { result } = renderHook(() => useElapsedOver(false, 2500));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current).toBe(false);
  });

  it('flips true only once active continuously for longer than the threshold', () => {
    const { result } = renderHook(() => useElapsedOver(true, 2500));
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(2499); });
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(true);
  });

  it('resets to false as soon as it becomes inactive', () => {
    const { result, rerender } = renderHook(
      ({ active }) => useElapsedOver(active, 2500),
      { initialProps: { active: true } }
    );
    act(() => { vi.advanceTimersByTime(2500); });
    expect(result.current).toBe(true);
    rerender({ active: false });
    expect(result.current).toBe(false);
  });

  it('re-times from zero on reactivation rather than resuming a stale clock', () => {
    const { result, rerender } = renderHook(
      ({ active }) => useElapsedOver(active, 2500),
      { initialProps: { active: true } }
    );
    act(() => { vi.advanceTimersByTime(2000); });
    rerender({ active: false });
    rerender({ active: true });
    act(() => { vi.advanceTimersByTime(2499); });
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(true);
  });
});
