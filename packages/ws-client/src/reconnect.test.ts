import { afterEach, describe, expect, it, vi } from "vitest";
import { ReconnectManager } from "./reconnect.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("ReconnectManager.disable", () => {
  it("flips both isEnabled and canRetry to false", () => {
    const m = new ReconnectManager({ enabled: true, maxAttempts: 5 });
    expect(m.isEnabled).toBe(true);
    expect(m.canRetry).toBe(true);

    m.disable();

    expect(m.isEnabled).toBe(false);
    expect(m.canRetry).toBe(false);
  });

  it("survives a follow-up cancel without throwing", () => {
    const m = new ReconnectManager();
    m.disable();
    expect(() => m.cancel()).not.toThrow();
    expect(m.canRetry).toBe(false);
  });

  it("prevents a pending reconnect callback from firing", () => {
    vi.useFakeTimers();
    const m = new ReconnectManager({ enabled: true, baseDelay: 1000 });
    const callback = vi.fn();

    m.schedule(callback);
    m.disable();
    vi.runAllTimers();

    expect(callback).not.toHaveBeenCalled();
    expect(m.canRetry).toBe(false);
  });
});

describe("ReconnectManager.canRetry", () => {
  it("respects the enabled flag even before any attempts have happened", () => {
    const disabled = new ReconnectManager({ enabled: false, maxAttempts: 5 });
    expect(disabled.canRetry).toBe(false);
  });
});

describe("ReconnectManager.schedule", () => {
  it("does not schedule callbacks when reconnect is disabled", () => {
    vi.useFakeTimers();
    const m = new ReconnectManager({ enabled: false, baseDelay: 1000 });
    const callback = vi.fn();

    const delay = m.schedule(callback);
    vi.runAllTimers();

    expect(delay).toBe(0);
    expect(callback).not.toHaveBeenCalled();
    expect(m.currentAttempt).toBe(0);
  });
});
