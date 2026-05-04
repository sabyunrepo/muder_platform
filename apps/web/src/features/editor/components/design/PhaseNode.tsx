import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Layers } from "lucide-react";
import type { FlowNodeData } from "../../flowTypes";
import { getPhaseTypeLabel } from "../../entities/phase/phaseEntityAdapter";

// ---------------------------------------------------------------------------
// PhaseNode — Phase 커스텀 노드 (입력/출력 핸들, 선택 하이라이트)
// ---------------------------------------------------------------------------

export function PhaseNode({
  data,
  selected,
}: NodeProps & { data: FlowNodeData }) {
  const phaseLabel = data.phase_type ? getPhaseTypeLabel(data.phase_type) : null;

  return (
    <div
      className={`min-w-[140px] rounded-lg border bg-slate-800 p-3 shadow-md ${
        selected
          ? "border-amber-500 ring-1 ring-amber-500/30"
          : "border-slate-700"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-500" />

      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 shrink-0 text-amber-400" />
        <span className="text-xs font-medium text-slate-200">
          {data.label ?? "새 페이즈"}
        </span>
      </div>

      {(phaseLabel ?? data.duration != null) && (
        <div className="mt-1 flex items-center gap-2">
          {phaseLabel && (
            <span className="text-[10px] text-slate-500">{phaseLabel}</span>
          )}
          {data.duration != null && (
            <span className="text-[10px] text-slate-500">
              {data.duration}분
            </span>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-500"
      />
    </div>
  );
}
