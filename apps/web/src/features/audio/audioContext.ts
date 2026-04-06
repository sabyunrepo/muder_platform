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
if (typeof document !== "undefined") {
  const unlock = () => {
    unlockAudioContext();
  };
  document.addEventListener("click", unlock, { once: true });
  document.addEventListener("touchstart", unlock, { once: true });
}
