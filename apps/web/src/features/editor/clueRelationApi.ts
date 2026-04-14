import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClueRelationRequest {
  sourceId: string;
  targetId: string;
  mode: "AND" | "OR";
}

export interface ClueRelationResponse {
  id: string;
  sourceId: string;
  targetId: string;
  mode: "AND" | "OR";
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const clueRelationKeys = {
  all: ["clue-relations"] as const,
  relations: (themeId: string) =>
    [...clueRelationKeys.all, themeId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useClueRelations(themeId: string) {
  return useQuery<ClueRelationResponse[]>({
    queryKey: clueRelationKeys.relations(themeId),
    queryFn: () =>
      api.get<ClueRelationResponse[]>(
        `/v1/editor/themes/${themeId}/clue-relations`,
      ),
    enabled: !!themeId,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useSaveClueRelations(themeId: string) {
  return useMutation<ClueRelationResponse[], Error, ClueRelationRequest[]>({
    mutationFn: (body) =>
      api.put<ClueRelationResponse[]>(
        `/v1/editor/themes/${themeId}/clue-relations`,
        body,
      ),
  });
}
