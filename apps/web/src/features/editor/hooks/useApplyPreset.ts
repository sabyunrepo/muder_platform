import { useCallback } from "react";
import type { Node, Edge } from "@xyflow/react";

type SetNodes = React.Dispatch<React.SetStateAction<Node[]>>;
type SetEdges = React.Dispatch<React.SetStateAction<Edge[]>>;
type AutoSave = (nodes: Node[], edges: Edge[]) => void;

// ---------------------------------------------------------------------------
// useApplyPreset — 프리셋 적용 (노드/엣지 전체 교체 + autoSave)
// ---------------------------------------------------------------------------

export function useApplyPreset(
  setNodes: SetNodes,
  setEdges: SetEdges,
  autoSave: AutoSave,
) {
  const applyPreset = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      setNodes(newNodes);
      setEdges(newEdges);
      autoSave(newNodes, newEdges);
    },
    [setNodes, setEdges, autoSave],
  );

  return { applyPreset };
}
