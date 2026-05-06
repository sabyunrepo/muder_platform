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
    return this.options.enabled && this.attempt < this.options.maxAttempts;
  }

  /**
   * Permanently disable further reconnects. Used when the server
   * signals a terminal auth failure (`auth.revoked`,
   * `auth.invalid_session{resumable=false}`) — retrying would just earn
   * another close.
   */
  disable(): void {
    this.cancel();
    this.options.enabled = false;
  }

  get currentAttempt(): number {
    return this.attempt;
  }

  /** Schedule next reconnect. Returns the delay used (ms). */
  schedule(callback: () => void): number {
    this.cancel();
    if (!this.options.enabled) {
      return 0;
    }
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
