import { getAudioContext } from "./audioContext";
import { resolveSoundUrl } from "./soundRegistry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActiveEntry {
  source: AudioBufferSourceNode;
  gain: GainNode;
  startedAt: number;
}

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
const GLOBAL_RATE_LIMIT_MS = 50;
const MAX_CACHE_SIZE = 20;
const MAX_SOUND_BYTES = 512 * 1024; // 512 KB

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAudioManager(): AudioManager {
  const ctx = getAudioContext();

  // Master gain node — all sounds route through this for live volume control
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);

  const bufferCache = new Map<string, AudioBuffer>();
  const activeSources: ActiveEntry[] = [];
  const lastPlayedAt = new Map<string, number>();
  let lastGlobalPlay = 0;

  let masterVolume = 1;
  let sfxVolume = 1;

  // -- internal helpers -----------------------------------------------------

  function clamp01(v: number): number {
    return Math.min(1, Math.max(0, v));
  }

  async function fetchAndDecode(url: string): Promise<AudioBuffer> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Sound fetch failed: ${res.status} ${url}`);
    }
    const contentLength = res.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_SOUND_BYTES) {
      throw new Error(`Sound file too large: ${contentLength} bytes`);
    }
    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength > MAX_SOUND_BYTES) {
      throw new Error(`Sound file too large: ${arrayBuf.byteLength} bytes`);
    }
    return ctx.decodeAudioData(arrayBuf);
  }

  async function getBuffer(soundId: string): Promise<AudioBuffer | null> {
    const cached = bufferCache.get(soundId);
    if (cached) return cached;

    const url = resolveSoundUrl(soundId);
    if (!url) return null;

    try {
      const buffer = await fetchAndDecode(url);
      // LRU-style eviction: remove oldest entry if cache is full
      if (bufferCache.size >= MAX_CACHE_SIZE) {
        const oldest = bufferCache.keys().next().value;
        if (oldest !== undefined) bufferCache.delete(oldest);
      }
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
    for (let i = activeSources.length - 1; i >= 0; i--) {
      const entry = activeSources[i];
      const elapsed = ctx.currentTime - entry.startedAt;
      const duration = entry.source.buffer?.duration ?? 30;
      if (elapsed > duration + 0.5) {
        entry.source.disconnect();
        entry.gain.disconnect();
        activeSources.splice(i, 1);
      }
    }
  }

  function evictOldest(): void {
    if (activeSources.length >= MAX_CONCURRENT) {
      const oldest = activeSources.shift();
      if (oldest) {
        try {
          oldest.source.stop();
        } catch {
          // already stopped
        }
        oldest.source.disconnect();
        oldest.gain.disconnect();
      }
    }
  }

  // -- public API -----------------------------------------------------------

  function play(soundId: string): void {
    const now = performance.now();

    // Global rate limit
    if (now - lastGlobalPlay < GLOBAL_RATE_LIMIT_MS) return;
    lastGlobalPlay = now;

    // Per-soundId rate limit
    const last = lastPlayedAt.get(soundId);
    if (last !== undefined && now - last < RATE_LIMIT_MS) return;
    lastPlayedAt.set(soundId, now);

    // Resume suspended context (iOS Safari tab foreground)
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    void getBuffer(soundId).then((buffer) => {
      if (!buffer) return;

      pruneActiveSources();
      evictOldest();

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      // Per-sound gain → master gain → destination
      const gain = ctx.createGain();
      gain.gain.value = clamp01(sfxVolume);
      source.connect(gain);
      gain.connect(masterGain);

      const startedAt = ctx.currentTime;
      source.start(0);

      const entry: ActiveEntry = { source, gain, startedAt };
      activeSources.push(entry);

      source.onended = () => {
        source.disconnect();
        gain.disconnect();
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
      // Update master gain node — affects all currently playing sounds
      masterGain.gain.value = clamped;
    } else {
      sfxVolume = clamped;
    }
  }

  function dispose(): void {
    for (const entry of activeSources) {
      try {
        entry.source.stop();
      } catch {
        // already stopped
      }
      entry.source.disconnect();
      entry.gain.disconnect();
    }
    activeSources.length = 0;
    bufferCache.clear();
    lastPlayedAt.clear();
  }

  return { play, preload, setVolume, dispose };
}
