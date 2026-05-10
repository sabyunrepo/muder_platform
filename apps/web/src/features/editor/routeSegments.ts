import type { EditorTab } from './constants';

export interface EditorRouteMatrixEntry {
  path: string;
  routeSegment?: string;
  editorTab: EditorTab;
  alias?: boolean;
}

const EDITOR_ROUTE_TAB_MAP: Record<string, EditorTab> = {
  'story-map': 'storyMap',
  story: 'storyMap',
  reading: 'story',
  overview: 'overview',
  design: 'design',
  info: 'info',
  characters: 'characters',
  clues: 'clues',
  relations: 'clues',
  modules: 'design',
  flow: 'storyMap',
  'design/modules': 'design',
  'design/flow': 'storyMap',
  'design/locations': 'locations',
  'design/endings': 'endings',
  locations: 'locations',
  questions: 'questions',
  endings: 'endings',
  media: 'media',
  advanced: 'advanced',
  templates: 'overview',
  template: 'overview',
};

const EDITOR_TAB_ROUTE_SEGMENTS: Record<EditorTab, string | undefined> = {
  storyMap: undefined,
  info: 'info',
  story: 'reading',
  characters: 'characters',
  clues: 'clues',
  design: 'design',
  questions: 'questions',
  endings: 'endings',
  locations: 'locations',
  media: 'media',
  overview: 'overview',
  advanced: 'advanced',
};

export const EDITOR_ROUTE_MATRIX = [
  { path: '/editor/:id', editorTab: 'storyMap' },
  { path: '/editor/:id/story-map', routeSegment: 'story-map', editorTab: 'storyMap', alias: true },
  { path: '/editor/:id/story', routeSegment: 'story', editorTab: 'storyMap' },
  { path: '/editor/:id/info', routeSegment: 'info', editorTab: 'info' },
  { path: '/editor/:id/reading', routeSegment: 'reading', editorTab: 'story' },
  { path: '/editor/:id/characters', routeSegment: 'characters', editorTab: 'characters' },
  { path: '/editor/:id/clues', routeSegment: 'clues', editorTab: 'clues' },
  { path: '/editor/:id/relations', routeSegment: 'relations', editorTab: 'clues' },
  { path: '/editor/:id/overview', routeSegment: 'overview', editorTab: 'overview' },
  { path: '/editor/:id/template', routeSegment: 'template', editorTab: 'overview', alias: true },
  { path: '/editor/:id/templates', routeSegment: 'templates', editorTab: 'overview', alias: true },
  { path: '/editor/:id/advanced', routeSegment: 'advanced', editorTab: 'advanced' },
  {
    path: '/editor/:id/design/modules',
    routeSegment: 'design/modules',
    editorTab: 'design',
    alias: true,
  },
  {
    path: '/editor/:id/design/flow',
    routeSegment: 'design/flow',
    editorTab: 'storyMap',
    alias: true,
  },
  {
    path: '/editor/:id/design/locations',
    routeSegment: 'design/locations',
    editorTab: 'locations',
    alias: true,
  },
  {
    path: '/editor/:id/design/endings',
    routeSegment: 'design/endings',
    editorTab: 'endings',
    alias: true,
  },
  {
    path: '/editor/:id/questions',
    routeSegment: 'questions',
    editorTab: 'questions',
  },
  { path: '/editor/:id/media', routeSegment: 'media', editorTab: 'media' },
  {
    path: '/editor/:id/modules',
    routeSegment: 'modules',
    editorTab: 'design',
    alias: true,
  },
  {
    path: '/editor/:id/flow',
    routeSegment: 'flow',
    editorTab: 'storyMap',
    alias: true,
  },
  {
    path: '/editor/:id/locations',
    routeSegment: 'locations',
    editorTab: 'locations',
  },
  {
    path: '/editor/:id/endings',
    routeSegment: 'endings',
    editorTab: 'endings',
  },
] as const satisfies readonly EditorRouteMatrixEntry[];

export function readEditorTabFromRouteSegment(routeSegment?: string): EditorTab {
  if (!routeSegment) return 'storyMap';
  return EDITOR_ROUTE_TAB_MAP[routeSegment] ?? 'storyMap';
}

export function buildEditorRouteForTab(themeId: string, tab: EditorTab): string {
  const encodedThemeId = encodeURIComponent(themeId);
  const segment = EDITOR_TAB_ROUTE_SEGMENTS[tab];
  return segment ? `/editor/${encodedThemeId}/${segment}` : `/editor/${encodedThemeId}`;
}
