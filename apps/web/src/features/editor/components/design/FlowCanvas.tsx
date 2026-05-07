import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  type Edge,
  type Node,
  type NodeTypes,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useFlowData } from '../../hooks/useFlowData';
import { FlowToolbar } from './FlowToolbar';
import { StartNode } from './StartNode';
import { PhaseNode } from './PhaseNode';
import { EndingNode } from './EndingNode';
import { NodeDetailPanel } from './NodeDetailPanel';
import { FlowOrderReviewPanel } from './FlowOrderReviewPanel';
import { StorySceneSummary } from './StorySceneSummary';
import { branchNodeTypes, conditionEdgeTypes } from './flowNodeRegistry';
import type { FlowNodeType } from '../../flowTypes';

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
  onSelectedNodeChange?: (
    node: Node | null,
    context: { outgoingEdges: Edge[] },
  ) => void;
}

// ---------------------------------------------------------------------------
// FlowCanvas
// ---------------------------------------------------------------------------

export function FlowCanvas({ themeId, onSelectedNodeChange }: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [showOrderReview, setShowOrderReview] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

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
    deleteEdge,
    connectNodes,
    onSelectionChange,
    updateEdgeCondition,
    applyPreset,
  } = useFlowData(themeId);

  const renderedNodes = useMemo(
    () =>
      nodes.map((node) =>
        node.id === highlightId
          ? {
              ...node,
              className: [node.className, '!ring-2 !ring-amber-400'].filter(Boolean).join(' '),
            }
          : node
      ),
    [highlightId, nodes]
  );

  useEffect(() => {
    onSelectedNodeChange?.(selectedNode, {
      outgoingEdges: selectedNode
        ? edges.filter((edge) => edge.source === selectedNode.id)
        : [],
    });
  }, [edges, onSelectedNodeChange, selectedNode]);

  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId]
  );

  // Add node at canvas center
  const handleAddNode = useCallback(
    (type: string) => {
      const wrapper = reactFlowWrapper.current;
      const cx = wrapper ? wrapper.clientWidth / 2 : 300;
      const cy = wrapper ? wrapper.clientHeight / 2 : 200;
      addNode(type as FlowNodeType, { x: cx, y: cy });
    },
    [addNode]
  );

  // Drag over — allow drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Drop — create node at drop position
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/flow-node-type');
      if (!type) return;
      const wrapper = reactFlowWrapper.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      addNode(type as FlowNodeType, {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    [addNode]
  );

  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      onSelectionChange({ nodes: params.nodes });
      setSelectedEdgeId(
        params.nodes.length === 0 && params.edges.length === 1 ? params.edges[0].id : null
      );
    },
    [onSelectionChange]
  );

  const selectedEdgeLabel = useMemo(() => {
    if (!selectedEdge) return null;
    const source = nodes.find((node) => node.id === selectedEdge.source);
    const target = nodes.find((node) => node.id === selectedEdge.target);
    return `${String(source?.data?.label ?? selectedEdge.source)} -> ${String(target?.data?.label ?? selectedEdge.target)}`;
  }, [nodes, selectedEdge]);

  const handleConnectNodes = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) {
        toast.error('같은 장면으로는 연결할 수 없습니다');
        return;
      }
      if (edges.some((edge) => edge.source === sourceId && edge.target === targetId)) {
        toast.error('이미 연결된 장면입니다');
        return;
      }
      connectNodes(sourceId, targetId);
      toast.success('다음 장면을 연결했습니다');
    },
    [connectNodes, edges]
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
        onToggleOrderReview={() => {
          if (showOrderReview) setHighlightId(null);
          setShowOrderReview((v) => !v);
        }}
        isOrderReviewing={showOrderReview}
      />
      <StorySceneSummary nodes={nodes} edges={edges} />
      <div
        data-testid="flow-workspace"
        className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row"
      >
        {/* Canvas */}
        <div
          data-testid="flow-canvas"
          ref={reactFlowWrapper}
          className="relative min-h-[420px] flex-1 overflow-hidden lg:min-h-0"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <ReactFlow
            nodes={renderedNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={handleSelectionChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            deleteKeyCode={null}
            edgesFocusable={true}
            edgesReconnectable={true}
            fitView
            fitViewOptions={{ padding: 0.35 }}
            colorMode="dark"
          >
            <Background />
            <MiniMap />
            <Controls />
          </ReactFlow>
        </div>

        {/* Side panels */}
        <div className="flex max-h-[55vh] w-full shrink-0 flex-col overflow-y-auto border-t border-slate-800 bg-slate-900 lg:max-h-none lg:w-72 lg:border-l lg:border-t-0">
          {!showOrderReview && !selectedNode && (
            <div className="p-4 text-sm leading-6 text-slate-400">
              {selectedEdge ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-300">선 연결</p>
                    <p className="mt-1 break-words text-xs text-slate-500">{selectedEdgeLabel}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm('선 연결을 끊을까요? 이 작업은 즉시 저장됩니다.')) return;
                      deleteEdge(selectedEdge.id);
                      setSelectedEdgeId(null);
                    }}
                    className="w-full rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                  >
                    연결 끊기
                  </button>
                </div>
              ) : (
                '장면이나 결말을 선택하면 세부 설정을 편집할 수 있습니다.'
              )}
            </div>
          )}
          {showOrderReview && (
            <div className="border-b border-slate-800 p-3">
              <FlowOrderReviewPanel
                nodes={nodes}
                edges={edges}
                onHighlight={setHighlightId}
                onClose={() => {
                  setShowOrderReview(false);
                  setHighlightId(null);
                }}
              />
            </div>
          )}
          {selectedNode && (
            <NodeDetailPanel
              node={selectedNode}
              themeId={themeId}
              onUpdate={updateNodeData}
              onDelete={deleteNode}
              nodes={nodes}
              edges={edges}
              onConnectNodes={handleConnectNodes}
              onDeleteEdge={deleteEdge}
              onEdgeConditionChange={updateEdgeCondition}
            />
          )}
        </div>
      </div>
    </div>
  );
}
