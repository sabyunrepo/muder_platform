import { useState } from "react";
import { MicOff } from "lucide-react";

import { colorForIdentity } from "@/utils/voiceColors";
import { VolumeSlider } from "./VolumeSlider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParticipantRowProps {
  identity: string;
  name: string;
  avatarUrl?: string;
  volume: number;
  isSelf: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  onVolumeChange?: (identity: string, volume: number) => void;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ParticipantRow({
  identity,
  name,
  avatarUrl,
  volume,
  isSelf,
  isMuted,
  isSpeaking,
  onVolumeChange,
}: ParticipantRowProps) {
  const [sliderOpen, setSliderOpen] = useState(false);
  const [localVolume, setLocalVolume] = useState(1);

  const accentColor = colorForIdentity(identity);
  const scale = isSpeaking ? Math.min(1.33, 1 + volume * 0.33) : 1;

  const handleVolumeChange = (vol: number) => {
    setLocalVolume(vol);
    onVolumeChange?.(identity, vol);
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setSliderOpen((o) => !o)}
        className={`
          flex items-center gap-2 w-full px-2 py-1 rounded-md text-left
          transition-colors duration-150 ease-out
          hover:bg-slate-800/60
          ${sliderOpen ? "border-l-2 border-amber-500" : "border-l-2 border-transparent"}
        `}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold overflow-hidden transition-transform duration-150 ease-out"
            style={{
              backgroundColor: accentColor + "33",
              border: isSpeaking ? `1.5px solid #34d399` : "1.5px solid transparent",
              transform: `scale(${scale})`,
              boxShadow: isSpeaking ? "0 0 0 1.5px #34d39944" : "none",
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <span style={{ color: accentColor }}>{initials(name)}</span>
            )}
          </div>

          {/* Self badge */}
          {isSelf && (
            <span
              className="absolute -bottom-0.5 -left-0.5 text-[8px] font-bold px-0.5 rounded-sm leading-none"
              style={{ backgroundColor: "#f59e0b", color: "#1e293b" }}
            >
              나
            </span>
          )}

          {/* Mute indicator */}
          {isMuted && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 flex items-center justify-center"
            >
              <MicOff size={7} className="text-white" />
            </span>
          )}
        </div>

        {/* Name */}
        <span
          className="flex-1 text-[12px] truncate transition-colors duration-150 ease-out"
          style={{
            color: isSpeaking ? "#34d399" : "#cbd5e1",
            textShadow: isSpeaking ? "0 0 6px #34d39966" : "none",
          }}
        >
          {name}
        </span>
      </button>

      {/* Volume slider (expanded) */}
      {sliderOpen && (
        <div className="mt-0.5 ml-8">
          <VolumeSlider volume={localVolume} onChange={handleVolumeChange} />
        </div>
      )}
    </div>
  );
}
