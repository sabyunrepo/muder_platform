import { describe, expect, it, vi } from 'vitest';
import { SYSTEM_DARK_QUERY } from './appearanceResolver';
import { readSystemPrefersDark, subscribeToSystemAppearance } from './systemAppearance';

describe('systemAppearance', () => {
  it('reads the current system dark preference', () => {
    const matchMedia = vi.fn(() => ({ matches: true }));

    expect(readSystemPrefersDark(matchMedia)).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith(SYSTEM_DARK_QUERY);
  });

  it('subscribes to system color scheme changes', () => {
    const listeners: Array<(event: { matches: boolean }) => void> = [];
    const removeEventListener = vi.fn(
      (_event: 'change', listener: (event: { matches: boolean }) => void) => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      }
    );
    const matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(
        (_event: 'change', listener: (event: { matches: boolean }) => void) => {
          listeners.push(listener);
        }
      ),
      removeEventListener,
    }));
    const listener = vi.fn();

    const unsubscribe = subscribeToSystemAppearance(listener, matchMedia);

    listeners.forEach((candidate) => candidate({ matches: true }));
    listeners.forEach((candidate) => candidate({ matches: false }));
    unsubscribe();

    expect(listener).toHaveBeenNthCalledWith(1, 'dark');
    expect(listener).toHaveBeenNthCalledWith(2, 'light');
    expect(removeEventListener).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(0);
  });
});
