import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Flag } from "lucide-react";
import type { FlowNodeData } from "../../flowTypes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function multiplierColor(multiplier: number): string {
  if (multiplier > 1) return "text-emerald-400 bg-emerald-950/50";
  if (multiplier < 1) return "text-red-400 bg-red-950/50";
  return "text-slate-400 bg-slate-800";
}

function wrapperClasses(selected: boolean): string {
  const base =
    "rounded-xl border-2 bg-slate-800 p-3 min-w-[130px] shadow-md";
  const sel = "border-amber-500 ring-1 ring-amber-500/30";
  const def = "border-rose-700/60";
  return `${base} ${selected ? sel : def}`;
}

// ---------------------------------------------------------------------------
// EndingNode — 흐름 종착점. 입력 핸들만 있음.
// ---------------------------------------------------------------------------

export function EndingNode({ data, selected }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const multiplier = nodeData.score_multiplier;

  return (
    <div className={wrapperClasses(selected ?? false)}>
      <Handle type="target" position={Position.Top} className="!bg-rose-400" />

      <div className="flex items-center gap-2">
        <Flag className="h-4 w-4 shrink-0 text-rose-400" />
        <span className="text-xs font-medium text-slate-200">
          {nodeData.label ?? "새 엔딩"}
        </span>
      </div>

      {nodeData.description && (
        <p className="mt-1 text-[10px] text-slate-500 line-clamp-2">
          {nodeData.description}
        </p>
      )}

      {multiplier != null && (
        <span
          className={`mt-1 inline-block rounded px-1 py-0.5 text-[10px] ${multiplierColor(multiplier)}`}
        >
          x{multiplier}
        </span>
      )}
    </div>
  );
}
