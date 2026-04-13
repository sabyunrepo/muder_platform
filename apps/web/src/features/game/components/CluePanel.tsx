import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Card, Badge, EmptyState } from "@/shared/components/ui";
import { useModuleStore } from "@/stores/moduleStoreFactory";
import { ClueDetail } from "./ClueDetail";
import { ItemUseModal } from "./ItemUseModal";
import type { Clue } from "./ClueDetail";
import type {
  Player,
  ClueItemDeclaredEvent,
  ClueUsePromptEvent,
  ClueUseResultEvent,
  ClueItemResolvedEvent,
} from "@packages/shared/src/game/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClueWithItem extends Clue {
  isUsable?: boolean;
}

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
  const clues = (moduleData.clues as ClueWithItem[] | undefined) ?? [];
  const players = (moduleData.players as Player[] | undefined) ?? [];

  // 단서 상세 모달
  const [selectedClue, setSelectedClue] = useState<ClueWithItem | null>(null);

  // 아이템 사용 모달
  const [itemUseClue, setItemUseClue] = useState<ClueWithItem | null>(null);
  const [usePrompt, setUsePrompt] = useState<{ effect: string; targetType: string } | null>(null);
  const [useResult, setUseResult] = useState<{ title: string; description: string | null } | null>(null);

  // 뮤텍스: 아이템 사용 중 여부
  const moduleItemInUse = moduleData.itemInUse as boolean | undefined;
  const [localItemInUse, setLocalItemInUse] = useState(false);
  const itemInUse = moduleItemInUse ?? localItemInUse;

  // WS 이벤트 → 모듈 데이터 변경으로 감지
  useEffect(() => {
    const declared = moduleData.lastEvent_itemDeclared as ClueItemDeclaredEvent | undefined;
    if (!declared) return;
    toast.info(`${declared.clueName} 아이템을 사용합니다`);
  }, [moduleData.lastEvent_itemDeclared]);

  useEffect(() => {
    const prompt = moduleData.lastEvent_usePrompt as ClueUsePromptEvent | undefined;
    if (!prompt) return;
    setUsePrompt({ effect: prompt.effect, targetType: prompt.targetType });
  }, [moduleData.lastEvent_usePrompt]);

  useEffect(() => {
    const result = moduleData.lastEvent_useResult as ClueUseResultEvent | undefined;
    if (!result) return;
    setUseResult({
      title: result.clueDetail.title,
      description: result.clueDetail.description,
    });
  }, [moduleData.lastEvent_useResult]);

  useEffect(() => {
    const resolved = moduleData.lastEvent_itemResolved as ClueItemResolvedEvent | undefined;
    if (!resolved) return;
    setLocalItemInUse(false);
  }, [moduleData.lastEvent_itemResolved]);

  function handleItemUse(clue: ClueWithItem) {
    setItemUseClue(clue);
    setUsePrompt(null);
    setUseResult(null);
    setLocalItemInUse(true);
    // clue:use { clueId } — WS 전송은 상위 컨텍스트에서 처리
    // 모듈 스토어를 통해 이벤트 발행
    moduleData.onUseItem?.(clue.id);
  }

  function handleSelectTarget(playerId: string) {
    // clue:use_target { targetPlayerId }
    moduleData.onUseTarget?.(playerId);
  }

  function handleItemModalClose() {
    if (!useResult) {
      // 결과 확인 전 닫기 = 취소
      moduleData.onCancelUse?.();
      setLocalItemInUse(false);
    }
    setItemUseClue(null);
    setUsePrompt(null);
    setUseResult(null);
  }

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
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={categoryInfo.variant}>{categoryInfo.label}</Badge>
                  {clue.isUsable && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleItemUse(clue);
                      }}
                      disabled={itemInUse}
                      className="ml-2 shrink-0 rounded-md bg-amber-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      사용
                    </button>
                  )}
                </div>
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

      {/* 아이템 사용 모달 */}
      {itemUseClue && (
        <ItemUseModal
          isOpen={!!itemUseClue}
          onClose={handleItemModalClose}
          effect={usePrompt?.effect ?? ""}
          targetType={usePrompt?.targetType ?? ""}
          players={players}
          onSelectTarget={handleSelectTarget}
          result={useResult}
        />
      )}
    </>
  );
}
