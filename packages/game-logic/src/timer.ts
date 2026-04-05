/** Server time offset (local - server) in ms. */
let serverTimeOffset = 0;

/** Sync local clock with server timestamp. Call on each server message. */
export function syncServerTime(serverTs: number): void {
  const localNow = Date.now();
  serverTimeOffset = localNow - serverTs;
}

/** Get estimated current server time. */
export function getServerTime(): number {
  return Date.now() - serverTimeOffset;
}

/** Get remaining time until a deadline (in ms). Returns 0 if expired. */
export function getRemainingTime(deadline: number): number {
  const remaining = deadline - getServerTime();
  return Math.max(0, remaining);
}

/** Format remaining time as "M:SS". */
export function formatRemainingTime(deadline: number): string {
  const ms = getRemainingTime(deadline);
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Get current server time offset for debugging. */
export function getTimeOffset(): number {
  return serverTimeOffset;
}
