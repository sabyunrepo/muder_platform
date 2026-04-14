import type { Node, Edge, Connection } from "@xyflow/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FlowNodeType = "start" | "phase" | "branch" | "ending";

// Allowed outgoing targets per node type
const ALLOWED_TARGETS: Record<FlowNodeType, FlowNodeType[]> = {
  start: ["phase", "branch"],
  phase: ["phase", "branch", "ending"],
  branch: ["phase", "branch", "ending"],
  ending: [],
};

// ---------------------------------------------------------------------------
// Cycle detection (DFS)
// ---------------------------------------------------------------------------

export function wouldCreateCycle(
  nodes: Node[],
  edges: Edge[],
  connection: Connection,
): boolean {
  if (!connection.source || !connection.target) return false;

  // Self-loop
  if (connection.source === connection.target) return true;

  // Build adjacency from existing edges + the candidate connection
  const adj: Map<string, string[]> = new Map(nodes.map((n) => [n.id, []]));

  for (const edge of edges) {
    adj.get(edge.source)?.push(edge.target);
  }
  adj.get(connection.source)?.push(connection.target);

  // DFS from target — if we can reach source, adding this edge creates a cycle
  const visited = new Set<string>();
  const stack = [connection.target];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === connection.source) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const neighbors = adj.get(current) ?? [];
    for (const neighbor of neighbors) {
      stack.push(neighbor);
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Type constraint validation
// ---------------------------------------------------------------------------

export function isValidConnection(
  nodes: Node[],
  edges: Edge[],
  connection: Connection,
): boolean {
  if (!connection.source || !connection.target) return false;

  // Self-connection
  if (connection.source === connection.target) return false;

  // Cycle check
  if (wouldCreateCycle(nodes, edges, connection)) return false;

  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);
  if (!sourceNode || !targetNode) return false;

  const sourceType = sourceNode.type as FlowNodeType | undefined;
  const targetType = targetNode.type as FlowNodeType | undefined;
  if (!sourceType || !targetType) return false;

  const allowed = ALLOWED_TARGETS[sourceType];
  if (!allowed) return false;

  return allowed.includes(targetType);
}
