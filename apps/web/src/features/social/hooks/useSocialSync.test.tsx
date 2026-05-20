import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { toast } from 'sonner';

import { queryClient } from '@/services/queryClient';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSocialStore } from '@/stores/socialStore';
import { socialKeys } from '../api';
import { useSocialSync } from './useSocialSync';

vi.mock('sonner', () => ({
  toast: vi.fn(),
}));

function makeClient() {
  const handlers = new Map<string, (payload: unknown) => void>();
  return {
    handlers,
    client: {
      on: vi.fn((event: string, handler: (payload: unknown) => void) => {
        handlers.set(event, handler);
        return vi.fn();
      }),
    },
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useConnectionStore.setState({ socialClient: null });
  useSocialStore.getState().reset();
  queryClient.clear();
});

describe('useSocialSync room invites', () => {
  it('room:invite 이벤트를 받으면 새로고침 없이 방으로 이동하는 액션이 있는 toast를 표시한다', () => {
    const { client, handlers } = makeClient();
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
    useConnectionStore.setState({ socialClient: client as never });

    renderHook(() => useSocialSync());

    handlers.get('room:invite')?.({
      room_id: 'room-1',
      code: 'ABC123',
      theme_title: '초대받지 않은 손님',
      inviter_id: 'host-1',
      inviter_nickname: '호스트',
    });

    expect(toast).toHaveBeenCalledWith(
      '호스트님이 초대받지 않은 손님 방에 초대했습니다.',
      expect.objectContaining({
        description: '방 코드 ABC123',
        action: expect.objectContaining({ label: '입장' }),
      })
    );
    const options = vi.mocked(toast).mock.calls[0]?.[1] as { action?: { onClick?: () => void } };
    options.action?.onClick?.();
    expect(pushStateSpy).toHaveBeenCalledWith({}, '', '/room/room-1');
    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'popstate' }));
  });
});

describe('useSocialSync existing social events', () => {
  it('friend online/offline 이벤트를 social store에 반영한다', () => {
    const { client, handlers } = makeClient();
    useConnectionStore.setState({ socialClient: client as never });

    renderHook(() => useSocialSync());

    handlers.get('friend:online')?.({ user_id: 'friend-1' });
    expect(useSocialStore.getState().onlineFriends.has('friend-1')).toBe(true);

    handlers.get('friend:offline')?.({ user_id: 'friend-1' });
    expect(useSocialStore.getState().onlineFriends.has('friend-1')).toBe(false);
  });

  it('chat message/read receipt 이벤트가 unread와 query invalidation을 유지한다', () => {
    const { client, handlers } = makeClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    useConnectionStore.setState({ socialClient: client as never });

    renderHook(() => useSocialSync());

    handlers.get('chat:message')?.({ chat_room_id: 'chat-1', sender_id: 'friend-1' });
    expect(useSocialStore.getState().unreadCounts.get('chat-1')).toBe(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: socialKeys.messages('chat-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: socialKeys.chatRooms() });

    handlers.get('chat:read_receipt')?.({});
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: socialKeys.chatRooms() });
  });
});
