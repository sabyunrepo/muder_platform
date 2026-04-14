import { ReactFlow, Background, Controls, Panel, type NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEditorClues } from "@/features/editor/api";
import { useClueGraphData } from "../../hooks/useClueGraphData";
import { ClueNode } from "./ClueNode";
import { RelationEdge } from "./RelationEdge";

// ---------------------------------------------------------------------------
// Node / edge type registries (stable references — defined outside component)
// ---------------------------------------------------------------------------

const nodeTypes: NodeTypes = { clue: ClueNode };
const edgeTypes = { relation: RelationEdge };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ClueRelationGraphProps {
  themeId: string;
}

// ---------------------------------------------------------------------------
// ClueRelationGraph
// ---------------------------------------------------------------------------

export function ClueRelationGraph({ themeId }: ClueRelationGraphProps) {
  const { data: clues } = useEditorClues(themeId);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
  } = useClueGraphData(themeId, clues);

  const isEmpty = !clues || clues.length === 0;

  if (isEmpty) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div>
          <div className="text-sm text-slate-500">단서가 없습니다</div>
          <div className="mt-1 text-xs text-slate-600">
            먼저 목록 탭에서 단서를 추가하세요
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
              단서 간 관계를 추가하려면 노드를 연결하세요
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
