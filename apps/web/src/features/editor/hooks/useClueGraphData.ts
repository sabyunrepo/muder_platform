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
  useClueRelations,
  useSaveClueRelations,
  clueRelationKeys,
  type ClueRelationRequest,
  type ClueRelationResponse,
} from "../clueRelationApi";
import { queryClient } from "@/services/queryClient";

// ---------------------------------------------------------------------------
// Converters
// ---------------------------------------------------------------------------

const COLS = 4;
const COL_GAP = 200;
const ROW_GAP = 120;

function cluesToNodes(clues: ClueResponse[]): Node[] {
  return clues.map((clue, i) => ({
    id: clue.id,
    type: "clue",
    position: {
      x: (i % COLS) * COL_GAP + 40,
      y: Math.floor(i / COLS) * ROW_GAP + 40,
    },
    data: { label: clue.name, clueType: clue.type },
  }));
}

function relationsToEdges(relations: ClueRelationResponse[]): Edge[] {
  return relations.map((r) => ({
    id: r.id,
    source: r.sourceId,
    target: r.targetId,
    type: "relation",
    data: { mode: r.mode },
  }));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useClueGraphData(
  themeId: string,
  clues: ClueResponse[] | undefined,
) {
  const { data: relations, isLoading } = useClueRelations(themeId);
  const saveRelations = useSaveClueRelations(themeId);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    clues ? cluesToNodes(clues) : [],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    relations ? relationsToEdges(relations) : [],
  );

  // Sync clues → nodes when data arrives
  useEffect(() => {
    if (clues) {
      setNodes(cluesToNodes(clues));
    }
  }, [clues, setNodes]);

  // Sync relations → edges when data arrives
  useEffect(() => {
    if (relations) {
      setEdges(relationsToEdges(relations));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relations]);

  const buildRequests = useCallback(
    (eds: Edge[]): ClueRelationRequest[] =>
      eds.map((e) => ({
        sourceId: e.source,
        targetId: e.target,
        mode: (e.data as { mode?: "AND" | "OR" } | undefined)?.mode ?? "AND",
      })),
    [],
  );

  const autoSave = useCallback(
    (eds: Edge[], overrides?: { onError?: (err: Error) => void }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveRelations.mutate(buildRequests(eds), {
          onSuccess: (saved) => {
            queryClient.setQueryData(
              clueRelationKeys.relations(themeId),
              saved,
            );
          },
          onError: (err) => {
            if (overrides?.onError) {
              overrides.onError(err);
            } else {
              toast.error(err.message || "관계 저장에 실패했습니다");
            }
          },
        });
      }, 1000);
    },
    [saveRelations, buildRequests, themeId],
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      // Optimistic add — revert on CYCLE_DETECTED (400)
      const newEdge: Edge = {
        id: `${connection.source}-${connection.target}-${Date.now()}`,
        ...connection,
        type: "relation",
        data: { mode: "AND" },
      };
      setEdges((eds) => {
        const next = addEdge(newEdge, eds);
        autoSave(next, {
          onError: (err: Error) => {
            const isCycle = err.message?.includes("CYCLE_DETECTED");
            setEdges((cur) => cur.filter((e) => e.id !== newEdge.id));
            toast.error(
              isCycle
                ? "순환 참조가 감지되어 관계를 추가할 수 없습니다"
                : "관계 저장에 실패했습니다",
            );
            queryClient.invalidateQueries({
              queryKey: clueRelationKeys.relations(themeId),
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
    isSaving: saveRelations.isPending,
  };
}
