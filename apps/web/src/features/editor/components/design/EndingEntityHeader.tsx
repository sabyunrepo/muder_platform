import { Plus } from "lucide-react";

interface EndingEntityHeaderProps {
  onAddEnding: () => void;
}

export function EndingEntityHeader({ onAddEnding }: EndingEntityHeaderProps) {
  return (
    <header className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">결말 entity</p>
        <h2 className="text-xl font-semibold text-slate-100">결말 목록</h2>
        <p className="max-w-3xl text-sm leading-6 text-slate-400">
          Flow의 엔딩 노드를 결말 목록으로 모아 보여줍니다. 게임 종료 시 서버가 투표·질문·조건 결과를 판정하고,
          이곳에서는 플레이어에게 공개될 결말 이름과 본문을 정리합니다.
        </p>
      </div>
      <button
        type="button"
        onClick={onAddEnding}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
      >
        <Plus className="h-4 w-4" />
        결말 추가
      </button>
    </header>
  );
}
