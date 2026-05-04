import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiError } from '@mmp/shared';
import { toast } from 'sonner';

import { captureApiError } from '@/lib/sentry';
import { getErrorReference, showErrorToast } from '@/lib/show-error-toast';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/lib/sentry', () => ({
  captureApiError: vi.fn(),
}));

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

beforeEach(() => {
  vi.clearAllMocks();
});

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

  it('request_id가 비어 있으면 trace_id로 대체한다', () => {
    const ref = getErrorReference(apiError({ request_id: '   ', trace_id: 'trace-987654321' }));

    expect(ref).toBe('trace-98');
  });

  it('표시 가능한 추적 ID가 없으면 undefined를 반환한다', () => {
    expect(getErrorReference(apiError({}))).toBeUndefined();
  });
});

describe('showErrorToast', () => {
  it('4xx 에러는 5초 토스트와 request_id 참조를 표시한다', () => {
    showErrorToast(apiError({ request_id: 'request-123456789' }));

    expect(toast.error).toHaveBeenCalledWith('잘못된 요청입니다.', {
      description: 'Ref: request-',
      duration: 5000,
    });
    expect(captureApiError).not.toHaveBeenCalled();
  });

  it('5xx 에러는 Sentry에 캡처하고 수동 닫기 토스트로 표시한다', () => {
    showErrorToast(
      apiError({
        status: 500,
        title: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
        detail: 'server failed',
        trace_id: 'trace-987654321',
      })
    );

    expect(captureApiError).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(
      '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      {
        description: 'Ref: trace-98',
        duration: Infinity,
      }
    );
  });
});
