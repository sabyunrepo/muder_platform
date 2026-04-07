// ---------------------------------------------------------------------------
// 4-channel Web Audio graph
//
//   AudioContext.destination
//        ^
//     masterGain (1.0)
//        ^
//   +----+------+------+
//   bgm   voice   sfx
//
// Each Manager (BgmManager / VoiceManager / AudioManager) creates source nodes
// and connects them to the appropriate channel gain via getGainNode(channel).
// Volume control flows through setChannelVolume(channel, volume).
// ---------------------------------------------------------------------------

export type AudioChannel = "master" | "bgm" | "voice" | "sfx";

export interface AudioGraph {
  readonly ctx: AudioContext;
  readonly masterGain: GainNode;
  getGainNode(channel: AudioChannel): GainNode;
  setChannelVolume(channel: AudioChannel, volume: number): void;
  dispose(): void;
}

const DEFAULT_VOLUMES: Record<Exclude<AudioChannel, "master">, number> = {
  bgm: 0.6,
  voice: 1.0,
  sfx: 0.7,
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function createAudioGraph(ctx: AudioContext): AudioGraph {
  const masterGain = ctx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(ctx.destination);

  const channelGains: Record<Exclude<AudioChannel, "master">, GainNode> = {
    bgm: ctx.createGain(),
    voice: ctx.createGain(),
    sfx: ctx.createGain(),
  };

  for (const channel of ["bgm", "voice", "sfx"] as const) {
    channelGains[channel].gain.value = DEFAULT_VOLUMES[channel];
    channelGains[channel].connect(masterGain);
  }

  return {
    ctx,
    masterGain,
    getGainNode(channel) {
      if (channel === "master") return masterGain;
      return channelGains[channel];
    },
    setChannelVolume(channel, volume) {
      const clamped = clamp01(volume);
      if (channel === "master") {
        masterGain.gain.value = clamped;
      } else {
        channelGains[channel].gain.value = clamped;
      }
    },
    dispose() {
      masterGain.disconnect();
      for (const channel of ["bgm", "voice", "sfx"] as const) {
        channelGains[channel].disconnect();
      }
    },
  };
}
