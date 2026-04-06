import { WifiOff } from "lucide-react";

import { useVoiceStore, selectVoiceConnectionState } from "@/stores/voiceStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VoiceConnectionStateProps {
  onRetry?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoiceConnectionState({ onRetry }: VoiceConnectionStateProps) {
  const state = useVoiceStore(selectVoiceConnectionState);

  if (state === "connected") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1">
        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
        <span className="text-[11px] text-emerald-400">연결됨</span>
      </div>
    );
  }

  if (state === "connecting") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1">
        <div className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <span className="text-[11px] text-amber-400">연결 중...</span>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1">
        <WifiOff size={12} className="text-slate-500" />
        <span className="text-[11px] text-slate-500">재연결 중</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="
              text-[11px] text-amber-400 underline
              hover:text-amber-300 transition-colors duration-150 ease-out
            "
          >
            재시도
          </button>
        )}
      </div>
    );
  }

  // disconnected
  return (
    <div className="flex items-center gap-1.5 px-2 py-1">
      <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
      <span className="text-[11px] text-slate-500">연결 안 됨</span>
    </div>
  );
}
