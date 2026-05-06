import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";
import { editorKeys } from "./api/keys";

export interface StoryInfoResponse {
  id: string;
  themeId: string;
  title: string;
  body: string;
  imageMediaId?: string | null;
  relatedCharacterIds: string[];
  relatedClueIds: string[];
  relatedLocationIds: string[];
  sortOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoryInfoRequest {
  title: string;
  body: string;
  imageMediaId?: string | null;
  relatedCharacterIds: string[];
  relatedClueIds: string[];
  relatedLocationIds: string[];
  sortOrder: number;
}

export interface UpdateStoryInfoRequest {
  title?: string;
  body?: string;
  imageMediaId?: string | null;
  relatedCharacterIds?: string[];
  relatedClueIds?: string[];
  relatedLocationIds?: string[];
  sortOrder?: number;
  version: number;
}

export const storyInfoKeys = {
  all: ["story-infos"] as const,
  list: (themeId: string) => editorKeys.storyInfos(themeId),
};

export function useStoryInfos(themeId: string) {
  return useQuery<StoryInfoResponse[]>({
    queryKey: storyInfoKeys.list(themeId),
    queryFn: () =>
      api.get<StoryInfoResponse[]>(`/v1/editor/themes/${themeId}/story-infos`),
    enabled: !!themeId,
  });
}

export function useCreateStoryInfo(themeId: string) {
  return useMutation<StoryInfoResponse, Error, CreateStoryInfoRequest>({
    mutationFn: (body) =>
      api.post<StoryInfoResponse>(
        `/v1/editor/themes/${themeId}/story-infos`,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyInfoKeys.list(themeId) });
    },
  });
}

export function useUpdateStoryInfo(themeId: string) {
  return useMutation<
    StoryInfoResponse,
    Error,
    { id: string; patch: UpdateStoryInfoRequest }
  >({
    mutationFn: ({ id, patch }) =>
      api.patch<StoryInfoResponse>(`/v1/editor/story-infos/${id}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyInfoKeys.list(themeId) });
    },
  });
}

export function useDeleteStoryInfo(themeId: string) {
  return useMutation<void, Error, string>({
    mutationFn: (id) => api.deleteVoid(`/v1/editor/story-infos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyInfoKeys.list(themeId) });
    },
  });
}
