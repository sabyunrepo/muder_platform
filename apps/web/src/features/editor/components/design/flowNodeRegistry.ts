import { BranchNode } from "./BranchNode";
import { ConditionEdge } from "./ConditionEdge";

// ---------------------------------------------------------------------------
// Node type registry — PR-4 additions
// Spread these into ReactFlow's nodeTypes / edgeTypes props.
// PR-3 (PhaseNode) and other PRs add their own exports similarly.
// ---------------------------------------------------------------------------

export const branchNodeTypes = {
  branch: BranchNode,
} as const;

export const conditionEdgeTypes = {
  condition: ConditionEdge,
} as const;
