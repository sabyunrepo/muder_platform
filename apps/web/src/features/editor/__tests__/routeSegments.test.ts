import { describe, expect, it } from 'vitest';
import {
  buildEditorRouteForTab,
  EDITOR_ROUTE_MATRIX,
  readEditorTabFromRouteSegment,
} from '../routeSegments';

describe('editor route segment matrix', () => {
  it.each(EDITOR_ROUTE_MATRIX)(
    '$path 직접 URL을 올바른 editor tab으로 매핑한다',
    ({ routeSegment, editorTab }) => {
      expect(readEditorTabFromRouteSegment(routeSegment)).toBe(editorTab);
    }
  );

  it('알 수 없는 segment는 제작 흐름의 안전한 기본 화면으로 되돌린다', () => {
    expect(readEditorTabFromRouteSegment('unknown')).toBe('storyMap');
  });

  it.each([
    ['storyMap', '/editor/theme-1'],
    ['info', '/editor/theme-1/info'],
    ['story', '/editor/theme-1/reading'],
    ['characters', '/editor/theme-1/characters'],
    ['clues', '/editor/theme-1/clues'],
    ['design', '/editor/theme-1/design'],
    ['endings', '/editor/theme-1/endings'],
    ['locations', '/editor/theme-1/locations'],
    ['media', '/editor/theme-1/media'],
    ['overview', '/editor/theme-1/overview'],
    ['template', '/editor/theme-1/template'],
    ['advanced', '/editor/theme-1/advanced'],
  ] as const)('%s 탭의 canonical URL을 만든다', (tab, expectedPath) => {
    const route = buildEditorRouteForTab('theme-1', tab);
    const routeSegment = route.split('/').slice(3).join('/') || undefined;

    expect(route).toBe(expectedPath);
    expect(readEditorTabFromRouteSegment(routeSegment)).toBe(tab);
  });

  it('theme id를 URL segment로 안전하게 인코딩한다', () => {
    expect(buildEditorRouteForTab('theme/with space', 'characters')).toBe(
      '/editor/theme%2Fwith%20space/characters',
    );
  });

  it.each([
    ['design/flow', 'storyMap'],
    ['flow', 'storyMap'],
    ['design/endings', 'endings'],
    ['endings', 'endings'],
    ['design/locations', 'locations'],
    ['locations', 'locations'],
    ['design/modules', 'design'],
    ['modules', 'design'],
  ] as const)('legacy segment %s를 새 상위 탭 구조로 매핑한다', (segment, expectedTab) => {
    expect(readEditorTabFromRouteSegment(segment)).toBe(expectedTab);
  });
});
