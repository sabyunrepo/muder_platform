import { useCallback } from "react";
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import type { EditorThemeResponse } from "@/features/editor/api";
import { useUpdateConfigJson } from "@/features/editor/api";
import { useAutoSave } from "./useAutoSave";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  phaseType?: string;
}

export type FlowNode = Node<FlowNodeData>;
export type FlowEdge = Edge;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadNodes(theme: EditorThemeResponse): FlowNode[] {
  const cfg = theme.config_json ?? {};
  return Array.isArray(cfg.flow_nodes) ? (cfg.flow_nodes as FlowNode[]) : [];
}

function loadEdges(theme: EditorThemeResponse): FlowEdge[] {
  const cfg = theme.config_json ?? {};
  return Array.isArray(cfg.flow_edges) ? (cfg.flow_edges as FlowEdge[]) : [];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFlowData(themeId: string, theme: EditorThemeResponse) {
  const updateConfig = useUpdateConfigJson(themeId);

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(
    loadNodes(theme),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(
    loadEdges(theme),
  );

  const mutationFn = useCallback(
    async (data: { nodes: FlowNode[]; edges: FlowEdge[] }) => {
      const current = theme.config_json ?? {};
      return updateConfig.mutateAsync({
        ...current,
        flow_nodes: data.nodes,
        flow_edges: data.edges,
      });
    },
    [theme.config_json, updateConfig],
  );

  const { status, save } = useAutoSave({
    data: { nodes, edges },
    mutationFn,
    debounceMs: 1500,
  });

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      save();
    },
    [onNodesChange, save],
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);
      save();
    },
    [onEdgesChange, save],
  );

  const handleConnect: OnConnect = useCallback(
    (connection) => {
      setEdges((eds) => addEdge(connection, eds));
      save();
    },
    [setEdges, save],
  );

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange: handleNodesChange,
    onEdgesChange: handleEdgesChange,
    onConnect: handleConnect,
    saveStatus: status,
  };
}
