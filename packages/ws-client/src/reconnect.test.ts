import { describe, expect, it } from "vitest";
import { ReconnectManager } from "./reconnect.js";

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
});

describe("ReconnectManager.canRetry", () => {
  it("respects the enabled flag even before any attempts have happened", () => {
    const disabled = new ReconnectManager({ enabled: false, maxAttempts: 5 });
    expect(disabled.canRetry).toBe(false);
  });
});
