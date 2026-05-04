import { describe, expect, it } from 'vitest';
import type { ApiError } from '@mmp/shared';

import { getErrorReference } from '@/lib/show-error-toast';

function apiError(overrides: Partial<ApiError>): ApiError {
  return {
    type: 'about:blank',
    title: 'Bad Request',
    status: 400,
    detail: 'bad request',
    code: 'BAD_REQUEST',
    ...overrides,
  };
}

describe('getErrorReference', () => {
  it('request_id를 trace_id보다 우선 표시한다', () => {
    const ref = getErrorReference(
      apiError({
        request_id: 'request-123456789',
        trace_id: 'trace-987654321',
      })
    );

    expect(ref).toBe('request-');
  });

  it('request_id가 없으면 trace_id를 표시한다', () => {
    const ref = getErrorReference(apiError({ trace_id: 'trace-987654321' }));

    expect(ref).toBe('trace-98');
  });

  it('표시 가능한 추적 ID가 없으면 undefined를 반환한다', () => {
    expect(getErrorReference(apiError({}))).toBeUndefined();
  });
});
