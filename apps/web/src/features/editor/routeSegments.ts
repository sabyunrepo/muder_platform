import type { EditorTab } from './constants';

export type DesignSubTab = 'modules' | 'flow' | 'locations' | 'endings';

export interface EditorRouteMatrixEntry {
  path: string;
  routeSegment?: string;
  editorTab: EditorTab;
  designSubTab?: DesignSubTab;
  alias?: boolean;
}

const EDITOR_ROUTE_TAB_MAP: Record<string, EditorTab> = {
  overview: 'overview',
  design: 'design',
  story: 'story',
  characters: 'characters',
  clues: 'clues',
  relations: 'clues',
  modules: 'design',
  flow: 'design',
  locations: 'design',
  endings: 'design',
  media: 'media',
  advanced: 'advanced',
  templates: 'template',
  template: 'template',
};

const DESIGN_ROUTE_SUBTAB_MAP: Record<string, DesignSubTab> = {
  design: 'modules',
  modules: 'modules',
  flow: 'flow',
  locations: 'locations',
  endings: 'endings',
};

export const EDITOR_ROUTE_MATRIX = [
  { path: '/editor/:id', editorTab: 'overview' },
  { path: '/editor/:id/story', routeSegment: 'story', editorTab: 'story' },
  { path: '/editor/:id/characters', routeSegment: 'characters', editorTab: 'characters' },
  { path: '/editor/:id/clues', routeSegment: 'clues', editorTab: 'clues' },
  { path: '/editor/:id/relations', routeSegment: 'relations', editorTab: 'clues' },
  {
    path: '/editor/:id/design/modules',
    routeSegment: 'modules',
    editorTab: 'design',
    designSubTab: 'modules',
  },
  {
    path: '/editor/:id/design/flow',
    routeSegment: 'flow',
    editorTab: 'design',
    designSubTab: 'flow',
  },
  {
    path: '/editor/:id/design/locations',
    routeSegment: 'locations',
    editorTab: 'design',
    designSubTab: 'locations',
  },
  {
    path: '/editor/:id/design/endings',
    routeSegment: 'endings',
    editorTab: 'design',
    designSubTab: 'endings',
  },
  { path: '/editor/:id/media', routeSegment: 'media', editorTab: 'media' },
  {
    path: '/editor/:id/modules',
    routeSegment: 'modules',
    editorTab: 'design',
    designSubTab: 'modules',
    alias: true,
  },
  {
    path: '/editor/:id/flow',
    routeSegment: 'flow',
    editorTab: 'design',
    designSubTab: 'flow',
    alias: true,
  },
  {
    path: '/editor/:id/locations',
    routeSegment: 'locations',
    editorTab: 'design',
    designSubTab: 'locations',
    alias: true,
  },
  {
    path: '/editor/:id/endings',
    routeSegment: 'endings',
    editorTab: 'design',
    designSubTab: 'endings',
    alias: true,
  },
] as const satisfies readonly EditorRouteMatrixEntry[];

export function readEditorTabFromRouteSegment(routeSegment?: string): EditorTab {
  if (!routeSegment) return 'overview';
  return EDITOR_ROUTE_TAB_MAP[routeSegment] ?? 'overview';
}

export function readDesignSubTabFromRouteSegment(routeSegment?: string): DesignSubTab {
  if (!routeSegment) return 'modules';
  return DESIGN_ROUTE_SUBTAB_MAP[routeSegment] ?? 'modules';
}
