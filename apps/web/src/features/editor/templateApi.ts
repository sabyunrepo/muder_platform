import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateSummary {
  id: string;
  genre: string;
  name: string;
  description: string;
  min_players: number;
  max_players: number;
  duration_min: number;
}

export interface TemplateDetail extends TemplateSummary {
  preset_count: number;
  modules: string[];
  created_at: string;
}

export interface JSONSchemaProperty {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  title?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

export interface TemplateSchema {
  $schema?: string;
  title?: string;
  description?: string;
  type: "object";
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const templateKeys = {
  all: ["templates"] as const,
  list: () => [...templateKeys.all, "list"] as const,
  detail: (id: string) => [...templateKeys.all, id] as const,
  schema: (id: string) => [...templateKeys.all, id, "schema"] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useTemplates() {
  return useQuery<TemplateSummary[]>({
    queryKey: templateKeys.list(),
    queryFn: () => api.get<TemplateSummary[]>("/v1/templates"),
  });
}

export function useTemplate(id: string) {
  return useQuery<TemplateDetail>({
    queryKey: templateKeys.detail(id),
    queryFn: () => api.get<TemplateDetail>(`/v1/templates/${id}`),
    enabled: !!id,
  });
}

export function useTemplateSchema(id: string) {
  return useQuery<TemplateSchema>({
    queryKey: templateKeys.schema(id),
    queryFn: () => api.get<TemplateSchema>(`/v1/templates/${id}/schema`),
    enabled: !!id,
  });
}
