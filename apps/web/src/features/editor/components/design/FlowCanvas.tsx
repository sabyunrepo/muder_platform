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
import { ConfirmDialog } from '@/shared/components/ui';
import { useFlowData } from '../../hooks/useFlowData';
import { useFlowConnections } from '../../hooks/useFlowConnections';
import { FlowToolbar } from './FlowToolbar';
import { StartNode } from './StartNode';
import { PhaseNode } from './PhaseNode';
import { NodeDetailPanel } from './NodeDetailPanel';
import { FlowOrderReviewPanel } from './FlowOrderReviewPanel';
import { conditionEdgeTypes } from './flowNodeRegistry';
import type { FlowNodeType } from '../../flowTypes';

// ---------------------------------------------------------------------------
// Node / edge type registries
// ---------------------------------------------------------------------------

const nodeTypes: NodeTypes = {
  start: StartNode,
  phase: PhaseNode,
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
  const [pendingDeleteEdgeId, setPendingDeleteEdgeId] = useState<string | null>(null);

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
    duplicateNode,
    updateNodeData,
    deleteNode,
    deleteEdge,
    connectNodes,
    onSelectionChange,
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

  const flowNodes = useMemo(
    () => renderedNodes.filter((node) => node.type !== 'ending' && node.type !== 'branch'),
    [renderedNodes]
  );

  const flowNodeIds = useMemo(
    () => new Set(flowNodes.map((node) => node.id)),
    [flowNodes]
  );

  const flowEdges = useMemo(
    () => edges.filter((edge) => flowNodeIds.has(edge.source) && flowNodeIds.has(edge.target)),
    [edges, flowNodeIds]
  );
  const selectedFlowNode =
    selectedNode?.type === 'ending' || selectedNode?.type === 'branch' ? null : selectedNode;
  const { isValidConnection } = useFlowConnections({ nodes: flowNodes, edges: flowEdges });

  useEffect(() => {
    onSelectedNodeChange?.(selectedFlowNode, {
      outgoingEdges: selectedFlowNode
        ? flowEdges.filter((edge) => edge.source === selectedFlowNode.id)
        : [],
    });
  }, [flowEdges, onSelectedNodeChange, selectedFlowNode]);

  const selectedEdge = useMemo(
    () => flowEdges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [flowEdges, selectedEdgeId]
  );
  const pendingDeleteEdge = useMemo(
    () => flowEdges.find((edge) => edge.id === pendingDeleteEdgeId) ?? null,
    [flowEdges, pendingDeleteEdgeId]
  );

  const handleAddScene = useCallback(
    () => {
      const wrapper = reactFlowWrapper.current;
      const cx = wrapper ? wrapper.clientWidth / 2 : 300;
      const cy = wrapper ? wrapper.clientHeight / 2 : 200;
      addNode('phase', { x: cx, y: cy }, { label: '새 장면' });
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
      if (!type || type === 'ending') return;
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
    const source = flowNodes.find((node) => node.id === selectedEdge.source);
    const target = flowNodes.find((node) => node.id === selectedEdge.target);
    return `${String(source?.data?.label ?? selectedEdge.source)} -> ${String(target?.data?.label ?? selectedEdge.target)}`;
  }, [flowNodes, selectedEdge]);

  const handleConnectNodes = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) {
        toast.error('같은 장면으로는 연결할 수 없습니다');
        return;
      }
      if (flowEdges.some((edge) => edge.source === sourceId && edge.target === targetId)) {
        toast.error('이미 연결된 장면입니다');
        return;
      }
      connectNodes(sourceId, targetId);
      toast.success('다음 장면을 연결했습니다');
    },
    [connectNodes, flowEdges]
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
        onAddScene={handleAddScene}
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
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
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
        <div
          data-testid="flow-side-panel"
          className="flex max-h-[55vh] w-full shrink-0 scroll-pb-10 flex-col overflow-y-auto border-t border-slate-800 bg-slate-900 pb-10 lg:max-h-none lg:w-[36rem] lg:border-l lg:border-t-0 xl:w-[40rem]"
        >
          {!showOrderReview && !selectedFlowNode && (
            <div className="p-4 text-sm leading-6 text-slate-400">
              {selectedEdge ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-300">선 연결</p>
                    <p className="mt-1 break-words text-xs text-slate-500">{selectedEdgeLabel}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteEdgeId(selectedEdge.id)}
                    className="w-full rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                  >
                    연결 끊기
                  </button>
                </div>
              ) : (
                '장면을 선택하면 세부 설정을 편집할 수 있습니다.'
              )}
            </div>
          )}
          {showOrderReview && (
            <div className="border-b border-slate-800 p-3">
              <FlowOrderReviewPanel
                nodes={flowNodes}
                edges={flowEdges}
                onHighlight={setHighlightId}
                onClose={() => {
                  setShowOrderReview(false);
                  setHighlightId(null);
                }}
              />
            </div>
          )}
          {selectedFlowNode && (
            <NodeDetailPanel
              node={selectedFlowNode}
              themeId={themeId}
              onUpdate={updateNodeData}
              onDelete={deleteNode}
              onDuplicate={duplicateNode}
              nodes={flowNodes}
              edges={flowEdges}
              onConnectNodes={handleConnectNodes}
              onDeleteEdge={deleteEdge}
            />
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={pendingDeleteEdge != null}
        title="선 연결을 끊을까요?"
        description="이 작업은 즉시 저장됩니다."
        confirmLabel="연결 끊기"
        tone="danger"
        onCancel={() => setPendingDeleteEdgeId(null)}
        onConfirm={() => {
          if (!pendingDeleteEdge) return;
          deleteEdge(pendingDeleteEdge.id);
          setSelectedEdgeId(null);
          setPendingDeleteEdgeId(null);
        }}
      />
    </div>
  );
}
