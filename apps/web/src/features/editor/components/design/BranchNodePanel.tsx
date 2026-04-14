import type { Node, Edge } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import { ConditionBuilder } from "./condition/ConditionBuilder";
import { useFlowConditionData } from "@/features/editor/hooks/useFlowConditionData";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BranchNodeData {
  label?: string;
  default_edge_id?: string;
  [key: string]: unknown;
}

interface BranchNodePanelProps {
  node: Node;
  themeId: string;
  onUpdate: (nodeId: string, data: Partial<BranchNodeData>) => void;
  edges: Edge[];
  onEdgeConditionChange: (
    edgeId: string,
    condition: Record<string, unknown>,
  ) => void;
}

// ---------------------------------------------------------------------------
// BranchNodePanel
// ---------------------------------------------------------------------------

export function BranchNodePanel({
  node,
  themeId,
  onUpdate,
  edges,
  onEdgeConditionChange,
}: BranchNodePanelProps) {
  const nodeData = node.data as BranchNodeData;
  const outEdges = edges.filter((e) => e.source === node.id);
  const { characters, clues } = useFlowConditionData(themeId);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-medium text-slate-200">분기 노드</span>
      </div>

      {/* Label */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-slate-400">라벨</label>
        <input
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
          value={nodeData.label ?? ""}
          onChange={(e) => onUpdate(node.id, { label: e.target.value })}
          placeholder="분기 이름"
        />
      </div>

      {/* Default edge */}
      {outEdges.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-400">
            기본 경로 (조건 없이 통과)
          </label>
          <select
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300 focus:border-amber-500 focus:outline-none"
            value={nodeData.default_edge_id ?? ""}
            onChange={(e) =>
              onUpdate(node.id, { default_edge_id: e.target.value })
            }
          >
            <option value="">없음</option>
            {outEdges.map((e) => (
              <option key={e.id} value={e.id}>
                {(e.data as { label?: string } | undefined)?.label ?? e.id}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Per-edge condition builders */}
      {outEdges.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-medium text-slate-400">
            엣지별 조건
          </span>
          {outEdges.map((e) => {
            const isDefault = e.id === nodeData.default_edge_id;
            const edgeLabel =
              (e.data as { label?: string } | undefined)?.label ?? e.id;
            const edgeCond =
              (e.data as { condition?: Record<string, unknown> } | undefined)
                ?.condition ?? null;
            return (
              <div key={e.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-300">{edgeLabel}</span>
                  {isDefault && (
                    <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[9px] text-slate-400">
                      기본
                    </span>
                  )}
                </div>
                {!isDefault && (
                  <ConditionBuilder
                    condition={edgeCond}
                    onChange={(cond) => onEdgeConditionChange(e.id, cond)}
                    characters={characters}
                    clues={clues}
                    label={`조건 — ${edgeLabel}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {outEdges.length === 0 && (
        <p className="text-[11px] text-slate-500">
          연결된 출력 엣지가 없습니다. 분기 노드에서 엣지를 연결하세요.
        </p>
      )}
    </div>
  );
}
