import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";
import { editorKeys } from "./keys";
import type {
  CreateCharacterRequest,
  EditorCharacterResponse,
  UpdateCharacterRequest,
} from "./types";

// ---------------------------------------------------------------------------
// Character Queries
// ---------------------------------------------------------------------------

export function useEditorCharacters(themeId: string) {
  return useQuery<EditorCharacterResponse[]>({
    queryKey: editorKeys.characters(themeId),
    queryFn: () => api.get<EditorCharacterResponse[]>(`/v1/editor/themes/${themeId}/characters`),
    enabled: !!themeId,
  });
}

// ---------------------------------------------------------------------------
// Character Mutations
// ---------------------------------------------------------------------------

export function useCreateCharacter(themeId: string) {
  return useMutation<EditorCharacterResponse, Error, CreateCharacterRequest>({
    mutationFn: (body) =>
      api.post<EditorCharacterResponse>(
        `/v1/editor/themes/${themeId}/characters`,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.characters(themeId) });
      queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
    },
  });
}

export function useUpdateCharacter(themeId: string) {
  return useMutation<
    EditorCharacterResponse,
    Error,
    { characterId: string; body: UpdateCharacterRequest }
  >({
    mutationFn: ({ characterId, body }) =>
      api.put<EditorCharacterResponse>(
        `/v1/editor/characters/${characterId}`,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.characters(themeId) });
      queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
    },
  });
}

export function useDeleteCharacter(themeId: string) {
  return useMutation<void, Error, string>({
    mutationFn: (characterId) =>
      api.deleteVoid(`/v1/editor/characters/${characterId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.characters(themeId) });
      queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
    },
  });
}
