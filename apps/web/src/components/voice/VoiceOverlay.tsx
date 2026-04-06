import { ChevronLeft, ChevronRight, Lock, Mic, MicOff, Volume2, VolumeX } from "lucide-react";

import {
  useVoiceStore,
  selectIsMuted,
  selectIsPanelOpen,
  selectIsSpeakerMuted,
  selectCurrentChannel,
} from "@/stores/voiceStore";
import { VoiceConnectionState } from "./VoiceConnectionState";
import { ParticipantRow } from "./ParticipantRow";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoiceChannel {
  id: string;
  name: string;
  type: "main" | "whisper";
  participants: VoiceOverlayParticipant[];
}

export interface VoiceOverlayParticipant {
  identity: string;
  name: string;
  avatarUrl?: string;
  isSelf: boolean;
  isMuted: boolean;
}

interface VoiceOverlayProps {
  channels: VoiceChannel[];
  volumes: Map<string, number>;
  speaking: Set<string>;
  onChannelSelect?: (channel: VoiceChannel) => void;
  onRetry?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoiceOverlay({
  channels,
  volumes,
  speaking,
  onChannelSelect,
  onRetry,
}: VoiceOverlayProps) {
  const isPanelOpen = useVoiceStore(selectIsPanelOpen);
  const isMuted = useVoiceStore(selectIsMuted);
  const isSpeakerMuted = useVoiceStore(selectIsSpeakerMuted);
  const currentChannel = useVoiceStore(selectCurrentChannel);
  const togglePanel = useVoiceStore((s) => s.togglePanel);
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const toggleSpeakerMute = useVoiceStore((s) => s.toggleSpeakerMute);

  return (
    <div
      className="
        fixed left-0 top-0 h-full z-40 flex
        transition-all duration-150 ease-out
      "
    >
      {/* Panel body */}
      <div
        className="
          flex flex-col h-full
          bg-slate-900/60 backdrop-blur-[12px]
          border-r border-slate-700/40
          overflow-hidden
          transition-all duration-150 ease-out
        "
        style={{ width: isPanelOpen ? 180 : 0, minWidth: isPanelOpen ? 180 : 0 }}
      >
        {isPanelOpen && (
          <>
            {/* Header */}
            <div className="px-3 pt-3 pb-2 flex items-center justify-between shrink-0">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                음성 채팅
              </span>
              <VoiceConnectionState onRetry={onRetry} />
            </div>

            {/* Controls */}
            <div className="px-3 pb-2 flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleMute}
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center
                  transition-colors duration-150 ease-out
                  ${isMuted ? "bg-red-500/30 text-red-400 hover:bg-red-500/50" : "bg-slate-700/60 text-slate-300 hover:bg-slate-700"}
                `}
                aria-label={isMuted ? "마이크 켜기" : "마이크 끄기"}
              >
                {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
              </button>
              <button
                type="button"
                onClick={toggleSpeakerMute}
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center
                  transition-colors duration-150 ease-out
                  ${isSpeakerMuted ? "bg-red-500/30 text-red-400 hover:bg-red-500/50" : "bg-slate-700/60 text-slate-300 hover:bg-slate-700"}
                `}
                aria-label={isSpeakerMuted ? "스피커 켜기" : "스피커 끄기"}
              >
                {isSpeakerMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
            </div>

            {/* Channel list */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-4 space-y-3 scrollbar-thin">
              {channels.map((ch) => {
                const isActive = ch.id === currentChannel;
                const isWhisper = ch.type === "whisper";

                return (
                  <div key={ch.id}>
                    {/* Channel header */}
                    <button
                      type="button"
                      onClick={() => onChannelSelect?.(ch)}
                      className={`
                        flex items-center gap-1.5 w-full px-2 py-1 rounded-md text-left
                        transition-colors duration-150 ease-out
                        ${isActive ? "border-l-2 border-amber-500 text-amber-400" : "border-l-2 border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-800/40"}
                      `}
                    >
                      {isWhisper && (
                        <Lock size={10} className="shrink-0" />
                      )}
                      <span className="text-[11px] font-medium truncate flex-1">
                        {ch.name}
                      </span>
                      {isWhisper && (
                        <ChevronRight size={10} className="shrink-0 text-slate-500" />
                      )}
                    </button>

                    {/* Participants */}
                    <div className="mt-1 space-y-0.5">
                      {ch.participants.map((p) => (
                        <ParticipantRow
                          key={p.identity}
                          identity={p.identity}
                          name={p.name}
                          avatarUrl={p.avatarUrl}
                          volume={volumes.get(p.identity) ?? 0}
                          isSelf={p.isSelf}
                          isMuted={p.isMuted}
                          isSpeaking={speaking.has(p.identity)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Toggle tab */}
      <button
        type="button"
        onClick={togglePanel}
        className="
          self-center w-5 h-10 flex items-center justify-center
          bg-slate-900/60 backdrop-blur-[12px]
          border border-l-0 border-slate-700/40
          rounded-r-md
          text-slate-400 hover:text-slate-200
          transition-colors duration-150 ease-out
        "
        aria-label={isPanelOpen ? "패널 닫기" : "패널 열기"}
      >
        {isPanelOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>
    </div>
  );
}
