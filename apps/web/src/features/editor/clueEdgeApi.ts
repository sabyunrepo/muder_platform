import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";

// ---------------------------------------------------------------------------
// Types (matches apps/server/internal/domain/editor/types.go ClueEdgeGroup*)
// ---------------------------------------------------------------------------

export type EdgeTrigger = "AUTO" | "CRAFT";
export type EdgeMode = "AND" | "OR";

export interface ClueEdgeGroupRequest {
  targetId: string;
  sources: string[];
  trigger: EdgeTrigger;
  mode: EdgeMode;
}

export interface ClueEdgeGroupResponse {
  id: string;
  targetId: string;
  sources: string[];
  trigger: EdgeTrigger;
  mode: EdgeMode;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const clueEdgeKeys = {
  all: ["clue-edges"] as const,
  edges: (themeId: string) => [...clueEdgeKeys.all, themeId] as const,
};

// ---------------------------------------------------------------------------
// Queries / Mutations
// ---------------------------------------------------------------------------

export function useClueEdges(themeId: string) {
  return useQuery<ClueEdgeGroupResponse[]>({
    queryKey: clueEdgeKeys.edges(themeId),
    queryFn: () =>
      api.get<ClueEdgeGroupResponse[]>(
        `/v1/editor/themes/${themeId}/clue-edges`,
      ),
    enabled: !!themeId,
  });
}

export function useSaveClueEdges(themeId: string) {
  return useMutation<
    ClueEdgeGroupResponse[],
    Error,
    ClueEdgeGroupRequest[]
  >({
    mutationFn: (body) =>
      api.put<ClueEdgeGroupResponse[]>(
        `/v1/editor/themes/${themeId}/clue-edges`,
        body,
      ),
  });
}
