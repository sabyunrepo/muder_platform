import { Copy, Trash2 } from "lucide-react";
import type { Node, Edge } from "@xyflow/react";
import { PhaseNodePanel } from "./PhaseNodePanel";
import { NodeConnectionPanel } from "./NodeConnectionPanel";
import type { FlowNodeData } from "../../flowTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NodeDetailPanelProps {
  node: Node | null;
  themeId: string;
  onUpdate: (id: string, data: Partial<FlowNodeData>) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
  nodes?: Node[];
  edges?: Edge[];
  onConnectNodes?: (sourceId: string, targetId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
}

// ---------------------------------------------------------------------------
// NodeDetailPanel — 선택 노드 타입별 편집 패널 라우팅
// ---------------------------------------------------------------------------

export function NodeDetailPanel({
  node,
  themeId,
  onUpdate,
  onDelete,
  onDuplicate,
  nodes = [],
  edges = [],
  onConnectNodes,
  onDeleteEdge,
}: NodeDetailPanelProps) {
  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <span className="text-xs text-slate-500">편집할 장면을 선택하세요</span>
      </div>
    );
  }

  const isStart = node.type === "start";
  const canEditConnections =
    node.type === "start" || node.type === "phase";
  const canUseSceneActions = node.type === "phase";

  return (
    <div className="min-h-full">
      {canUseSceneActions && (
        <div className="sticky top-0 z-10 space-y-2 border-b border-slate-800 bg-slate-900 p-3 shadow-[0_8px_20px_rgba(15,23,42,0.35)]">
          {onDuplicate && (
            <button
              type="button"
              onClick={() => onDuplicate(node.id)}
              className="flex w-full items-center justify-center gap-1.5 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-amber-500/60 hover:text-amber-200"
            >
              <Copy className="h-3.5 w-3.5" />
              장면 복제
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("이 장면을 삭제할까요? 연결된 선도 함께 삭제됩니다.")) return;
              onDelete(node.id);
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-red-800 bg-red-950/30 px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:border-red-600 hover:bg-red-900/30"
          >
            <Trash2 className="h-3.5 w-3.5" />
            장면 삭제
          </button>
        </div>
      )}

      {/* Panel content */}
      <div>
        {isStart ? (
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-xs text-slate-500">
              시작 지점은 고정되어 있어 편집할 수 없습니다
            </span>
          </div>
        ) : node.type === "phase" ? (
          <PhaseNodePanel node={node} themeId={themeId} onUpdate={onUpdate} edges={edges} />
        ) : (
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-xs text-slate-500">
              지원하지 않는 노드 타입입니다
            </span>
          </div>
        )}
      </div>

      {canEditConnections && onConnectNodes && onDeleteEdge && (
        <NodeConnectionPanel
          node={node}
          nodes={nodes}
          edges={edges}
          onConnectNodes={onConnectNodes}
          onDeleteEdge={onDeleteEdge}
        />
      )}

    </div>
  );
}
