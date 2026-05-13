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
  const phaseActions =
    node.type === "phase" ? (
      <>
        {onDuplicate ? (
          <button
            type="button"
            aria-label="장면 복제"
            title="장면 복제"
            onClick={() => onDuplicate(node.id)}
            className="inline-flex h-7 items-center gap-1 rounded border border-amber-500/50 bg-amber-500/10 px-2 text-[11px] font-semibold text-amber-100 transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
          >
            <Copy className="h-3.5 w-3.5" />
            장면 복제
          </button>
        ) : null}
        <button
          type="button"
          aria-label="장면 삭제"
          title="장면 삭제"
          onClick={() => {
            if (!window.confirm("이 장면을 삭제할까요? 연결된 선도 함께 삭제됩니다.")) return;
            onDelete(node.id);
          }}
          className="inline-flex h-7 items-center gap-1 rounded border border-red-500/50 bg-red-500/10 px-2 text-[11px] font-semibold text-red-200 transition-colors hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
        >
          <Trash2 className="h-3.5 w-3.5" />
          장면 삭제
        </button>
      </>
    ) : undefined;

  return (
    <div className="min-h-full">
      {/* Panel content */}
      <div>
        {isStart ? (
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-xs text-slate-500">
              시작 지점은 고정되어 있어 편집할 수 없습니다
            </span>
          </div>
        ) : node.type === "phase" ? (
          <PhaseNodePanel
            node={node}
            themeId={themeId}
            onUpdate={onUpdate}
            edges={edges}
            headerActions={phaseActions}
          />
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
