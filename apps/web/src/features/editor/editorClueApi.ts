import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";
import { editorKeys } from "./api";
import type { ClueResponse, CreateClueRequest, UpdateClueRequest } from "./api";
import { clueRelationKeys } from "./clueRelationApi";

// ---------------------------------------------------------------------------
// Clue Queries
// ---------------------------------------------------------------------------

export function useEditorClues(themeId: string) {
  return useQuery<ClueResponse[]>({
    queryKey: editorKeys.clues(themeId),
    queryFn: () => api.get<ClueResponse[]>(`/v1/editor/themes/${themeId}/clues`),
    enabled: !!themeId,
  });
}

// ---------------------------------------------------------------------------
// Clue Mutations
// ---------------------------------------------------------------------------

export function useCreateClue(themeId: string) {
  return useMutation<ClueResponse, Error, CreateClueRequest>({
    mutationFn: (body) =>
      api.post<ClueResponse>(`/v1/editor/themes/${themeId}/clues`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.clues(themeId) });
      queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
    },
  });
}

export function useUpdateClue(themeId: string) {
  return useMutation<ClueResponse, Error, { clueId: string; body: UpdateClueRequest }>({
    mutationFn: ({ clueId, body }) =>
      api.put<ClueResponse>(`/v1/editor/clues/${clueId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.clues(themeId) });
      queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
    },
  });
}

export function useDeleteClue(themeId: string) {
  return useMutation<void, Error, string>({
    mutationFn: (clueId) => api.deleteVoid(`/v1/editor/clues/${clueId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.clues(themeId) });
      queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
      // FK cascade removes clue_relations on DB side; invalidate to sync cache.
      queryClient.invalidateQueries({
        queryKey: clueRelationKeys.relations(themeId),
      });
    },
  });
}
