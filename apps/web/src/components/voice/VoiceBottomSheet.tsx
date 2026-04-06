import { ChevronRight, Lock, Mic, MicOff, Volume2, VolumeX } from "lucide-react";

import {
  useVoiceStore,
  selectIsMuted,
  selectIsBottomSheetOpen,
  selectIsSpeakerMuted,
  selectCurrentChannel,
} from "@/stores/voiceStore";
import { ParticipantRow } from "./ParticipantRow";
import type { VoiceChannel } from "./VoiceOverlay";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VoiceBottomSheetProps {
  channels: VoiceChannel[];
  volumes: Map<string, number>;
  speaking: Set<string>;
  onChannelSelect?: (channel: VoiceChannel) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoiceBottomSheet({
  channels,
  volumes,
  speaking,
  onChannelSelect,
}: VoiceBottomSheetProps) {
  const isOpen = useVoiceStore(selectIsBottomSheetOpen);
  const isMuted = useVoiceStore(selectIsMuted);
  const isSpeakerMuted = useVoiceStore(selectIsSpeakerMuted);
  const currentChannel = useVoiceStore(selectCurrentChannel);
  const toggleBottomSheet = useVoiceStore((s) => s.toggleBottomSheet);
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const toggleSpeakerMute = useVoiceStore((s) => s.toggleSpeakerMute);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-150 ease-out"
          onClick={toggleBottomSheet}
          aria-hidden="true"
        />
      )}

      {/* Sheet */}
      <div
        className={`
          fixed bottom-0 left-0 right-0 z-50
          bg-slate-900 rounded-t-2xl
          border-t border-slate-700/60
          transition-transform duration-150 ease-out
          ${isOpen ? "translate-y-0" : "translate-y-full"}
        `}
        style={{ maxHeight: "70vh" }}
        role="dialog"
        aria-label="음성 채팅"
      >
        {/* Handle bar */}
        <button
          type="button"
          onClick={toggleBottomSheet}
          className="w-full flex justify-center pt-3 pb-1"
          aria-label="닫기"
        >
          <span className="w-10 h-1 rounded-full bg-slate-600 hover:bg-slate-500 transition-colors duration-150 ease-out" />
        </button>

        {/* Controls */}
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-[13px] font-semibold text-slate-200">음성 채팅</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className={`
                flex items-center justify-center rounded-full
                transition-colors duration-150 ease-out
                ${isMuted ? "bg-red-500/30 text-red-400" : "bg-slate-700 text-slate-300"}
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
                ${isSpeakerMuted ? "bg-red-500/30 text-red-400" : "bg-slate-700 text-slate-300"}
              `}
              style={{ width: 44, height: 44, padding: 12 }}
              aria-label={isSpeakerMuted ? "스피커 켜기" : "스피커 끄기"}
            >
              {isSpeakerMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
        </div>

        {/* Channel list */}
        <div className="overflow-y-auto px-4 pb-6 space-y-4" style={{ maxHeight: "calc(70vh - 120px)" }}>
          {channels.map((ch) => {
            const isActive = ch.id === currentChannel;
            const isWhisper = ch.type === "whisper";

            return (
              <div key={ch.id}>
                {/* Channel header */}
                <button
                  type="button"
                  onClick={() => {
                    onChannelSelect?.(ch);
                    toggleBottomSheet();
                  }}
                  className={`
                    flex items-center gap-2 w-full py-1.5 text-left
                    transition-colors duration-150 ease-out
                    ${isActive ? "text-amber-400" : "text-slate-400 hover:text-slate-300"}
                  `}
                >
                  {isWhisper && <Lock size={12} className="shrink-0" />}
                  <span className="text-[12px] font-semibold flex-1 truncate">
                    {ch.name}
                  </span>
                  {isWhisper && (
                    <ChevronRight size={14} className="shrink-0 text-slate-500" />
                  )}
                </button>

                {/* Participants — horizontal scroll row */}
                <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
                  {ch.participants.map((p) => (
                    <div key={p.identity} className="flex flex-col items-center gap-1 shrink-0">
                      {/* Avatar 40px */}
                      <div
                        className="relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-[14px] font-bold"
                        style={{
                          border: speaking.has(p.identity)
                            ? "2px solid #34d399"
                            : "2px solid transparent",
                          boxShadow: speaking.has(p.identity)
                            ? "0 0 0 2px #34d39944"
                            : "none",
                          backgroundColor: "#1e293b",
                        }}
                      >
                        {p.avatarUrl ? (
                          <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-slate-300">
                            {p.name[0]?.toUpperCase() ?? "?"}
                          </span>
                        )}

                        {/* Self badge */}
                        {p.isSelf && (
                          <span
                            className="absolute bottom-0 left-0 text-[8px] font-bold px-0.5 rounded-sm leading-none"
                            style={{ backgroundColor: "#f59e0b", color: "#1e293b" }}
                          >
                            나
                          </span>
                        )}

                        {/* Mute indicator */}
                        {p.isMuted && (
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-red-500/80 flex items-center justify-center">
                            <MicOff size={8} className="text-white" />
                          </span>
                        )}
                      </div>

                      {/* Nickname */}
                      <span
                        className="text-[10px] text-center truncate max-w-[44px] transition-colors duration-150 ease-out"
                        style={{
                          color: speaking.has(p.identity) ? "#34d399" : "#94a3b8",
                        }}
                      >
                        {p.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
