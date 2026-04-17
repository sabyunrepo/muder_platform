import { useCallback, useEffect, useRef } from "react";
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type OnConnect,
} from "@xyflow/react";
import { toast } from "sonner";
import type { ClueResponse } from "@/features/editor/api";
import {
  useClueEdges,
  useSaveClueEdges,
  clueEdgeKeys,
  type ClueEdgeGroupRequest,
  type ClueEdgeGroupResponse,
  type EdgeMode,
  type EdgeTrigger,
} from "../clueEdgeApi";
import { queryClient } from "@/services/queryClient";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const COLS = 4;
const COL_GAP = 200;
const ROW_GAP = 120;

// ---------------------------------------------------------------------------
// Edge data shape stored on ReactFlow edges.
// Each visual edge = one (source, target) pair belonging to exactly one
// clue_edge_group. For Phase 20 we map 1 group → 1 source → 1 visual edge;
// multi-source groups will be supported by PR-7+ once the grouping UI lands.
// ---------------------------------------------------------------------------

export interface EdgeData extends Record<string, unknown> {
  trigger: EdgeTrigger;
  mode: EdgeMode;
}

function cluesToNodes(clues: ClueResponse[]): Node[] {
  return clues.map((clue, i) => ({
    id: clue.id,
    type: "clue",
    position: {
      x: (i % COLS) * COL_GAP + 40,
      y: Math.floor(i / COLS) * ROW_GAP + 40,
    },
    data: { label: clue.name },
  }));
}

// Flatten server groups into per-source visual edges. A group with N sources
// yields N edges that share `data.groupId` (unused for now, reserved for
// future grouped-rendering).
function groupsToEdges(groups: ClueEdgeGroupResponse[]): Edge[] {
  const out: Edge[] = [];
  for (const g of groups) {
    for (let i = 0; i < g.sources.length; i++) {
      const src = g.sources[i];
      out.push({
        id: g.sources.length === 1 ? g.id : `${g.id}-${i}`,
        source: src,
        target: g.targetId,
        type: "relation",
        data: { trigger: g.trigger, mode: g.mode },
      });
    }
  }
  return out;
}

// Convert the current edge set back into payload groups. Each visual edge
// becomes its own single-source group with its (trigger, mode) pair.
function edgesToRequests(eds: Edge[]): ClueEdgeGroupRequest[] {
  return eds.map((e) => {
    const d = e.data as EdgeData | undefined;
    return {
      targetId: e.target,
      sources: [e.source],
      trigger: d?.trigger ?? "AUTO",
      mode: d?.mode ?? "AND",
    };
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useClueEdgeData(
  themeId: string,
  clues: ClueResponse[] | undefined,
) {
  const { data: groups, isLoading } = useClueEdges(themeId);
  const saveEdges = useSaveClueEdges(themeId);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    clues ? cluesToNodes(clues) : [],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    groups ? groupsToEdges(groups) : [],
  );

  useEffect(() => {
    if (clues) setNodes(cluesToNodes(clues));
  }, [clues, setNodes]);

  useEffect(() => {
    if (groups) setEdges(groupsToEdges(groups));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  const autoSave = useCallback(
    (eds: Edge[], overrides?: { onError?: (err: Error) => void }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveEdges.mutate(edgesToRequests(eds), {
          onSuccess: (saved) => {
            queryClient.setQueryData(clueEdgeKeys.edges(themeId), saved);
          },
          onError: (err) => {
            if (overrides?.onError) overrides.onError(err);
            else toast.error(err.message || "엣지 저장에 실패했습니다");
          },
        });
      }, 1000);
    },
    [saveEdges, themeId],
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      const newEdge: Edge = {
        id: `${connection.source}-${connection.target}-${Date.now()}`,
        ...connection,
        type: "relation",
        data: { trigger: "AUTO", mode: "AND" } satisfies EdgeData,
      };
      setEdges((eds) => {
        const next = addEdge(newEdge, eds);
        autoSave(next, {
          onError: (err: Error) => {
            const isCycle = err.message?.includes("EDGE_CYCLE_DETECTED");
            const isInvalidCraftOR = err.message?.includes(
              "EDGE_INVALID_CRAFT_OR",
            );
            setEdges((cur) => cur.filter((e) => e.id !== newEdge.id));
            toast.error(
              isCycle
                ? "순환 참조가 감지되어 엣지를 추가할 수 없습니다"
                : isInvalidCraftOR
                  ? "CRAFT 트리거는 OR 모드를 지원하지 않습니다"
                  : "엣지 저장에 실패했습니다",
            );
            queryClient.invalidateQueries({
              queryKey: clueEdgeKeys.edges(themeId),
            });
          },
        });
        return next;
      });
    },
    [setEdges, autoSave, themeId],
  );

  const onEdgeDelete = useCallback(
    (edgeId: string) => {
      setEdges((eds) => {
        const next = eds.filter((e) => e.id !== edgeId);
        autoSave(next);
        return next;
      });
    },
    [setEdges, autoSave],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onEdgeDelete,
    isLoading,
    isSaving: saveEdges.isPending,
  };
}
