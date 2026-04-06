import { MicOff } from "lucide-react";

import { useVoiceStore, selectIsMuted } from "@/stores/voiceStore";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Global HUD mute indicator. Shown when microphone is muted.
 * Visible even when the voice panel is collapsed.
 */
export function MuteIndicator() {
  const isMuted = useVoiceStore(selectIsMuted);

  if (!isMuted) return null;

  return (
    <div
      className="
        flex items-center gap-1.5 px-2 py-1 rounded-md
        bg-red-900/70 backdrop-blur-sm
        animate-pulse
        transition-opacity duration-150 ease-out
      "
      style={{ animationDuration: "2s" }}
      role="status"
      aria-label="마이크 음소거 중"
    >
      <MicOff size={14} className="text-red-400" />
      <span className="text-[11px] font-medium text-red-300">음소거</span>
    </div>
  );
}
