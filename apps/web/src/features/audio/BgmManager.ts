import type { AudioGraph } from "./audioGraph";

// ---------------------------------------------------------------------------
// BgmManager — dual-slot crossfading BGM player
//
//  slotA: HTMLAudioElement → MediaElementSource → GainNode A ─┐
//                                                              ├─→ graph.bgm
//  slotB: HTMLAudioElement → MediaElementSource → GainNode B ─┘
//
// Handles only FILE-type tracks (presigned URL or direct URL). YouTube tracks
// are routed through YouTubePlayer separately.
// ---------------------------------------------------------------------------

export interface BgmTrack {
  id: string;
  url: string;
}

export interface BgmManagerOptions {
  graph: AudioGraph;
  crossfadeDurationMs?: number;
}

export interface BgmManager {
  play(track: BgmTrack): Promise<void>;
  stop(fadeMs?: number): Promise<void>;
  pause(): void;
  resume(): void;
  dispose(): void;
  getCurrentTrackId(): string | null;
}

interface Slot {
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  trackId: string | null;
}

const DEFAULT_CROSSFADE_MS = 2000;

export function createBgmManager(opts: BgmManagerOptions): BgmManager {
  const { graph } = opts;
  const crossfadeDurationMs = opts.crossfadeDurationMs ?? DEFAULT_CROSSFADE_MS;
  const ctx = graph.ctx;
  const bgmChannel = graph.getGainNode("bgm");

  function createSlot(): Slot {
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(bgmChannel);
    return { audio, source, gain, trackId: null };
  }

  const slots: [Slot, Slot] = [createSlot(), createSlot()];
  let activeIdx: 0 | 1 = 0; // currently audible slot
  let currentTrackId: string | null = null;
  let pendingFadeEnd: number | null = null; // ctx time when current fade completes
  let disposed = false;

  function inactive(): Slot {
    return slots[activeIdx === 0 ? 1 : 0];
  }
  function active(): Slot {
    return slots[activeIdx];
  }

  // Force any in-progress crossfade to its end state.
  function settleInFlightFade(): void {
    if (pendingFadeEnd === null) return;
    // Active slot was fading from 1 → 0; force to 0 and stop.
    const a = active();
    a.gain.gain.cancelScheduledValues(ctx.currentTime);
    a.gain.gain.setValueAtTime(0, ctx.currentTime);
    try {
      a.audio.pause();
    } catch {
      // ignore
    }
    a.audio.src = "";
    a.trackId = null;

    // Inactive slot was fading from 0 → 1; force to 1.
    const i = inactive();
    i.gain.gain.cancelScheduledValues(ctx.currentTime);
    i.gain.gain.setValueAtTime(1, ctx.currentTime);

    // Swap: the inactive slot becomes the new active slot.
    activeIdx = activeIdx === 0 ? 1 : 0;
    pendingFadeEnd = null;
  }

  async function play(track: BgmTrack): Promise<void> {
    if (disposed) return;

    // Same-track no-op
    if (currentTrackId === track.id) return;

    // If a crossfade is mid-flight, finish it instantly so we can start a fresh one.
    if (pendingFadeEnd !== null) {
      settleInFlightFade();
    }

    // Resume suspended context (iOS Safari etc.)
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const fadeSec = crossfadeDurationMs / 1000;
    const now = ctx.currentTime;

    // If nothing is currently playing, simple fade-in on inactive slot.
    const hasActiveTrack = currentTrackId !== null;
    const target = inactive();
    target.audio.src = track.url;
    target.audio.currentTime = 0;
    target.trackId = track.id;

    // Schedule gain ramp on inactive: 0 → 1
    target.gain.gain.cancelScheduledValues(now);
    target.gain.gain.setValueAtTime(0, now);
    target.gain.gain.linearRampToValueAtTime(1, now + fadeSec);

    // Schedule gain ramp on active: 1 → 0 (only if there's a current track)
    if (hasActiveTrack) {
      const cur = active();
      cur.gain.gain.cancelScheduledValues(now);
      // Use current value as start (in case it wasn't at exactly 1)
      cur.gain.gain.setValueAtTime(cur.gain.gain.value, now);
      cur.gain.gain.linearRampToValueAtTime(0, now + fadeSec);
    }

    pendingFadeEnd = now + fadeSec;
    currentTrackId = track.id;

    try {
      await target.audio.play();
    } catch (err) {
      if (import.meta.env?.DEV) {
        console.warn(`[BgmManager] Failed to play "${track.id}":`, err);
      }
    }

    // Schedule cleanup of the previously-active slot once fade completes.
    const fadeEndAt = pendingFadeEnd;
    setTimeout(() => {
      // If a newer play() preempted us, this stale timer is irrelevant.
      if (disposed) return;
      if (pendingFadeEnd !== fadeEndAt) return;

      const old = active();
      try {
        old.audio.pause();
      } catch {
        // ignore
      }
      old.audio.src = "";
      old.trackId = null;
      old.gain.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.gain.setValueAtTime(0, ctx.currentTime);

      // Swap active/inactive
      activeIdx = activeIdx === 0 ? 1 : 0;
      pendingFadeEnd = null;
    }, crossfadeDurationMs);
  }

  async function stop(fadeMs?: number): Promise<void> {
    if (disposed) return;
    if (currentTrackId === null && pendingFadeEnd === null) return;

    if (pendingFadeEnd !== null) {
      settleInFlightFade();
    }

    const fade = fadeMs ?? crossfadeDurationMs;
    const fadeSec = fade / 1000;
    const now = ctx.currentTime;
    const cur = active();

    cur.gain.gain.cancelScheduledValues(now);
    cur.gain.gain.setValueAtTime(cur.gain.gain.value, now);
    cur.gain.gain.linearRampToValueAtTime(0, now + fadeSec);

    currentTrackId = null;

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        try {
          cur.audio.pause();
        } catch {
          // ignore
        }
        cur.audio.src = "";
        cur.trackId = null;
        resolve();
      }, fade);
    });
  }

  function pause(): void {
    if (disposed) return;
    for (const slot of slots) {
      if (slot.trackId !== null) {
        try {
          slot.audio.pause();
        } catch {
          // ignore
        }
      }
    }
  }

  function resume(): void {
    if (disposed) return;
    for (const slot of slots) {
      if (slot.trackId !== null) {
        void slot.audio.play().catch(() => {
          // ignore
        });
      }
    }
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    for (const slot of slots) {
      try {
        slot.audio.pause();
      } catch {
        // ignore
      }
      slot.audio.src = "";
      slot.trackId = null;
      try {
        slot.source.disconnect();
      } catch {
        // ignore
      }
      try {
        slot.gain.disconnect();
      } catch {
        // ignore
      }
    }
    currentTrackId = null;
    pendingFadeEnd = null;
  }

  function getCurrentTrackId(): string | null {
    return currentTrackId;
  }

  return { play, stop, pause, resume, dispose, getCurrentTrackId };
}
