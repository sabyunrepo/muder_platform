import { useCallback, useRef, useEffect, useState } from "react";
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
} from "@xyflow/react";
import {
  useFlowGraph,
  useSaveFlow,
  useCreateFlowNode,
  useDeleteFlowNode,
} from "../flowApi";
import type { FlowNodeType, FlowNodeData } from "../flowTypes";
import { toReactFlowNode, toReactFlowEdge, toSaveRequest } from "./flowConverters";
import { createDefaultTemplate } from "./flowDefaults";
import { useEdgeCondition } from "./useEdgeCondition";
import { useApplyPreset } from "./useApplyPreset";

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

  useEffect(() => {
    if (!data) return;
    const nodes_ = data.nodes ?? [];
    const edges_ = data.edges ?? [];
    if (nodes_.length === 0 && edges_.length === 0) {
      if (hasInitialized.current) return;
      hasInitialized.current = true;
      const tpl = createDefaultTemplate();
      setNodes(tpl.nodes);
      setEdges(tpl.edges);
      saveFlow.mutate(toSaveRequest(tpl.nodes, tpl.edges));
      return;
    }
    setNodes(nodes_.map(toReactFlowNode));
    setEdges(edges_.map(toReactFlowEdge));
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
    [saveFlow],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds);
        autoSave(next, edgesRef.current);
        return next;
      });
    },
    [setNodes, autoSave],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => {
        const next = applyEdgeChanges(changes, eds);
        autoSave(nodesRef.current, next);
        return next;
      });
    },
    [setEdges, autoSave],
  );
  const onConnect: OnConnect = useCallback(
    (connection) => {
      setEdges((eds) => {
        const next = addEdge(connection, eds);
        autoSave(nodesRef.current, next);
        return next;
      });
    },
    [setEdges, autoSave],
  );

  const save = useCallback(() => {
    saveFlow.mutate(toSaveRequest(nodes, edges));
  }, [saveFlow, nodes, edges]);

  const addNode = useCallback(
    (type: FlowNodeType, position: XYPosition) => {
      createNode.mutate(
        {
          type,
          data: { label: type === "phase" ? "새 장면" : undefined },
          position_x: position.x,
          position_y: position.y,
        },
        {
          onSuccess: (created) => {
            setNodes((nds) => {
              const next = [...nds, toReactFlowNode(created)];
              autoSave(next, edgesRef.current);
              return next;
            });
          },
        },
      );
    },
    [createNode, setNodes, autoSave],
  );

  const updateNodeData = useCallback(
    (id: string, patch: Partial<FlowNodeData>) => {
      setNodes((nds) => {
        const next = nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
        );
        autoSave(next, edgesRef.current);
        return next;
      });
      setSelectedNode((prev) =>
        prev && prev.id === id
          ? { ...prev, data: { ...prev.data, ...patch } }
          : prev,
      );
    },
    [setNodes, autoSave],
  );

  const deleteNode = useCallback(
    (id: string) => {
      deleteNodeMutation.mutate(id, {
        onSuccess: () => {
          const nextNodes = nodesRef.current.filter((n) => n.id !== id);
          const nextEdges = edgesRef.current.filter(
            (e) => e.source !== id && e.target !== id,
          );
          setNodes(nextNodes);
          setEdges(nextEdges);
          autoSave(nextNodes, nextEdges);
          setSelectedNode((prev) => (prev?.id === id ? null : prev));
        },
      });
    },
    [deleteNodeMutation, setNodes, setEdges, autoSave],
  );

  const deleteEdge = useCallback(
    (id: string) => {
      const nextEdges = edgesRef.current.filter((edge) => edge.id !== id);
      setEdges(nextEdges);
      autoSave(nodesRef.current, nextEdges);
    },
    [setEdges, autoSave],
  );

  const onSelectionChange = useCallback(
    ({ nodes: selected }: { nodes: Node[] }) => {
      setSelectedNode(selected.length === 1 ? selected[0] : null);
    },
    [],
  );

  const getNodes = useCallback(() => nodesRef.current, []);
  const getEdges = useCallback(() => edgesRef.current, []);
  const { updateEdgeCondition } = useEdgeCondition(
    setEdges,
    getNodes,
    getEdges,
    autoSave,
  );
  const { applyPreset } = useApplyPreset(setNodes, setEdges, autoSave);

  return {
    nodes, edges,
    onNodesChange: handleNodesChange, onEdgesChange: handleEdgesChange,
    onConnect, isLoading, isError, error, refetch, isSaving: saveFlow.isPending, save,
    selectedNode, addNode, updateNodeData, deleteNode, deleteEdge,
    onSelectionChange, updateEdgeCondition, applyPreset,
  };
}
