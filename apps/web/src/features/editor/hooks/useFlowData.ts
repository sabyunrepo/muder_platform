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

function createFlowEdgeId(): string {
  return crypto.randomUUID();
}

interface AddFlowNodeOptions {
  onCreated?: (node: Node) => void;
}

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
  const selectedNodeIdRef = useRef<string | null>(null);
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
    const selectedNodeId = selectedNodeIdRef.current;
    const nextNodes = nodes_.map((node) => {
      const nextNode = toReactFlowNode(node);
      return selectedNodeId === nextNode.id ? { ...nextNode, selected: true } : nextNode;
    });
    const nextEdges = edges_.map(toReactFlowEdge);
    setNodesAndRef(nextNodes);
    setEdgesAndRef(nextEdges);
    setSelectedNode((prev) => {
      if (!prev) return null;
      const refreshed = nextNodes.find((node) => node.id === prev.id) ?? null;
      selectedNodeIdRef.current = refreshed?.id ?? null;
      return refreshed;
    });
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
      if (!connection.source || !connection.target) return;
      const preservedEdges = edgesRef.current.filter((edge) => edge.source !== connection.source);
      const next = addEdge(
        { id: createFlowEdgeId(), type: 'condition', ...connection },
        preservedEdges
      );
      setEdgesAndRef(next);
      autoSave(nodesRef.current, next);
    },
    [setEdgesAndRef, autoSave]
  );

  const connectNodes = useCallback(
    (sourceId: string, targetId: string) => {
      const preservedEdges = edgesRef.current.filter((edge) => edge.source !== sourceId);
      const next = addEdge(
        { id: createFlowEdgeId(), source: sourceId, target: targetId, type: 'condition' },
        preservedEdges
      );
      setEdgesAndRef(next);
      autoSave(nodesRef.current, next);
    },
    [setEdgesAndRef, autoSave]
  );

  const save = useCallback(() => {
    saveFlow.mutate(toSaveRequest(nodes, edges));
  }, [saveFlow, nodes, edges]);

  const addNode = useCallback(
    (
      type: FlowNodeType,
      position: XYPosition,
      data?: Partial<FlowNodeData>,
      options?: AddFlowNodeOptions,
    ) => {
      const defaultData: Partial<FlowNodeData> = type === 'phase' ? { label: '새 장면' } : {};

      createNode.mutate(
        {
          type,
          data: { ...defaultData, ...data },
          position_x: position.x,
          position_y: position.y,
        },
        {
          onSuccess: (created) => {
            const createdNode = toReactFlowNode(created);
            const next = [...nodesRef.current, createdNode];
            setNodesAndRef(next);
            autoSave(next, edgesRef.current);
            options?.onCreated?.(createdNode);
          },
        }
      );
    },
    [createNode, setNodesAndRef, autoSave]
  );

  const duplicateNode = useCallback(
    (id: string) => {
      const source = nodesRef.current.find((node) => node.id === id);
      if (!source || source.type === 'start' || source.type === 'ending' || source.type === 'branch') {
        return;
      }
      const label = typeof source.data?.label === 'string' && source.data.label.trim()
        ? `${source.data.label.trim()} 복사본`
        : '새 장면 복사본';
      createNode.mutate(
        {
          type: (source.type ?? 'phase') as FlowNodeType,
          data: { ...source.data, label },
          position_x: source.position.x + 80,
          position_y: source.position.y + 60,
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
        prev && prev.id === id
          ? { ...prev, data: { ...prev.data, ...patch } }
          : prev
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
          setSelectedNode((prev) => {
            if (prev?.id !== id) return prev;
            selectedNodeIdRef.current = null;
            return null;
          });
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
    const nextSelectedNode = selected.length === 1 ? selected[0] : null;
    selectedNodeIdRef.current = nextSelectedNode?.id ?? null;
    setSelectedNode(nextSelectedNode);
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
    duplicateNode,
    updateNodeData,
    deleteNode,
    deleteEdge,
    connectNodes,
    onSelectionChange,
    updateEdgeCondition,
    applyPreset,
  };
}
