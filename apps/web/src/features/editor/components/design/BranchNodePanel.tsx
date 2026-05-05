import type { Node, Edge } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { ConditionBuilder } from './condition/ConditionBuilder';
import { useFlowConditionData } from '@/features/editor/hooks/useFlowConditionData';
import { describeConditionRecord } from '../../entities/shared/conditionAdapter';

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
  onEdgeConditionChange: (edgeId: string, condition: Record<string, unknown>) => void;
}

function getEdgeDisplayName(edge: Edge, index: number): string {
  const label = (edge.data as { label?: unknown } | undefined)?.label;
  return typeof label === 'string' && label.trim() ? label.trim() : `분기 ${index + 1}`;
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
  const defaultEdgeSelectId = `branch-default-edge-${node.id}`;

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
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
          value={nodeData.label ?? ''}
          onChange={(e) => onUpdate(node.id, { label: e.target.value })}
          placeholder="분기 이름"
        />
      </div>

      {/* Default edge */}
      {outEdges.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor={defaultEdgeSelectId} className="text-[11px] text-slate-400">
            기본 경로 (조건 없이 통과)
          </label>
          <select
            id={defaultEdgeSelectId}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
            value={nodeData.default_edge_id ?? ''}
            onChange={(e) => onUpdate(node.id, { default_edge_id: e.target.value })}
          >
            <option value="">없음</option>
            {outEdges.map((e, index) => (
              <option key={e.id} value={e.id}>
                {getEdgeDisplayName(e, index)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Per-edge condition builders */}
      {outEdges.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-medium text-slate-400">엣지별 조건</span>
          {outEdges.map((e, index) => {
            const isDefault = e.id === nodeData.default_edge_id;
            const edgeLabel = getEdgeDisplayName(e, index);
            const edgeCond =
              (e.data as { condition?: Record<string, unknown> } | undefined)?.condition ?? null;
            const conditionSummary = isDefault ? '기본 경로' : describeConditionRecord(edgeCond);
            return (
              <div key={e.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-slate-300">{edgeLabel}</span>
                  <span className="text-[10px] text-slate-500">{conditionSummary}</span>
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
