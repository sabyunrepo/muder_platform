import { useState } from "react";
import { Eye, Search } from "lucide-react";
import { WsEventType } from "@mmp/shared";

import { Card, EmptyState } from "@/shared/components/ui";
import { useModuleStore } from "@/stores/moduleStoreFactory";
import { ClueCard } from "./ClueCard";
import { ClueShareButton } from "./ClueShareButton";
import type { ViewClue } from "./ClueCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClueViewPanelProps {
  send: (type: WsEventType, payload: unknown) => void;
  moduleId: string;
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export function ClueViewPanel({ send, moduleId }: ClueViewPanelProps) {
  const moduleData = useModuleStore(moduleId, (s) => s.data);
  const clues = (moduleData.clues as ViewClue[] | undefined) ?? [];

  const [selectedClue, setSelectedClue] = useState<ViewClue | null>(null);
  const [sharingIds, setSharingIds] = useState<Set<string>>(new Set());

  const handleShare = (clueId: string) => {
    setSharingIds((prev) => new Set(prev).add(clueId));
    send(WsEventType.GAME_ACTION, { type: "clue:share", clueId });
  };

  if (clues.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Search className="h-10 w-10" />}
          title="획득한 단서가 없습니다"
          description="장소를 탐색하여 단서를 발견하세요"
        />
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <Eye className="h-5 w-5 text-amber-400" />
        <h3 className="text-lg font-semibold text-slate-100">단서 열람</h3>
        <span className="ml-auto text-sm text-slate-400">{clues.length}개</span>
      </div>

      {/* 단서 목록 */}
      <div className="space-y-2">
        {clues.map((clue) => (
          <div key={clue.id} className="space-y-1">
            <ClueCard clue={clue} onClick={setSelectedClue} />
            <div className="flex justify-end px-1">
              <ClueShareButton
                clueId={clue.id}
                isShared={clue.isShared === true || sharingIds.has(clue.id)}
                onShare={handleShare}
              />
            </div>
          </div>
        ))}
      </div>

      {/* 단서 상세 인라인 표시 */}
      {selectedClue && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-200">{selectedClue.title}</h4>
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              onClick={() => setSelectedClue(null)}
            >
              닫기
            </button>
          </div>
          <p className="text-sm leading-relaxed text-slate-300">{selectedClue.description}</p>
          {selectedClue.imageUrl && (
            <img
              src={selectedClue.imageUrl}
              alt={selectedClue.title}
              className="w-full rounded-md object-cover max-h-48"
            />
          )}
        </div>
      )}
    </Card>
  );
}
