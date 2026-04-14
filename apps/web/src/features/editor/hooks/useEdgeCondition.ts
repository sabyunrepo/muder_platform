import { useCallback } from "react";
import type { Edge } from "@xyflow/react";

type SetEdges = React.Dispatch<React.SetStateAction<Edge[]>>;
type AutoSave = (nodes: unknown[], edges: Edge[]) => void;

// ---------------------------------------------------------------------------
// useEdgeCondition — edge condition 업데이트 + autoSave
// ---------------------------------------------------------------------------

export function useEdgeCondition(
  setEdges: SetEdges,
  getNodes: () => unknown[],
  autoSave: AutoSave,
) {
  const updateEdgeCondition = useCallback(
    (edgeId: string, condition: Record<string, unknown>) => {
      setEdges((eds) => {
        const next = eds.map((e) =>
          e.id === edgeId
            ? { ...e, data: { ...e.data, condition }, type: "condition" }
            : e,
        );
        autoSave(getNodes(), next);
        return next;
      });
    },
    [setEdges, getNodes, autoSave],
  );

  return { updateEdgeCondition };
}
