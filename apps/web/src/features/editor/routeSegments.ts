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
  'story-map': 'storyMap',
  overview: 'overview',
  design: 'design',
  story: 'storyMap',
  characters: 'characters',
  clues: 'clues',
  relations: 'clues',
  modules: 'design',
  flow: 'storyMap',
  'design/modules': 'design',
  'design/flow': 'design',
  'design/locations': 'design',
  'design/endings': 'design',
  locations: 'design',
  endings: 'design',
  media: 'media',
  advanced: 'advanced',
  templates: 'template',
  template: 'template',
};

const DESIGN_ROUTE_SUBTAB_MAP: Record<string, DesignSubTab> = {
  design: 'modules',
  'design/modules': 'modules',
  modules: 'modules',
  'design/flow': 'flow',
  flow: 'flow',
  'design/locations': 'locations',
  locations: 'locations',
  'design/endings': 'endings',
  endings: 'endings',
};

const EDITOR_TAB_ROUTE_SEGMENTS: Record<EditorTab, string | undefined> = {
  storyMap: undefined,
  story: 'story',
  characters: 'characters',
  clues: 'clues',
  design: 'design/modules',
  media: 'media',
  overview: 'overview',
  template: 'template',
  advanced: 'advanced',
};

export const EDITOR_ROUTE_MATRIX = [
  { path: '/editor/:id', editorTab: 'storyMap' },
  { path: '/editor/:id/story-map', routeSegment: 'story-map', editorTab: 'storyMap', alias: true },
  { path: '/editor/:id/story', routeSegment: 'story', editorTab: 'storyMap' },
  { path: '/editor/:id/characters', routeSegment: 'characters', editorTab: 'characters' },
  { path: '/editor/:id/clues', routeSegment: 'clues', editorTab: 'clues' },
  { path: '/editor/:id/relations', routeSegment: 'relations', editorTab: 'clues' },
  { path: '/editor/:id/overview', routeSegment: 'overview', editorTab: 'overview' },
  { path: '/editor/:id/template', routeSegment: 'template', editorTab: 'template' },
  { path: '/editor/:id/templates', routeSegment: 'templates', editorTab: 'template', alias: true },
  { path: '/editor/:id/advanced', routeSegment: 'advanced', editorTab: 'advanced' },
  {
    path: '/editor/:id/design/modules',
    routeSegment: 'design/modules',
    editorTab: 'design',
    designSubTab: 'modules',
  },
  {
    path: '/editor/:id/design/flow',
    routeSegment: 'design/flow',
    editorTab: 'design',
    designSubTab: 'flow',
  },
  {
    path: '/editor/:id/design/locations',
    routeSegment: 'design/locations',
    editorTab: 'design',
    designSubTab: 'locations',
  },
  {
    path: '/editor/:id/design/endings',
    routeSegment: 'design/endings',
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
    editorTab: 'storyMap',
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
  if (!routeSegment) return 'storyMap';
  return EDITOR_ROUTE_TAB_MAP[routeSegment] ?? 'storyMap';
}

export function readDesignSubTabFromRouteSegment(routeSegment?: string): DesignSubTab {
  if (!routeSegment) return 'modules';
  return DESIGN_ROUTE_SUBTAB_MAP[routeSegment] ?? 'modules';
}

export function buildEditorRouteForTab(themeId: string, tab: EditorTab): string {
  const encodedThemeId = encodeURIComponent(themeId);
  const segment = EDITOR_TAB_ROUTE_SEGMENTS[tab];
  return segment ? `/editor/${encodedThemeId}/${segment}` : `/editor/${encodedThemeId}`;
}
