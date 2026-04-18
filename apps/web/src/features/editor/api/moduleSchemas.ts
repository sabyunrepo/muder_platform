import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { editorKeys } from "./keys";
import type { ModuleSchemasResponse } from "./types";

// ---------------------------------------------------------------------------
// Module Schemas
// ---------------------------------------------------------------------------

export function useModuleSchemas() {
  return useQuery<ModuleSchemasResponse>({
    queryKey: editorKeys.moduleSchemas(),
    queryFn: () => api.get<ModuleSchemasResponse>("/v1/editor/module-schemas"),
    staleTime: 5 * 60 * 1000, // schemas are static; cache for 5 min
  });
}
