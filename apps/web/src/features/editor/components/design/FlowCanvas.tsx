import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  type NodeTypes,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useRef, useState } from "react";
import { useFlowData } from "../../hooks/useFlowData";
import { FlowToolbar } from "./FlowToolbar";
import { StartNode } from "./StartNode";
import { PhaseNode } from "./PhaseNode";
import { EndingNode } from "./EndingNode";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { FlowSimulationPanel } from "./FlowSimulationPanel";
import { StorySceneSummary } from "./StorySceneSummary";
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
  const [showSim, setShowSim] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

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
    applyPreset,
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
        onApplyPreset={applyPreset}
        hasNodes={nodes.length > 0}
        onToggleSimulation={() => setShowSim((v) => !v)}
        isSimulating={showSim}
      />
      <StorySceneSummary nodes={nodes} edges={edges} />
      <div data-testid="flow-workspace" className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Canvas */}
        <div
          ref={reactFlowWrapper}
          className="min-h-[420px] flex-1 lg:min-h-0"
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
            nodeClassName={(node) => node.id === highlightId ? "!ring-2 !ring-amber-400" : ""}
            fitView
            colorMode="dark"
          >
            <Background />
            <MiniMap />
            <Controls />
          </ReactFlow>
        </div>

        {/* Side panels */}
        <div className="flex max-h-[55vh] w-full shrink-0 flex-col overflow-y-auto border-t border-slate-800 bg-slate-900 lg:max-h-none lg:w-72 lg:border-l lg:border-t-0">
          {!showSim && !selectedNode && (
            <div className="p-4 text-sm leading-6 text-slate-400">
              장면이나 결말을 선택하면 세부 설정을 편집할 수 있습니다.
            </div>
          )}
          {showSim && (
            <div className="border-b border-slate-800 p-3">
              <FlowSimulationPanel
                nodes={nodes}
                edges={edges}
                onHighlight={setHighlightId}
                onClose={() => { setShowSim(false); setHighlightId(null); }}
              />
            </div>
          )}
          {selectedNode && (
            <NodeDetailPanel
              node={selectedNode}
              themeId={themeId}
              onUpdate={updateNodeData}
              onDelete={deleteNode}
              edges={edges}
              onEdgeConditionChange={updateEdgeCondition}
            />
          )}
        </div>
      </div>
    </div>
  );
}
