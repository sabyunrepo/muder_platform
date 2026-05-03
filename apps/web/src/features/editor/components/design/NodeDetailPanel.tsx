import { Trash2 } from "lucide-react";
import type { Node, Edge } from "@xyflow/react";
import { PhaseNodePanel } from "./PhaseNodePanel";
import { EndingNodePanel } from "./EndingNodePanel";
import { BranchNodePanel } from "./BranchNodePanel";
import type { FlowNodeData } from "../../flowTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NodeDetailPanelProps {
  node: Node | null;
  themeId: string;
  onUpdate: (id: string, data: Partial<FlowNodeData>) => void;
  onDelete: (id: string) => void;
  edges?: Edge[];
  onEdgeConditionChange?: (edgeId: string, condition: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// NodeDetailPanel — 선택 노드 타입별 편집 패널 라우팅
// ---------------------------------------------------------------------------

export function NodeDetailPanel({
  node,
  themeId,
  onUpdate,
  onDelete,
  edges = [],
  onEdgeConditionChange,
}: NodeDetailPanelProps) {
  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <span className="text-xs text-slate-500">편집할 페이즈나 결말 노드를 선택하세요</span>
      </div>
    );
  }

  const isStart = node.type === "start";

  const handleEdgeConditionChange = (
    edgeId: string,
    condition: Record<string, unknown>,
  ) => {
    onEdgeConditionChange?.(edgeId, condition);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        {isStart ? (
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-xs text-slate-500">
              시작 지점은 고정되어 있어 편집할 수 없습니다
            </span>
          </div>
        ) : node.type === "phase" ? (
          <PhaseNodePanel node={node} themeId={themeId} onUpdate={onUpdate} />
        ) : node.type === "ending" ? (
          <EndingNodePanel node={node} themeId={themeId} onUpdate={onUpdate} />
        ) : node.type === "branch" ? (
          <BranchNodePanel
            node={node}
            themeId={themeId}
            onUpdate={onUpdate}
            edges={edges}
            onEdgeConditionChange={handleEdgeConditionChange}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-xs text-slate-500">
              지원하지 않는 노드 타입입니다
            </span>
          </div>
        )}
      </div>

      {/* Delete button — start 노드 제외 */}
      {!isStart && (
        <div className="border-t border-slate-800 p-3">
          <button
            type="button"
            onClick={() => onDelete(node.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-red-800 bg-red-950/30 px-3 py-1.5 text-xs text-red-400 transition-colors hover:border-red-600 hover:bg-red-900/30"
          >
            <Trash2 className="h-3.5 w-3.5" />
            선택 항목 삭제
          </button>
        </div>
      )}
    </div>
  );
}
