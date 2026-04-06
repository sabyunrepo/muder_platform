import { getAudioContext } from "./audioContext";
import { resolveSoundUrl } from "./soundRegistry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AudioManager {
  play(soundId: string): void;
  preload(soundId: string): Promise<void>;
  setVolume(channel: "master" | "sfx", value: number): void;
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CONCURRENT = 4;
const RATE_LIMIT_MS = 100;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAudioManager(): AudioManager {
  const ctx = getAudioContext();
  const bufferCache = new Map<string, AudioBuffer>();
  const activeSources: { node: AudioBufferSourceNode; startedAt: number }[] = [];
  const lastPlayedAt = new Map<string, number>();

  let masterVolume = 1;
  let sfxVolume = 1;

  // -- internal helpers -----------------------------------------------------

  function clamp01(v: number): number {
    return Math.min(1, Math.max(0, v));
  }

  async function fetchAndDecode(url: string): Promise<AudioBuffer> {
    const res = await fetch(url);
    const arrayBuf = await res.arrayBuffer();
    return ctx.decodeAudioData(arrayBuf);
  }

  async function getBuffer(soundId: string): Promise<AudioBuffer | null> {
    const cached = bufferCache.get(soundId);
    if (cached) return cached;

    const url = resolveSoundUrl(soundId);
    if (!url) return null;

    try {
      const buffer = await fetchAndDecode(url);
      bufferCache.set(soundId, buffer);
      return buffer;
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn(`[AudioManager] Failed to load sound "${soundId}":`, err);
      }
      return null;
    }
  }

  function pruneActiveSources(): void {
    // Remove sources that have finished playing
    for (let i = activeSources.length - 1; i >= 0; i--) {
      const entry = activeSources[i];
      const elapsed = ctx.currentTime - entry.startedAt;
      if (elapsed > 30) {
        // assume done after 30s max
        activeSources.splice(i, 1);
      }
    }
  }

  function evictOldest(): void {
    if (activeSources.length >= MAX_CONCURRENT) {
      const oldest = activeSources.shift();
      if (oldest) {
        try {
          oldest.node.stop();
        } catch {
          // already stopped
        }
      }
    }
  }

  // -- public API -----------------------------------------------------------

  function play(soundId: string): void {
    // Rate limiting: ignore same soundId within RATE_LIMIT_MS
    const now = performance.now();
    const last = lastPlayedAt.get(soundId);
    if (last !== undefined && now - last < RATE_LIMIT_MS) return;
    lastPlayedAt.set(soundId, now);

    void getBuffer(soundId).then((buffer) => {
      if (!buffer) return;

      pruneActiveSources();
      evictOldest();

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.value = clamp01(masterVolume * sfxVolume);

      source.connect(gain);
      gain.connect(ctx.destination);

      const startedAt = ctx.currentTime;
      source.start(0);

      const entry = { node: source, startedAt };
      activeSources.push(entry);

      source.onended = () => {
        const idx = activeSources.indexOf(entry);
        if (idx !== -1) activeSources.splice(idx, 1);
      };
    });
  }

  async function preload(soundId: string): Promise<void> {
    await getBuffer(soundId);
  }

  function setVolume(channel: "master" | "sfx", value: number): void {
    const clamped = clamp01(value);
    if (channel === "master") {
      masterVolume = clamped;
    } else {
      sfxVolume = clamped;
    }
  }

  function dispose(): void {
    for (const entry of activeSources) {
      try {
        entry.node.stop();
      } catch {
        // already stopped
      }
    }
    activeSources.length = 0;
    bufferCache.clear();
    lastPlayedAt.clear();
  }

  return { play, preload, setVolume, dispose };
}
