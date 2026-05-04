import { useCallback } from "react";
import type { Edge } from "@xyflow/react";
import { isCompleteConditionGroupRecord } from "../components/design/condition/conditionTypes";

type SetEdges = React.Dispatch<React.SetStateAction<Edge[]>>;
type GetEdges = () => Edge[];
type AutoSave = (nodes: unknown[], edges: Edge[]) => void;

// ---------------------------------------------------------------------------
// useEdgeCondition — edge condition 업데이트 + autoSave
// ---------------------------------------------------------------------------

export function useEdgeCondition(
  setEdges: SetEdges,
  getNodes: () => unknown[],
  getEdges: GetEdges,
  autoSave: AutoSave,
) {
  const updateEdgeCondition = useCallback(
    (edgeId: string, condition: Record<string, unknown>) => {
      const shouldAutoSave = isCompleteConditionGroupRecord(condition);
      let changed = false;
      const next = getEdges().map((e) => {
        if (e.id !== edgeId) return e;
        changed = true;
        return { ...e, data: { ...e.data, condition }, type: "condition" };
      });

      if (!changed) return;

      setEdges(next);
      if (shouldAutoSave) {
        autoSave(getNodes(), next);
      }
    },
    [setEdges, getNodes, getEdges, autoSave],
  );

  return { updateEdgeCondition };
}
