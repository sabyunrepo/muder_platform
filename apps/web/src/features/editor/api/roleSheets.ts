import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";
import { editorKeys } from "./keys";
import type { RoleSheetResponse, UpsertRoleSheetRequest } from "./types";

export function useCharacterRoleSheet(characterId: string) {
  return useQuery<RoleSheetResponse>({
    queryKey: editorKeys.characterRoleSheet(characterId),
    queryFn: () => api.get<RoleSheetResponse>(`/v1/editor/characters/${characterId}/role-sheet`),
    enabled: !!characterId,
  });
}

export function useUpsertCharacterRoleSheet(characterId: string) {
  return useMutation<RoleSheetResponse, Error, UpsertRoleSheetRequest>({
    mutationFn: (data) =>
      api.put<RoleSheetResponse>(`/v1/editor/characters/${characterId}/role-sheet`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.characterRoleSheet(characterId) });
    },
  });
}
