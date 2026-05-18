import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Layers } from "lucide-react";
import type { FlowNodeData } from "../../flowTypes";
import { getPhaseTypeLabel } from "../../entities/phase/phaseEntityAdapter";
import { editorDesignClassNames } from "@/features/editor/design-system/editorDesignTokens";

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
      className={`min-w-[140px] p-3 shadow-md ${
        selected
          ? editorDesignClassNames.listItemActive
          : editorDesignClassNames.listItem
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-4 !w-4 !border-2 !border-[var(--mmp-editor-color-canvas)] !bg-[var(--mmp-editor-color-slate)]"
      />

      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 shrink-0 text-[var(--mmp-editor-color-primary)]" />
        <span className="text-xs font-medium text-[var(--mmp-editor-color-charcoal)]">
          {data.label ?? "새 장면"}
        </span>
      </div>

      {(phaseLabel ?? data.duration != null) && (
        <div className="mt-1 flex items-center gap-2">
          {phaseLabel && (
            <span className="text-[10px] text-[var(--mmp-editor-color-slate)]">{phaseLabel}</span>
          )}
          {data.duration != null && (
            <span className="text-[10px] text-[var(--mmp-editor-color-slate)]">
              {data.duration}분
            </span>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-4 !w-4 !border-2 !border-[var(--mmp-editor-color-canvas)] !bg-[var(--mmp-editor-color-slate)]"
      />
    </div>
  );
}
