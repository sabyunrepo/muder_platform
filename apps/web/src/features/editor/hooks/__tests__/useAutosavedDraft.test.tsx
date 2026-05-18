import { act, cleanup, renderHook } from '@testing-library/react';
import type { ApiError } from '@mmp/shared';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiHttpError } from '@/lib/api-error';
import { useAutosavedDraft } from '../useAutosavedDraft';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    loading: vi.fn(),
    success: vi.fn(),
  },
}));

interface ServerValue {
  id: string;
  title: string;
  version: number;
}

interface DraftValue {
  title: string;
  version: number;
}

function toDraft(value: ServerValue): DraftValue {
  return { title: value.title, version: value.version };
}

function isEqual(left: DraftValue, right: DraftValue) {
  return left.title === right.title && left.version === right.version;
}

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

describe('useAutosavedDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('preserves a dirty draft when the same entity refetches stale server data', () => {
    const save = vi.fn().mockResolvedValue({ id: 'info-1', title: '지도', version: 2 });
    const { result, rerender } = renderHook(
      ({ serverValue }: { serverValue: ServerValue }) =>
        useAutosavedDraft<ServerValue, DraftValue, DraftValue>({
          serverValue,
          serverKey: serverValue.id,
          debounceMs: 1000,
          toDraft,
          isEqual,
          buildSaveBody: (draft) => draft,
          save,
        }),
      {
        initialProps: {
          serverValue: { id: 'info-1', title: '지', version: 1 },
        },
      }
    );

    act(() => {
      result.current.setDraft({ title: '지도', version: 1 });
    });
    rerender({ serverValue: { id: 'info-1', title: '지', version: 1 } });

    expect(result.current.draft.title).toBe('지도');
    expect(result.current.isDirty).toBe(true);
  });

  it('accepts server data when there are no local changes', () => {
    const save = vi.fn().mockResolvedValue({ id: 'info-1', title: '지도', version: 2 });
    const { result, rerender } = renderHook(
      ({ serverValue }: { serverValue: ServerValue }) =>
        useAutosavedDraft<ServerValue, DraftValue, DraftValue>({
          serverValue,
          serverKey: serverValue.id,
          debounceMs: 1000,
          toDraft,
          isEqual,
          buildSaveBody: (draft) => draft,
          save,
        }),
      {
        initialProps: {
          serverValue: { id: 'info-1', title: '지', version: 1 },
        },
      }
    );

    rerender({ serverValue: { id: 'info-1', title: '지도', version: 2 } });

    expect(result.current.draft).toEqual({ title: '지도', version: 2 });
    expect(result.current.baseline).toEqual({ title: '지도', version: 2 });
    expect(result.current.isDirty).toBe(false);
  });

  it('clears dirty state only for the draft that was submitted', async () => {
    const serverValue = { id: 'info-1', title: '', version: 1 };
    const save = vi.fn().mockResolvedValue({ id: 'info-1', title: '지', version: 2 });
    const { result } = renderHook(() =>
      useAutosavedDraft<ServerValue, DraftValue, DraftValue>({
        serverValue,
        serverKey: 'info-1',
        debounceMs: 1000,
        toDraft,
        isEqual,
        buildSaveBody: (draft) => draft,
        save,
      })
    );

    act(() => {
      result.current.setDraft({ title: '지', version: 1 });
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      result.current.setDraft({ title: '지도', version: 1 });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.draft.title).toBe('지도');
    expect(result.current.isDirty).toBe(true);
  });

  it('saveNow flushes the current draft immediately', async () => {
    const serverValue = { id: 'info-1', title: '', version: 1 };
    const save = vi.fn().mockResolvedValue({ id: 'info-1', title: '즉시 저장', version: 2 });
    const { result } = renderHook(() =>
      useAutosavedDraft<ServerValue, DraftValue, DraftValue>({
        serverValue,
        serverKey: 'info-1',
        debounceMs: 1000,
        toDraft,
        isEqual,
        buildSaveBody: (draft) => draft,
        save,
      })
    );

    act(() => {
      result.current.setDraft({ title: '즉시 저장', version: 1 });
    });
    act(() => {
      result.current.saveNow();
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ title: '즉시 저장', version: 1 });
  });

  it('shows ApiHttpError user message and reference when autosave fails', async () => {
    const serverValue = { id: 'info-1', title: '', version: 1 };
    const save = vi.fn().mockRejectedValue(
      new ApiHttpError(
        apiError({
          user_message: '정보 저장 중 충돌이 발생했습니다. 새로고침 후 다시 시도해주세요.',
          request_id: 'request-autosave-123',
          severity: 'high',
        })
      )
    );
    const { result } = renderHook(() =>
      useAutosavedDraft<ServerValue, DraftValue, DraftValue>({
        serverValue,
        serverKey: 'info-1',
        debounceMs: 1000,
        toDraft,
        isEqual,
        buildSaveBody: (draft) => draft,
        save,
        messages: {
          toastId: 'info-autosave',
          loading: '정보를 저장 중입니다',
          success: '정보가 저장되었습니다',
          error: '정보 저장에 실패했습니다',
        },
      })
    );

    act(() => {
      result.current.setDraft({ title: '지도', version: 1 });
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(toast.error).toHaveBeenCalledWith(
      '정보 저장 중 충돌이 발생했습니다. 새로고침 후 다시 시도해주세요.',
      expect.objectContaining({
        id: 'info-autosave',
        description: '오류 ID: request-',
        duration: Infinity,
        action: expect.objectContaining({ label: '재시도' }),
      })
    );
  });
});
