import { Suspense, lazy } from "react";
import type { WsEventType } from "@mmp/shared";

import { useGameStore, selectMyRole } from "@/stores/gameStore";
import { useReadingAdvance } from "@/features/audio/hooks/useReadingAdvance";
import { useReadingStore, selectSectionId, selectStatus } from "@/stores/readingStore";

// ---------------------------------------------------------------------------
// Lazy-load ReadingOverlay (UI sub-component)
// ---------------------------------------------------------------------------

const ReadingOverlay = lazy(() =>
  import("@/features/reading/ReadingOverlay").then((m) => ({
    default: m.ReadingOverlay,
  })),
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReadingPanelProps {
  send: (type: WsEventType, payload: unknown) => void;
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

/**
 * ReadingPanel — INTRO 페이즈(및 reading이 활성화된 모든 페이즈)에서 마운트.
 *
 * reading 섹션이 활성화되지 않은 경우 placeholder를 표시하고,
 * 활성화되면 ReadingOverlay(fixed bottom)를 렌더링한다.
 * send prop은 미래 확장을 위해 수신하지만 현재 advance 전송은
 * useReadingAdvance(connectionStore 직접 접근)가 담당한다.
 */
export function ReadingPanel({ send: _send }: ReadingPanelProps) {
  const myRole = useGameStore(selectMyRole);
  const isHost = useGameStore((s) =>
    s.players.some((p) => p.id === s.myPlayerId && p.isHost),
  );
  const onAdvance = useReadingAdvance();

  const sectionId = useReadingStore(selectSectionId);
  const status = useReadingStore(selectStatus);

  const isActive = !!sectionId && status !== "idle" && status !== "completed";

  return (
    <div className="flex h-full flex-col items-center justify-center">
      {!isActive && (
        <div className="max-w-lg text-center">
          <p className="text-lg font-semibold text-slate-200">사건 소개</p>
          <p className="mt-2 text-sm text-slate-400">
            역할과 배경 스토리를 확인하세요
          </p>
        </div>
      )}

      {/* ReadingOverlay: fixed bottom, renders only when sectionId is active */}
      <Suspense fallback={null}>
        <ReadingOverlay
          currentUserRole={myRole ?? null}
          isHost={isHost}
          onAdvance={onAdvance}
        />
      </Suspense>
    </div>
  );
}
