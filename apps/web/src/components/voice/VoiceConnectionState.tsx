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
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--mmp-color-success)]" />
        <span className="text-[11px] text-[var(--mmp-color-success)]">연결됨</span>
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
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--mmp-color-warning)]"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <span className="text-[11px] text-[var(--mmp-color-warning)]">연결 중...</span>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1">
        <WifiOff size={12} className="text-[var(--mmp-color-steel)]" />
        <span className="text-[11px] text-[var(--mmp-color-steel)]">재연결 중</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="
              text-[11px] text-[var(--mmp-color-primary)] underline
              hover:text-[var(--mmp-color-primary-strong)] transition-colors duration-150 ease-out
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
      <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--mmp-color-muted)]" />
      <span className="text-[11px] text-[var(--mmp-color-steel)]">연결 안 됨</span>
    </div>
  );
}
