import type { ReconnectOptions } from "./types.js";

const DEFAULTS: Required<ReconnectOptions> = {
  enabled: true,
  maxAttempts: 5,
  baseDelay: 1000,
  maxDelay: 30000,
};

export class ReconnectManager {
  private readonly options: Required<ReconnectOptions>;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: ReconnectOptions) {
    this.options = { ...DEFAULTS, ...options };
  }

  get isEnabled(): boolean {
    return this.options.enabled;
  }

  get canRetry(): boolean {
    return this.attempt < this.options.maxAttempts;
  }

  get currentAttempt(): number {
    return this.attempt;
  }

  /** Schedule next reconnect. Returns the delay used (ms). */
  schedule(callback: () => void): number {
    this.cancel();
    const delay = this.getDelay();
    this.attempt++;
    this.timer = setTimeout(callback, delay);
    return delay;
  }

  /** Cancel pending reconnect. */
  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Reset attempt counter (call on successful connect). */
  reset(): void {
    this.cancel();
    this.attempt = 0;
  }

  /** Exponential backoff with jitter. */
  private getDelay(): number {
    const exponential = this.options.baseDelay * Math.pow(2, this.attempt);
    const capped = Math.min(exponential, this.options.maxDelay);
    // Add 0-25% jitter
    const jitter = capped * Math.random() * 0.25;
    return Math.floor(capped + jitter);
  }
}
