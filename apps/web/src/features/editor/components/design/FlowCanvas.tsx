import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useFlowData } from "../../hooks/useFlowData";
import { FlowToolbar } from "./FlowToolbar";

// ---------------------------------------------------------------------------
// Node types — custom nodes will be added in Phase 15.0 W2
// ---------------------------------------------------------------------------

const nodeTypes: NodeTypes = {};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FlowCanvasProps {
  themeId: string;
}

// ---------------------------------------------------------------------------
// FlowCanvas
// ---------------------------------------------------------------------------

export function FlowCanvas({ themeId }: FlowCanvasProps) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isLoading,
    isSaving,
    save,
  } = useFlowData(themeId);

  const handleAddNode = (type: string) => {
    // Node creation handled via drag-and-drop or toolbar in W2
    // For now, log intent — full implementation in Phase 15.0 W2
    void type;
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="text-sm text-slate-400">로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <FlowToolbar
        onAddNode={handleAddNode}
        onSave={save}
        isSaving={isSaving}
      />
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          colorMode="dark"
        >
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
