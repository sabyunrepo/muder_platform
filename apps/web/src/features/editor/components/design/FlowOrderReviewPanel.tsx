import { useState, useMemo } from "react";
import { Play, SkipBack, SkipForward, RotateCcw, X, AlertTriangle } from "lucide-react";
import type { Node, Edge } from "@xyflow/react";
import type { FlowNodeData } from "../../flowTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlowOrderReviewPanelProps {
  nodes: Node[];
  edges: Edge[];
  onHighlight: (nodeId: string | null) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Topological order review (Start -> ... -> Ending)
// ---------------------------------------------------------------------------

function topoSort(nodes: Node[], edges: Edge[]): { sorted: Node[]; hasCycle: boolean } {
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  for (const n of nodes) {
    adj.set(n.id, []);
    inDeg.set(n.id, 0);
  }
  for (const e of edges) {
    adj.get(e.source)?.push(e.target);
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
  }
  const queue = nodes.filter((n) => (inDeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  const sorted: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);
    for (const next of adj.get(id) ?? []) {
      const deg = (inDeg.get(next) ?? 1) - 1;
      inDeg.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }
  const idOrder = new Map(sorted.map((id, i) => [id, i]));
  const hasCycle = sorted.length < nodes.length;
  const result = [...nodes].sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
  return { sorted: result, hasCycle };
}

// ---------------------------------------------------------------------------
// FlowOrderReviewPanel
// ---------------------------------------------------------------------------

export function FlowOrderReviewPanel({
  nodes,
  edges,
  onHighlight,
  onClose,
}: FlowOrderReviewPanelProps) {
  const { sorted, hasCycle } = useMemo(() => topoSort(nodes, edges), [nodes, edges]);
  const phases = useMemo(
    () => sorted.filter((n) => n.type === "phase"),
    [sorted],
  );
  const [currentIdx, setCurrentIdx] = useState(0);

  const currentPhase = phases[currentIdx];
  const totalMinutes = phases.reduce(
    (sum, n) => sum + ((n.data as FlowNodeData).duration ?? 0),
    0,
  );

  const goTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, phases.length - 1));
    setCurrentIdx(clamped);
    onHighlight(phases[clamped]?.id ?? null);
  };

  const handleClose = () => {
    onHighlight(null);
    onClose();
  };

  if (phases.length === 0) {
    return (
      <div className="flex items-center justify-between rounded border border-slate-700 bg-slate-900 px-4 py-3">
        <span className="text-xs text-slate-500">페이즈 노드가 없습니다</span>
        <button type="button" onClick={handleClose} aria-label="닫기" className="text-slate-500 hover:text-slate-300">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const progress = ((currentIdx + 1) / phases.length) * 100;
  const phaseData = currentPhase?.data as FlowNodeData | undefined;
  const phaseDuration = phaseData?.duration ?? 0;
  const phaseLabel = phaseData?.label ?? "?";

  return (
    <div className="flex flex-col gap-3 rounded border border-slate-700 bg-slate-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Play className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-medium text-slate-300">흐름 순서 점검</span>
        </div>
        <button type="button" onClick={handleClose} aria-label="닫기" className="text-slate-500 hover:text-slate-300">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="text-[10px] leading-4 text-slate-500">
        저장된 노드 연결 순서만 훑어봅니다. 조건과 트리거의 실제 통과 여부는 게임 중 서버가 판정합니다.
      </p>

      {/* Cycle warning */}
      {hasCycle && (
        <div className="flex items-center gap-1.5 rounded bg-amber-950/30 px-2 py-1.5 text-[10px] text-amber-400">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          순환 참조가 감지되었습니다 — 일부 노드가 생략됩니다
        </div>
      )}

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-amber-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Current phase info */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-200">{phaseLabel}</span>
          <span className="text-[10px] text-slate-500">
            {currentIdx + 1} / {phases.length} 페이즈
            {phaseDuration > 0 && ` — ${phaseDuration}분`}
          </span>
        </div>
        <span className="text-[10px] text-slate-600">
          총 {totalMinutes}분
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => goTo(0)}
          disabled={currentIdx === 0}
          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
          title="처음으로"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => goTo(currentIdx - 1)}
          disabled={currentIdx === 0}
          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
          title="이전"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => goTo(currentIdx + 1)}
          disabled={currentIdx >= phases.length - 1}
          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
          title="다음"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
