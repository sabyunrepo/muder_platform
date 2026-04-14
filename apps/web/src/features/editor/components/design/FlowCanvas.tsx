import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  type NodeTypes,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useRef } from "react";
import { useFlowData } from "../../hooks/useFlowData";
import { FlowToolbar } from "./FlowToolbar";
import { StartNode } from "./StartNode";
import { PhaseNode } from "./PhaseNode";
import { EndingNode } from "./EndingNode";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { branchNodeTypes, conditionEdgeTypes } from "./flowNodeRegistry";
import type { FlowNodeType } from "../../flowTypes";

// ---------------------------------------------------------------------------
// Node / edge type registries
// ---------------------------------------------------------------------------

const nodeTypes: NodeTypes = {
  start: StartNode,
  phase: PhaseNode,
  ending: EndingNode,
  ...branchNodeTypes,
};

const edgeTypes = { ...conditionEdgeTypes };

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
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isLoading,
    isSaving,
    save,
    selectedNode,
    addNode,
    updateNodeData,
    deleteNode,
    onSelectionChange,
    updateEdgeCondition,
  } = useFlowData(themeId);

  // Add node at canvas center
  const handleAddNode = useCallback(
    (type: string) => {
      const wrapper = reactFlowWrapper.current;
      const cx = wrapper ? wrapper.clientWidth / 2 : 300;
      const cy = wrapper ? wrapper.clientHeight / 2 : 200;
      addNode(type as FlowNodeType, { x: cx, y: cy });
    },
    [addNode],
  );

  // Drag over — allow drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  // Drop — create node at drop position
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/flow-node-type");
      if (!type) return;
      const wrapper = reactFlowWrapper.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      addNode(type as FlowNodeType, {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    [addNode],
  );

  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      onSelectionChange({ nodes: params.nodes });
    },
    [onSelectionChange],
  );

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
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div
          ref={reactFlowWrapper}
          className="flex-1"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={handleSelectionChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            deleteKeyCode="Delete"
            edgesFocusable={true}
            edgesReconnectable={true}
            fitView
            colorMode="dark"
          >
            <Background />
            <MiniMap />
            <Controls />
          </ReactFlow>
        </div>

        {/* Detail panel — shown when a node is selected */}
        {selectedNode && (
          <div className="w-56 shrink-0 border-l border-slate-800 bg-slate-900 overflow-y-auto">
            <NodeDetailPanel
              node={selectedNode}
              themeId={themeId}
              onUpdate={updateNodeData}
              onDelete={deleteNode}
              edges={edges}
              onEdgeConditionChange={updateEdgeCondition}
            />
          </div>
        )}
      </div>
    </div>
  );
}
