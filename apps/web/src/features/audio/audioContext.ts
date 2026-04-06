// ---------------------------------------------------------------------------
// Module-level lazy AudioContext (1 per tab)
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function unlockAudioContext(): void {
  const c = getAudioContext();
  if (c.state === "suspended") void c.resume();
}

// iOS/Safari: AudioContext must be resumed from a user gesture.
// Do NOT use { once: true } — iOS may re-suspend after tab background/foreground.
if (typeof document !== "undefined") {
  const unlock = () => unlockAudioContext();
  document.addEventListener("click", unlock);
  document.addEventListener("touchstart", unlock);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") unlock();
  });
}
