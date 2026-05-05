import { describe, expect, it } from 'vitest';
import {
  EDITOR_ROUTE_MATRIX,
  readDesignSubTabFromRouteSegment,
  readEditorTabFromRouteSegment,
} from '../routeSegments';

describe('editor route segment matrix', () => {
  it.each(EDITOR_ROUTE_MATRIX)(
    '$path 직접 URL을 올바른 editor tab으로 매핑한다',
    ({ routeSegment, editorTab }) => {
      expect(readEditorTabFromRouteSegment(routeSegment)).toBe(editorTab);
    }
  );

  it.each(EDITOR_ROUTE_MATRIX.filter((entry) => entry.editorTab === 'design'))(
    '$path 직접 URL을 올바른 design subtab으로 매핑한다',
    ({ routeSegment, designSubTab }) => {
      expect(readDesignSubTabFromRouteSegment(routeSegment)).toBe(designSubTab);
    }
  );

  it('알 수 없는 segment는 제작 흐름의 안전한 기본 화면으로 되돌린다', () => {
    expect(readEditorTabFromRouteSegment('unknown')).toBe('storyMap');
    expect(readDesignSubTabFromRouteSegment('unknown')).toBe('modules');
  });
});
