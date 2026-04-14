import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";
import type {
  FlowGraphResponse,
  SaveFlowRequest,
  FlowNodeResponse,
  FlowEdgeResponse,
} from "./flowTypes";
import { flowKeys } from "./flowTypes";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useFlowGraph(themeId: string) {
  return useQuery<FlowGraphResponse>({
    queryKey: flowKeys.graph(themeId),
    queryFn: () =>
      api.get<FlowGraphResponse>(`/v1/editor/themes/${themeId}/flow`),
    enabled: !!themeId,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function invalidateGraph(themeId: string) {
  queryClient.invalidateQueries({ queryKey: flowKeys.graph(themeId) });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useSaveFlow(themeId: string) {
  return useMutation<FlowGraphResponse, Error, SaveFlowRequest>({
    mutationFn: (body) =>
      api.put<FlowGraphResponse>(`/v1/editor/themes/${themeId}/flow`, body),
    onSuccess: () => invalidateGraph(themeId),
  });
}

export function useCreateFlowNode(themeId: string) {
  return useMutation<
    FlowNodeResponse,
    Error,
    Omit<FlowNodeResponse, "id" | "theme_id" | "created_at" | "updated_at">
  >({
    mutationFn: (body) =>
      api.post<FlowNodeResponse>(
        `/v1/editor/themes/${themeId}/flow/nodes`,
        body,
      ),
    onSuccess: () => invalidateGraph(themeId),
  });
}

export function useUpdateFlowNode(themeId: string) {
  return useMutation<
    FlowNodeResponse,
    Error,
    { nodeId: string; body: Partial<FlowNodeResponse> }
  >({
    mutationFn: ({ nodeId, body }) =>
      api.put<FlowNodeResponse>(
        `/v1/editor/themes/${themeId}/flow/nodes/${nodeId}`,
        body,
      ),
    onSuccess: () => invalidateGraph(themeId),
  });
}

export function useDeleteFlowNode(themeId: string) {
  return useMutation<void, Error, string>({
    mutationFn: (nodeId) =>
      api.deleteVoid(`/v1/editor/themes/${themeId}/flow/nodes/${nodeId}`),
    onSuccess: () => invalidateGraph(themeId),
  });
}

export function useCreateFlowEdge(themeId: string) {
  return useMutation<
    FlowEdgeResponse,
    Error,
    Omit<FlowEdgeResponse, "id" | "theme_id" | "created_at">
  >({
    mutationFn: (body) =>
      api.post<FlowEdgeResponse>(
        `/v1/editor/themes/${themeId}/flow/edges`,
        body,
      ),
    onSuccess: () => invalidateGraph(themeId),
  });
}

export function useUpdateFlowEdge(themeId: string) {
  return useMutation<
    FlowEdgeResponse,
    Error,
    { edgeId: string; body: Partial<FlowEdgeResponse> }
  >({
    mutationFn: ({ edgeId, body }) =>
      api.put<FlowEdgeResponse>(
        `/v1/editor/themes/${themeId}/flow/edges/${edgeId}`,
        body,
      ),
    onSuccess: () => invalidateGraph(themeId),
  });
}

export function useDeleteFlowEdge(themeId: string) {
  return useMutation<void, Error, string>({
    mutationFn: (edgeId) =>
      api.deleteVoid(`/v1/editor/themes/${themeId}/flow/edges/${edgeId}`),
    onSuccess: () => invalidateGraph(themeId),
  });
}
