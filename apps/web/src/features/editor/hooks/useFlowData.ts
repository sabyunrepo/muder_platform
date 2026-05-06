import { useCallback, useRef, useEffect, useState } from 'react';
import {
  useNodesState,
  useEdgesState,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Node,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type OnConnect,
  type XYPosition,
} from '@xyflow/react';
import { useFlowGraph, useSaveFlow, useCreateFlowNode, useDeleteFlowNode } from '../flowApi';
import type { FlowNodeType, FlowNodeData } from '../flowTypes';
import { toReactFlowNode, toReactFlowEdge, toSaveRequest } from './flowConverters';
import { createDefaultTemplate } from './flowDefaults';
import { useEdgeCondition } from './useEdgeCondition';
import { useApplyPreset } from './useApplyPreset';

export function useFlowData(themeId: string) {
  const { data, isLoading, isError, error, refetch } = useFlowGraph(themeId);
  const saveFlow = useSaveFlow(themeId);
  const createNode = useCreateFlowNode(themeId);
  const deleteNodeMutation = useDeleteFlowNode(themeId);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitialized = useRef(false);

  const serverNodes = data?.nodes ?? [];
  const serverEdges = data?.edges ?? [];

  const initialNodes: Node[] = serverNodes.map(toReactFlowNode);
  const initialEdges: Edge[] = serverEdges.map(toReactFlowEdge);

  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const setNodesAndRef = useCallback(
    (next: Node[]) => {
      nodesRef.current = next;
      setNodes(next);
    },
    [setNodes]
  );

  const setEdgesAndRef = useCallback(
    (next: Edge[]) => {
      edgesRef.current = next;
      setEdges(next);
    },
    [setEdges]
  );

  useEffect(() => {
    if (!data) return;
    const nodes_ = data.nodes ?? [];
    const edges_ = data.edges ?? [];
    if (nodes_.length === 0 && edges_.length === 0) {
      if (hasInitialized.current) return;
      hasInitialized.current = true;
      const tpl = createDefaultTemplate();
      setNodesAndRef(tpl.nodes);
      setEdgesAndRef(tpl.edges);
      saveFlow.mutate(toSaveRequest(tpl.nodes, tpl.edges));
      return;
    }
    const nextNodes = nodes_.map(toReactFlowNode);
    const nextEdges = edges_.map(toReactFlowEdge);
    setNodesAndRef(nextNodes);
    setEdgesAndRef(nextEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const autoSave = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveFlow.mutate(toSaveRequest(nextNodes, nextEdges));
      }, 1000);
    },
    [saveFlow]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const next = applyNodeChanges(changes, nodesRef.current);
      setNodesAndRef(next);
      autoSave(next, edgesRef.current);
    },
    [setNodesAndRef, autoSave]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const next = applyEdgeChanges(changes, edgesRef.current);
      setEdgesAndRef(next);
      autoSave(nodesRef.current, next);
    },
    [setEdgesAndRef, autoSave]
  );
  const onConnect: OnConnect = useCallback(
    (connection) => {
      const next = addEdge(connection, edgesRef.current);
      setEdgesAndRef(next);
      autoSave(nodesRef.current, next);
    },
    [setEdgesAndRef, autoSave]
  );

  const connectNodes = useCallback(
    (sourceId: string, targetId: string) => {
      const next = addEdge({ source: sourceId, target: targetId, type: 'condition' }, edgesRef.current);
      setEdgesAndRef(next);
      autoSave(nodesRef.current, next);
    },
    [setEdgesAndRef, autoSave]
  );

  const save = useCallback(() => {
    saveFlow.mutate(toSaveRequest(nodes, edges));
  }, [saveFlow, nodes, edges]);

  const addNode = useCallback(
    (type: FlowNodeType, position: XYPosition) => {
      createNode.mutate(
        {
          type,
          data: { label: type === 'phase' ? '새 장면' : undefined },
          position_x: position.x,
          position_y: position.y,
        },
        {
          onSuccess: (created) => {
            const next = [...nodesRef.current, toReactFlowNode(created)];
            setNodesAndRef(next);
            autoSave(next, edgesRef.current);
          },
        }
      );
    },
    [createNode, setNodesAndRef, autoSave]
  );

  const updateNodeData = useCallback(
    (id: string, patch: Partial<FlowNodeData>) => {
      const next = nodesRef.current.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
      );
      setNodesAndRef(next);
      autoSave(next, edgesRef.current);
      setSelectedNode((prev) =>
        prev && prev.id === id ? { ...prev, data: { ...prev.data, ...patch } } : prev
      );
    },
    [setNodesAndRef, autoSave]
  );

  const deleteNode = useCallback(
    (id: string) => {
      deleteNodeMutation.mutate(id, {
        onSuccess: () => {
          const nextNodes = nodesRef.current.filter((n) => n.id !== id);
          const nextEdges = edgesRef.current.filter((e) => e.source !== id && e.target !== id);
          setNodesAndRef(nextNodes);
          setEdgesAndRef(nextEdges);
          autoSave(nextNodes, nextEdges);
          setSelectedNode((prev) => (prev?.id === id ? null : prev));
        },
      });
    },
    [deleteNodeMutation, setNodesAndRef, setEdgesAndRef, autoSave]
  );

  const deleteEdge = useCallback(
    (id: string) => {
      const nextEdges = edgesRef.current.filter((edge) => edge.id !== id);
      setEdgesAndRef(nextEdges);
      autoSave(nodesRef.current, nextEdges);
    },
    [setEdgesAndRef, autoSave]
  );

  const onSelectionChange = useCallback(({ nodes: selected }: { nodes: Node[] }) => {
    setSelectedNode(selected.length === 1 ? selected[0] : null);
  }, []);

  const getNodes = useCallback(() => nodesRef.current, []);
  const getEdges = useCallback(() => edgesRef.current, []);
  const { updateEdgeCondition } = useEdgeCondition(setEdgesAndRef, getNodes, getEdges, autoSave);
  const { applyPreset } = useApplyPreset(setNodesAndRef, setEdgesAndRef, autoSave);

  return {
    nodes,
    edges,
    onNodesChange: handleNodesChange,
    onEdgesChange: handleEdgesChange,
    onConnect,
    isLoading,
    isError,
    error,
    refetch,
    isSaving: saveFlow.isPending,
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
  };
}
