import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";

import {
  useVoiceStore,
  selectIsMuted,
  selectIsSpeakerMuted,
} from "@/stores/voiceStore";
import { colorForIdentity } from "@/utils/voiceColors";
import type { VoiceOverlayParticipant } from "./VoiceOverlay";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VoiceBarProps {
  participants: VoiceOverlayParticipant[];
  speaking: Set<string>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 4;

export function VoiceBar({ participants, speaking }: VoiceBarProps) {
  const isMuted = useVoiceStore(selectIsMuted);
  const isSpeakerMuted = useVoiceStore(selectIsSpeakerMuted);
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const toggleSpeakerMute = useVoiceStore((s) => s.toggleSpeakerMute);
  const toggleBottomSheet = useVoiceStore((s) => s.toggleBottomSheet);

  // Speaking participants first
  const sorted = [...participants].sort((a, b) => {
    const aSpeak = speaking.has(a.identity) ? 1 : 0;
    const bSpeak = speaking.has(b.identity) ? 1 : 0;
    return bSpeak - aSpeak;
  });

  const visible = sorted.slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, sorted.length - MAX_VISIBLE);

  return (
    <div
      className="
        fixed bottom-0 left-0 right-0 z-40
        flex items-center gap-2 px-4 py-2
        bg-slate-950/80 backdrop-blur-[12px]
        border-t border-slate-800/60
      "
    >
      {/* Handlebar — swipe area */}
      <button
        type="button"
        onClick={toggleBottomSheet}
        className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors duration-150 ease-out"
        aria-label="음성 채팅 패널 열기"
      />

      {/* Participant names */}
      <div className="flex items-center gap-2 flex-1 overflow-hidden mt-1">
        {visible.map((p) => {
          const isSpeaking = speaking.has(p.identity);
          const color = colorForIdentity(p.identity);

          return (
            <div key={p.identity} className="flex items-center gap-1 shrink-0">
              {/* Color dot 8px */}
              <span
                className="w-2 h-2 rounded-full shrink-0 transition-opacity duration-150 ease-out"
                style={{ backgroundColor: color }}
              />
              {/* Name 9px, speaking glow */}
              <span
                className="font-medium transition-all duration-150 ease-out"
                style={{
                  fontSize: 9,
                  color: isSpeaking ? "#34d399" : "#94a3b8",
                  textShadow: isSpeaking ? "0 0 6px #34d399" : "none",
                }}
              >
                {p.name}
              </span>
            </div>
          );
        })}

        {overflow > 0 && (
          <span className="text-slate-500" style={{ fontSize: 9 }}>
            +{overflow}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 shrink-0 mt-1">
        <button
          type="button"
          onClick={toggleMute}
          className={`
            flex items-center justify-center rounded-full
            transition-colors duration-150 ease-out
            ${isMuted ? "bg-red-500/30 text-red-400" : "bg-slate-700/60 text-slate-300"}
          `}
          style={{ width: 44, height: 44, padding: 12 }}
          aria-label={isMuted ? "마이크 켜기" : "마이크 끄기"}
        >
          {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
        <button
          type="button"
          onClick={toggleSpeakerMute}
          className={`
            flex items-center justify-center rounded-full
            transition-colors duration-150 ease-out
            ${isSpeakerMuted ? "bg-red-500/30 text-red-400" : "bg-slate-700/60 text-slate-300"}
          `}
          style={{ width: 44, height: 44, padding: 12 }}
          aria-label={isSpeakerMuted ? "스피커 켜기" : "스피커 끄기"}
        >
          {isSpeakerMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>
    </div>
  );
}
