import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  type NodeTypes,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEditorClues } from "@/features/editor/api";
import { useClueEdgeData } from "../../hooks/useClueEdgeData";
import { ClueNode } from "./ClueNode";
import { RelationEdge } from "./RelationEdge";

// ---------------------------------------------------------------------------
// Phase 20 PR-6: ClueEdgeGraph — 정식 승격된 단서 관계 그래프.
// 기존 ClueRelationGraph의 PoC를 `clue_edge_groups` API 기반으로 교체.
// Trigger (AUTO/CRAFT) 토글은 PR-7+ 의 InspectorPanel에서 추가 예정.
// ---------------------------------------------------------------------------

const nodeTypes: NodeTypes = { clue: ClueNode };
const edgeTypes = { relation: RelationEdge };

interface ClueEdgeGraphProps {
  themeId: string;
}

export function ClueEdgeGraph({ themeId }: ClueEdgeGraphProps) {
  const { data: clues } = useEditorClues(themeId);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onEdgeDelete,
    isLoading,
    isSaving,
  } = useClueEdgeData(themeId, clues);

  const handleEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      deleted.forEach((e) => onEdgeDelete(e.id));
    },
    [onEdgeDelete],
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const hasClues = clues && clues.length > 0;
  if (!hasClues) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div>
          <div className="text-sm text-slate-400">단서를 먼저 추가하세요</div>
          <div className="mt-1 text-xs text-slate-600">
            목록 탭에서 단서를 추가하면 이 곳에 나타납니다
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={handleEdgesDelete}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        colorMode="dark"
        deleteKeyCode="Delete"
      >
        <Background />
        <Controls />
        {edges.length === 0 && (
          <Panel position="top-center">
            <div className="rounded border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-400">
              노드를 드래그하여 연결하면 엣지가 생성됩니다
            </div>
          </Panel>
        )}
        {isSaving && (
          <Panel position="top-right">
            <div className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900/80 px-2 py-1 text-xs text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              저장 중...
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
