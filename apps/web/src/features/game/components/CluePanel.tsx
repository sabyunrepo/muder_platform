import { useState } from "react";
import { Search } from "lucide-react";

import { Card, Badge, EmptyState } from "@/shared/components/ui";
import { useModuleStore } from "@/stores/moduleStoreFactory";
import { ClueDetail } from "./ClueDetail";
import type { Clue } from "./ClueDetail";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_MAP = {
  physical: { label: "물증", variant: "info" as const },
  testimony: { label: "증언", variant: "success" as const },
  document: { label: "문서", variant: "warning" as const },
} as const;

type ClueCategory = keyof typeof CATEGORY_MAP;

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export function CluePanel() {
  const moduleData = useModuleStore("clue_interaction", (s) => s.data);
  const clues = (moduleData.clues as Clue[] | undefined) ?? [];

  // 선택된 단서 (상세 모달)
  const [selectedClue, setSelectedClue] = useState<Clue | null>(null);

  if (clues.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Search className="h-10 w-10" />}
          title="아직 단서가 없습니다"
          description="장소를 탐색하여 단서를 발견하세요"
        />
      </Card>
    );
  }

  return (
    <>
      <Card className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-100">단서 목록</h3>

        <div className="space-y-2">
          {clues.map((clue) => {
            const categoryInfo = CATEGORY_MAP[clue.category as ClueCategory] ?? {
              label: clue.category,
              variant: "default" as const,
            };

            return (
              <Card
                key={clue.id}
                hoverable
                onClick={() => setSelectedClue(clue)}
                className="flex items-center justify-between !p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* 새 단서 빨간 점 */}
                  {clue.isNew && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                  )}
                  <span className="truncate text-sm font-medium text-slate-200">
                    {clue.title}
                  </span>
                </div>
                <Badge variant={categoryInfo.variant}>{categoryInfo.label}</Badge>
              </Card>
            );
          })}
        </div>
      </Card>

      {/* 단서 상세 모달 */}
      {selectedClue && (
        <ClueDetail
          clue={selectedClue}
          isOpen={!!selectedClue}
          onClose={() => setSelectedClue(null)}
        />
      )}
    </>
  );
}
