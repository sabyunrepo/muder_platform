import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { RoomPlayer } from '@/features/lobby/api';
import { PlayerList } from '../PlayerList';

afterEach(() => {
  cleanup();
});

const players: RoomPlayer[] = [
  {
    id: 'player-host',
    user_id: 'host-1',
    nickname: '호스트',
    avatar_url: null,
    is_host: true,
    is_ready: true,
    character_id: 'detective',
    joined_at: '2026-05-19T00:00:00Z',
  },
  {
    id: 'player-current',
    user_id: 'user-1',
    nickname: '나참가자',
    avatar_url: null,
    is_host: false,
    is_ready: true,
    character_id: 'doctor',
    joined_at: '2026-05-19T00:00:00Z',
  },
  {
    id: 'player-pending',
    user_id: 'user-2',
    nickname: '미정참가자',
    avatar_url: null,
    is_host: false,
    is_ready: false,
    character_id: null,
    joined_at: '2026-05-19T00:00:00Z',
  },
];

describe('PlayerList', () => {
  it('renders player role, current user, character, ready state, and empty slots', () => {
    render(
      <PlayerList
        players={players}
        maxPlayers={4}
        currentUserId="user-1"
        characterNameById={
          new Map([
            ['detective', '탐정'],
            ['doctor', '의사'],
          ])
        }
      />
    );

    expect(screen.getAllByText('호스트')).toHaveLength(2);
    expect(screen.getAllByText('나').length).toBeGreaterThan(0);
    expect(screen.getByText('탐정')).toBeInTheDocument();
    expect(screen.getByText('의사')).toBeInTheDocument();
    expect(screen.getByText('캐릭터 미선택')).toBeInTheDocument();
    expect(screen.getByText('준비 완료')).toBeInTheDocument();
    expect(screen.getByText('미준비')).toBeInTheDocument();
    expect(screen.getAllByLabelText('준비 완료')).toHaveLength(1);
    expect(screen.getAllByLabelText('미준비')).toHaveLength(1);
    expect(screen.getByText('빈 자리')).toBeInTheDocument();
    expect(screen.queryByText('대기')).not.toBeInTheDocument();
    expect(screen.queryByText('음소거')).not.toBeInTheDocument();
    expect(screen.queryByText('말하는 중')).not.toBeInTheDocument();
  });
});
