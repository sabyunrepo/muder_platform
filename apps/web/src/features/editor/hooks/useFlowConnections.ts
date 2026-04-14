import { useCallback } from "react";
import type { Node, Edge, Connection } from "@xyflow/react";
import { isValidConnection as validateConnection } from "./connectionValidation";

// ---------------------------------------------------------------------------
// useFlowConnections
// ---------------------------------------------------------------------------

interface UseFlowConnectionsOptions {
  nodes: Node[];
  edges: Edge[];
}

interface UseFlowConnectionsResult {
  isValidConnection: (connection: Connection) => boolean;
}

/**
 * Provides a memoized `isValidConnection` callback for @xyflow/react's
 * <ReactFlow> component. Validates both type constraints and cycle prevention.
 */
export function useFlowConnections({
  nodes,
  edges,
}: UseFlowConnectionsOptions): UseFlowConnectionsResult {
  const isValidConnection = useCallback(
    (connection: Connection) => validateConnection(nodes, edges, connection),
    [nodes, edges],
  );

  return { isValidConnection };
}
