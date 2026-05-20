import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const invalidateSpy = vi.fn();

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('@/services/queryClient', () => ({
  queryClient: {
    invalidateQueries: (...args: unknown[]) => invalidateSpy(...args),
  },
}));

import { api } from '@/services/api';
import {
  roomKeys,
  useInviteRoomFriends,
  useRoom,
  useSelectRoomCharacter,
  useSetReady,
  useStartRoom,
  useThemeCharacters,
} from './api';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  invalidateSpy.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('lobby pregame mutations', () => {
  it('useRoom fetches participant-only room detail', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      id: 'room-1',
      code: 'ABC123',
      players: [],
    });
    const { result } = renderHook(() => useRoom('room-1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith('/v1/rooms/room-1/me');
  });

  it('useThemeCharacters fetches public theme character summaries', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      {
        id: 'character-1',
        name: '탐정',
        description: '진실을 좇는 손님',
        image_url: null,
        image_media_id: null,
        sort_order: 1,
      },
    ]);
    const { result } = renderHook(() => useThemeCharacters('theme-1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith('/v1/themes/theme-1/characters');
    expect(result.current.data?.[0]?.name).toBe('탐정');
  });

  it('useSelectRoomCharacter puts character_id and invalidates room detail/list', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ status: 'selected' });
    const { result } = renderHook(() => useSelectRoomCharacter(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        roomId: 'room-1',
        characterId: 'character-1',
      });
    });

    expect(api.put).toHaveBeenCalledWith('/v1/rooms/room-1/character', {
      character_id: 'character-1',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: roomKeys.detail('room-1'),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: roomKeys.list(),
    });
  });

  it('useSetReady posts is_ready and invalidates room detail/list', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ status: 'ready updated' });
    const { result } = renderHook(() => useSetReady(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ roomId: 'room-1', is_ready: true });
    });

    expect(api.post).toHaveBeenCalledWith('/v1/rooms/room-1/ready', {
      is_ready: true,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: roomKeys.detail('room-1'),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: roomKeys.list(),
    });
  });

  it('useStartRoom posts to start endpoint and invalidates room detail/list', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ status: 'started' });
    const { result } = renderHook(() => useStartRoom(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync('room-1');
    });

    expect(api.post).toHaveBeenCalledWith('/v1/rooms/room-1/start', {});
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: roomKeys.detail('room-1'),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: roomKeys.list(),
    });
  });

  it('useInviteRoomFriends posts friend_ids to room invites endpoint', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      sent: [{ friend_id: 'friend-1', nickname: '민재', online: true }],
      skipped: [{ friend_id: 'friend-2', reason: 'already_invited' }],
    });
    const { result } = renderHook(() => useInviteRoomFriends(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        roomId: 'room-1',
        friend_ids: ['friend-1', 'friend-2'],
      });
    });

    expect(api.post).toHaveBeenCalledWith('/v1/rooms/room-1/invites', {
      friend_ids: ['friend-1', 'friend-2'],
    });
  });
});
