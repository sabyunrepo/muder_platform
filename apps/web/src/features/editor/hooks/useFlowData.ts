import { useCallback, useRef, useEffect } from "react";
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type OnConnect,
} from "@xyflow/react";
import { useFlowGraph, useSaveFlow } from "../flowApi";
import type { FlowNodeResponse, FlowEdgeResponse, SaveFlowRequest } from "../flowTypes";

// ---------------------------------------------------------------------------
// Converters: server ↔ ReactFlow
// ---------------------------------------------------------------------------

function toReactFlowNode(node: FlowNodeResponse): Node {
  return {
    id: node.id,
    type: node.type,
    position: { x: node.position_x, y: node.position_y },
    data: { ...node.data },
  };
}

function toReactFlowEdge(edge: FlowEdgeResponse): Edge {
  return {
    id: edge.id,
    source: edge.source_id,
    target: edge.target_id,
    label: edge.label ?? undefined,
    data: { condition: edge.condition, sort_order: edge.sort_order },
  };
}

function toSaveRequest(nodes: Node[], edges: Edge[]): SaveFlowRequest {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: (n.type ?? "phase") as FlowNodeResponse["type"],
      data: n.data as FlowNodeResponse["data"],
      position_x: n.position.x,
      position_y: n.position.y,
    })),
    edges: edges.map((e, i) => ({
      id: e.id,
      source_id: e.source,
      target_id: e.target,
      condition: (e.data as { condition?: Record<string, unknown> } | undefined)?.condition ?? null,
      label: typeof e.label === "string" ? e.label : null,
      sort_order: i,
    })),
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFlowData(themeId: string) {
  const { data, isLoading } = useFlowGraph(themeId);
  const saveFlow = useSaveFlow(themeId);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialNodes: Node[] = (data?.nodes ?? []).map(toReactFlowNode);
  const initialEdges: Edge[] = (data?.edges ?? []).map(toReactFlowEdge);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when server data changes
  useEffect(() => {
    if (data) {
      setNodes(data.nodes.map(toReactFlowNode));
      setEdges(data.edges.map(toReactFlowEdge));
    }
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
      // After state update, schedule save
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

  return {
    nodes,
    edges,
    onNodesChange: handleNodesChange,
    onEdgesChange: handleEdgesChange,
    onConnect,
    isLoading,
    isSaving: saveFlow.isPending,
    save,
  };
}
