import type { EditorTab } from "./constants";

export type DesignSubTab = "modules" | "flow" | "locations" | "endings";

const EDITOR_ROUTE_TAB_MAP: Record<string, EditorTab> = {
  overview: "overview",
  story: "story",
  characters: "characters",
  clues: "clues",
  relations: "clues",
  modules: "design",
  flow: "design",
  locations: "design",
  endings: "design",
  media: "media",
  advanced: "advanced",
  templates: "template",
  template: "template",
};

const DESIGN_ROUTE_SUBTAB_MAP: Record<string, DesignSubTab> = {
  modules: "modules",
  flow: "flow",
  locations: "locations",
  endings: "endings",
};

export function readEditorTabFromRouteSegment(routeSegment?: string): EditorTab {
  if (!routeSegment) return "overview";
  return EDITOR_ROUTE_TAB_MAP[routeSegment] ?? "overview";
}

export function readDesignSubTabFromRouteSegment(routeSegment?: string): DesignSubTab {
  if (!routeSegment) return "modules";
  return DESIGN_ROUTE_SUBTAB_MAP[routeSegment] ?? "modules";
}
