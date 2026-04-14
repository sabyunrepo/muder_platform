import { useCallback, useRef, useEffect, useState } from "react";
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
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

export function useFlowData(themeId: string) {
  const { data, isLoading } = useFlowGraph(themeId);
  const saveFlow = useSaveFlow(themeId);
  const createNode = useCreateFlowNode(themeId);
  const deleteNodeMutation = useDeleteFlowNode(themeId);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitialized = useRef(false);

  const serverNodes = data?.nodes ?? [];
  const serverEdges = data?.edges ?? [];

  const initialNodes: Node[] = serverNodes.map(toReactFlowNode);
  const initialEdges: Edge[] = serverEdges.map(toReactFlowEdge);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Sync server data; apply default template on first blank load
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

  // Cleanup debounce on unmount
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

  const handleNodesChange: typeof onNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      setNodes((nds) => {
        autoSave(nds, edges);
        return nds;
      });
    },
    [onNodesChange, setNodes, edges, autoSave],
  );

  const handleEdgesChange: typeof onEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);
      setEdges((eds) => {
        autoSave(nodes, eds);
        return eds;
      });
    },
    [onEdgesChange, setEdges, nodes, autoSave],
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      setEdges((eds) => {
        const next = addEdge(connection, eds);
        autoSave(nodes, next);
        return next;
      });
    },
    [setEdges, nodes, autoSave],
  );

  const save = useCallback(() => {
    saveFlow.mutate(toSaveRequest(nodes, edges));
  }, [saveFlow, nodes, edges]);

  const addNode = useCallback(
    (type: FlowNodeType, position: XYPosition) => {
      createNode.mutate(
        {
          type,
          data: { label: type === "phase" ? "새 페이즈" : undefined },
          position_x: position.x,
          position_y: position.y,
        },
        {
          onSuccess: (created) => {
            setNodes((nds) => {
              const next = [...nds, toReactFlowNode(created)];
              autoSave(next, edges);
              return next;
            });
          },
        },
      );
    },
    [createNode, setNodes, edges, autoSave],
  );

  const updateNodeData = useCallback(
    (id: string, patch: Partial<FlowNodeData>) => {
      setNodes((nds) => {
        const next = nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
        );
        autoSave(next, edges);
        return next;
      });
      // Keep selectedNode in sync
      setSelectedNode((prev) =>
        prev && prev.id === id
          ? { ...prev, data: { ...prev.data, ...patch } }
          : prev,
      );
    },
    [setNodes, edges, autoSave],
  );

  // Delete a node
  const deleteNode = useCallback(
    (id: string) => {
      deleteNodeMutation.mutate(id, {
        onSuccess: () => {
          setNodes((nds) => {
            const next = nds.filter((n) => n.id !== id);
            autoSave(next, edges);
            return next;
          });
          setEdges((eds) => {
            const next = eds.filter(
              (e) => e.source !== id && e.target !== id,
            );
            autoSave(nodes, next);
            return next;
          });
          setSelectedNode((prev) => (prev?.id === id ? null : prev));
        },
      });
    },
    [deleteNodeMutation, setNodes, setEdges, edges, nodes, autoSave],
  );

  const onSelectionChange = useCallback(
    ({ nodes: selected }: { nodes: Node[] }) => {
      setSelectedNode(selected.length === 1 ? selected[0] : null);
    },
    [],
  );

  return {
    nodes,
    edges,
    onNodesChange: handleNodesChange,
    onEdgesChange: handleEdgesChange,
    onConnect,
    isLoading,
    isSaving: saveFlow.isPending,
    save,
    selectedNode,
    addNode,
    updateNodeData,
    deleteNode,
    onSelectionChange,
  };
}
