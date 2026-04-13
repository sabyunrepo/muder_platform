import { Modal, Button } from "@/shared/components/ui";
import type { Player } from "@packages/shared/src/game/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ItemUseModalProps {
  isOpen: boolean;
  onClose: () => void;
  effect: string;
  targetType: string;
  players: Player[];
  onSelectTarget: (playerId: string) => void;
  result: { title: string; description: string | null } | null;
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export function ItemUseModal({
  isOpen,
  onClose,
  effect,
  targetType,
  players,
  onSelectTarget,
  result,
}: ItemUseModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="아이템 사용" size="sm">
      {result ? (
        // Step 2: peek 결과 표시
        <div className="space-y-3">
          <p className="text-sm text-amber-400">엿보기 결과</p>
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
            <p className="font-medium text-slate-100">{result.title}</p>
            {result.description && (
              <p className="mt-1 text-sm text-slate-400">{result.description}</p>
            )}
          </div>
          <Button onClick={onClose} className="w-full">
            확인
          </Button>
        </div>
      ) : (
        // Step 1: 대상 플레이어 선택
        <div className="space-y-3">
          {effect && (
            <p className="text-sm text-amber-400">{effect}</p>
          )}
          <p className="text-sm text-slate-300">
            {targetType === "none"
              ? "이 아이템은 대상이 필요하지 않습니다"
              : "대상 플레이어를 선택하세요"}
          </p>
          {targetType !== "none" && players.length > 0 && (
            <div className="space-y-2">
              {players.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectTarget(p.id)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-slate-100 hover:border-amber-500 hover:bg-slate-700 transition-colors"
                >
                  {p.nickname}
                </button>
              ))}
            </div>
          )}
          <Button variant="secondary" onClick={onClose} className="w-full">
            취소
          </Button>
        </div>
      )}
    </Modal>
  );
}
