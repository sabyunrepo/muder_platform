import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback } from "react";
import type { EditorThemeResponse } from "@/features/editor/api";
import { useFlowData } from "@/features/editor/hooks/useFlowData";

// ---------------------------------------------------------------------------
// Node types (extended in PR-2)
// ---------------------------------------------------------------------------

const nodeTypes: NodeTypes = {};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FlowCanvasProps {
  themeId: string;
  theme: EditorThemeResponse;
  onSelectionChange?: (params: OnSelectionChangeParams) => void;
}

// ---------------------------------------------------------------------------
// FlowCanvas
// ---------------------------------------------------------------------------

export function FlowCanvas({
  themeId,
  theme,
  onSelectionChange,
}: FlowCanvasProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } =
    useFlowData(themeId, theme);

  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      onSelectionChange?.(params);
    },
    [onSelectionChange],
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={handleSelectionChange}
        nodeTypes={nodeTypes}
        deleteKeyCode="Delete"
        edgesFocusable={true}
        edgesReconnectable={true}
        fitView
        colorMode="dark"
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
