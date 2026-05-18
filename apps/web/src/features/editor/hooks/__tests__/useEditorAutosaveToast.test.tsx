import { act, cleanup, renderHook } from '@testing-library/react';
import type { ApiError } from '@mmp/shared';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiHttpError } from '@/lib/api-error';
import { useEditorAutosaveToast } from '../useEditorAutosaveToast';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    loading: vi.fn(),
    success: vi.fn(),
  },
}));

function apiError(overrides: Partial<ApiError>): ApiError {
  return {
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    detail: 'raw backend failure',
    code: 'INTERNAL_ERROR',
    ...overrides,
  };
}

describe('useEditorAutosaveToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('uses ApiHttpError user message and keeps retry action on autosave failure', async () => {
    const mutate = vi.fn(
      (_body: { title: string }, opts: { onError: (error?: unknown) => void }) => {
        opts.onError(
          new ApiHttpError(
            apiError({
              user_message: '장면 설정을 저장하지 못했습니다. 최신 내용으로 다시 시도해주세요.',
              request_id: 'request-scene-save',
              severity: 'high',
            })
          )
        );
      }
    );
    const { result } = renderHook(() =>
      useEditorAutosaveToast<{ title: string }>({
        debounceMs: 500,
        messages: {
          toastId: 'scene-autosave',
          loading: '장면 설정을 저장 중입니다',
          success: '장면 설정이 저장되었습니다',
          error: '장면 설정 저장에 실패했습니다',
        },
        mutate,
      })
    );

    act(() => {
      result.current.schedule({ title: '오프닝' });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(toast.error).toHaveBeenCalledWith(
      '장면 설정을 저장하지 못했습니다. 최신 내용으로 다시 시도해주세요.',
      expect.objectContaining({
        id: 'scene-autosave',
        description: '오류 ID: request-',
        duration: Infinity,
        action: expect.objectContaining({ label: '재시도' }),
      })
    );
  });
});
