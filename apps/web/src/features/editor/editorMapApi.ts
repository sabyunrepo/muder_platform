import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";
import { editorKeys } from "./api";
import type { MapResponse, LocationResponse } from "./api";

// ---------------------------------------------------------------------------
// Map Types
// ---------------------------------------------------------------------------

export interface UpdateMapRequest {
  name?: string;
  image_url?: string;
}

export interface CreateLocationRequest {
  name: string;
  description?: string;
  restricted_characters?: string[];
}

export interface UpdateLocationRequest {
  name?: string;
  description?: string;
  restricted_characters?: string[];
}

// ---------------------------------------------------------------------------
// Map Queries
// ---------------------------------------------------------------------------

export function useEditorMaps(themeId: string) {
  return useQuery<MapResponse[]>({
    queryKey: editorKeys.maps(themeId),
    queryFn: () => api.get<MapResponse[]>(`/v1/editor/themes/${themeId}/maps`),
    enabled: !!themeId,
  });
}

// ---------------------------------------------------------------------------
// Map Mutations
// ---------------------------------------------------------------------------

export function useCreateMap(themeId: string) {
  return useMutation<MapResponse, Error, { name: string; image_url?: string }>({
    mutationFn: (body) =>
      api.post<MapResponse>(`/v1/editor/themes/${themeId}/maps`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.maps(themeId) });
    },
  });
}

export function useUpdateMap(themeId: string) {
  return useMutation<MapResponse, Error, { mapId: string; body: UpdateMapRequest }>({
    mutationFn: ({ mapId, body }) =>
      api.put<MapResponse>(`/v1/editor/maps/${mapId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.maps(themeId) });
    },
  });
}

export function useDeleteMap(themeId: string) {
  return useMutation<void, Error, string>({
    mutationFn: (mapId) => api.deleteVoid(`/v1/editor/maps/${mapId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.maps(themeId) });
      queryClient.invalidateQueries({ queryKey: editorKeys.locations(themeId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Location Queries
// ---------------------------------------------------------------------------

export function useEditorLocations(themeId: string) {
  return useQuery<LocationResponse[]>({
    queryKey: editorKeys.locations(themeId),
    queryFn: () =>
      api.get<LocationResponse[]>(`/v1/editor/themes/${themeId}/locations`),
    enabled: !!themeId,
  });
}

// ---------------------------------------------------------------------------
// Location Mutations
// ---------------------------------------------------------------------------

export function useCreateLocation(themeId: string) {
  return useMutation<LocationResponse, Error, { mapId: string; body: CreateLocationRequest }>({
    mutationFn: ({ mapId, body }) =>
      api.post<LocationResponse>(
        `/v1/editor/themes/${themeId}/maps/${mapId}/locations`,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.locations(themeId) });
    },
  });
}

export function useUpdateLocation(themeId: string) {
  return useMutation<LocationResponse, Error, { locationId: string; body: UpdateLocationRequest }>({
    mutationFn: ({ locationId, body }) =>
      api.put<LocationResponse>(`/v1/editor/locations/${locationId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.locations(themeId) });
    },
  });
}

export function useDeleteLocation(themeId: string) {
  return useMutation<void, Error, string>({
    mutationFn: (locationId) =>
      api.deleteVoid(`/v1/editor/locations/${locationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.locations(themeId) });
    },
  });
}
