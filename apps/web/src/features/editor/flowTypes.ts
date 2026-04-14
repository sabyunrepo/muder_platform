// ---------------------------------------------------------------------------
// Flow Graph Types
// ---------------------------------------------------------------------------

export type FlowNodeType = "start" | "phase" | "branch" | "ending";

export interface PhaseAction {
  id?: string;
  type: string;
  params?: Record<string, unknown>;
}

export interface FlowNodeData {
  label?: string;
  phase_type?: string;
  duration?: number;
  rounds?: number;
  description?: string;
  score_multiplier?: number;
  default_edge_id?: string;
  autoAdvance?: boolean;
  warningAt?: number;
  onEnter?: PhaseAction[];
  onExit?: PhaseAction[];
}

export interface FlowNodeResponse {
  id: string;
  theme_id: string;
  type: FlowNodeType;
  data: FlowNodeData;
  position_x: number;
  position_y: number;
  created_at: string;
  updated_at: string;
}

export interface FlowEdgeResponse {
  id: string;
  theme_id: string;
  source_id: string;
  target_id: string;
  condition: Record<string, unknown> | null;
  label: string | null;
  sort_order: number;
  created_at: string;
}

export interface FlowGraphResponse {
  nodes: FlowNodeResponse[];
  edges: FlowEdgeResponse[];
}

export interface SaveFlowRequest {
  nodes: Omit<FlowNodeResponse, "created_at" | "updated_at" | "theme_id">[];
  edges: Omit<FlowEdgeResponse, "created_at" | "theme_id">[];
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const flowKeys = {
  all: ["flow"] as const,
  graph: (themeId: string) => [...flowKeys.all, "graph", themeId] as const,
};
