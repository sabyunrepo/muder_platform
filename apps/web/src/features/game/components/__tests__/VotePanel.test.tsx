import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PlayerRole, WsEventType } from '@mmp/shared';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockModuleData, mockPlayers, mockMyPlayerId } = vi.hoisted(() => ({
  mockModuleData: {} as Record<string, unknown>,
  mockPlayers: [] as Array<{
    id: string;
    nickname: string;
    displayName?: string;
    isAlive: boolean;
    isHost: boolean;
    isReady: boolean;
    role: null | string;
    connectedAt: number;
  }>,
  mockMyPlayerId: 'player-1',
}));

// ---------------------------------------------------------------------------
// Mock: gameStore
// ---------------------------------------------------------------------------

vi.mock('@/stores/gameSessionStore', () => ({
  useGameSessionStore: (selector: (s: unknown) => unknown) => {
    const state = {
      players: mockPlayers,
      myPlayerId: mockMyPlayerId,
    };
    return selector(state);
  },
}));

vi.mock('@/stores/gameSelectors', () => ({
  selectPlayers: (s: { players: unknown[] }) => s.players,
  selectMyPlayerId: (s: { myPlayerId: string }) => s.myPlayerId,
}));

// ---------------------------------------------------------------------------
// Mock: moduleStoreFactory
// ---------------------------------------------------------------------------

vi.mock('@/stores/moduleStoreFactory', () => ({
  useModuleStore: (
    _moduleId: string,
    selector?: (s: { data: Record<string, unknown> }) => unknown
  ) => {
    const state = { data: mockModuleData };
    return selector ? selector(state) : state;
  },
}));

// ---------------------------------------------------------------------------
// Mock: useCountUp (VoteResultChart 의존) — 절대 경로 사용
// ---------------------------------------------------------------------------

vi.mock('@/features/game/hooks/useCountUp', () => ({
  useCountUp: (value: number) => value,
}));

// ---------------------------------------------------------------------------
// 테스트 대상
// ---------------------------------------------------------------------------

import { VotePanel } from '../VotePanel';
import { VotingPanel } from '../VotingPanel';

// ---------------------------------------------------------------------------
// 픽스처
// ---------------------------------------------------------------------------

const PLAYERS = [
  {
    id: 'player-1',
    nickname: '나',
    isAlive: true,
    isHost: true,
    isReady: true,
    role: null,
    connectedAt: 0,
  },
  {
    id: 'player-2',
    nickname: '앨리스',
    isAlive: true,
    isHost: false,
    isReady: true,
    role: null,
    connectedAt: 0,
  },
  {
    id: 'player-3',
    nickname: '밥',
    isAlive: true,
    isHost: false,
    isReady: true,
    role: null,
    connectedAt: 0,
  },
];

// ---------------------------------------------------------------------------
// 테스트
// ---------------------------------------------------------------------------

describe('VotePanel', () => {
  const mockSend = vi.fn();

  beforeEach(() => {
    Object.keys(mockModuleData).forEach((k) => delete mockModuleData[k]);
    mockPlayers.length = 0;
    mockPlayers.push(...PLAYERS);
    mockSend.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('헤더에 투표 아이콘과 제목을 렌더링한다', () => {
    render(<VotePanel send={mockSend} moduleId="vote" />);
    expect(screen.getByRole('heading', { name: '투표' })).toBeTruthy();
  });

  it('자신을 제외한 생존 플레이어 목록을 렌더링한다', () => {
    render(<VotePanel send={mockSend} moduleId="vote" />);
    expect(screen.getByText('앨리스')).toBeTruthy();
    expect(screen.getByText('밥')).toBeTruthy();
    expect(screen.queryByText('나')).toBeNull();
  });

  it('backend가 준 캐릭터 표시명이 있으면 투표 후보에 표시한다', () => {
    mockPlayers.splice(1, 1, {
      ...PLAYERS[1],
      displayName: '가면 쓴 증인',
    });

    render(<VotePanel send={mockSend} moduleId="vote" />);

    expect(screen.getByText('가면 쓴 증인')).toBeTruthy();
    expect(screen.queryByText('앨리스')).toBeNull();
  });

  it('투표 버튼 클릭 시 GAME_ACTION vote를 전송한다', () => {
    render(<VotePanel send={mockSend} moduleId="vote" />);
    const btns = screen.getAllByRole('button', { name: /투표/ });
    fireEvent.click(btns[0]);
    expect(mockSend).toHaveBeenCalledWith(WsEventType.GAME_ACTION, {
      type: 'vote',
      targetId: 'player-2',
    });
  });

  it('투표 후 같은 버튼을 다시 클릭해도 send를 재호출하지 않는다', () => {
    render(<VotePanel send={mockSend} moduleId="vote" />);
    const btns = screen.getAllByRole('button', { name: /투표/ });
    fireEvent.click(btns[0]);
    fireEvent.click(btns[0]);
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("투표 완료 후 Badge '투표 완료'를 표시한다", () => {
    render(<VotePanel send={mockSend} moduleId="vote" />);
    const btns = screen.getAllByRole('button', { name: /투표/ });
    fireEvent.click(btns[0]);
    expect(screen.getByText('투표 완료')).toBeTruthy();
  });

  it('results가 배열이면 투표 결과 차트를 렌더링한다', () => {
    mockModuleData.results = [
      { playerId: 'player-2', nickname: '앨리스', votes: 3 },
      { playerId: 'player-3', nickname: '밥', votes: 1 },
    ];
    render(<VotePanel send={mockSend} moduleId="vote" />);
    expect(screen.getByText('투표 결과')).toBeTruthy();
    expect(screen.getByText('앨리스')).toBeTruthy();
    expect(screen.getByText('밥')).toBeTruthy();
  });

  it('backend 표시명이 있으면 VotePanel 투표 결과에도 표시한다', () => {
    mockPlayers.splice(1, 1, {
      ...PLAYERS[1],
      displayName: '정체를 숨긴 목격자',
    });
    mockModuleData.results = [{ playerId: 'player-2', nickname: '앨리스', votes: 3 }];

    render(<VotePanel send={mockSend} moduleId="vote" />);

    expect(screen.getByText('정체를 숨긴 목격자')).toBeTruthy();
    expect(screen.queryByText('앨리스')).toBeNull();
  });

  it('results가 null이면 비밀 투표 안내를 표시한다', () => {
    mockModuleData.results = null;
    render(<VotePanel send={mockSend} moduleId="vote" />);
    expect(screen.getByText(/비밀 투표/)).toBeTruthy();
  });

  it("생존 플레이어가 자신뿐이면 '투표 가능한 플레이어가 없습니다'를 표시한다", () => {
    mockPlayers.length = 0;
    mockPlayers.push({
      id: 'player-1',
      nickname: '나',
      isAlive: true,
      isHost: true,
      isReady: true,
      role: null,
      connectedAt: 0,
    });
    render(<VotePanel send={mockSend} moduleId="vote" />);
    expect(screen.getByText('투표 가능한 플레이어가 없습니다')).toBeTruthy();
  });

  it('candidatePolicy.includeDetective=false면 탐정을 후보에서 제외한다', () => {
    mockPlayers.length = 0;
    mockPlayers.push(
      {
        id: 'player-1',
        nickname: '나',
        isAlive: true,
        isHost: true,
        isReady: true,
        role: null,
        connectedAt: 0,
      },
      {
        id: 'player-2',
        nickname: '탐정',
        isAlive: true,
        isHost: false,
        isReady: true,
        role: PlayerRole.DETECTIVE,
        connectedAt: 0,
      },
      {
        id: 'player-3',
        nickname: '용의자',
        isAlive: true,
        isHost: false,
        isReady: true,
        role: PlayerRole.CIVILIAN,
        connectedAt: 0,
      }
    );
    mockModuleData.config = { candidatePolicy: { includeDetective: false } };

    render(<VotePanel send={mockSend} moduleId="vote" />);

    expect(screen.queryByText('탐정')).toBeNull();
    expect(screen.getByText('용의자')).toBeTruthy();
    expect(screen.getByText('탐정 1명은 이번 투표 후보에서 제외됩니다.')).toBeTruthy();
  });

  it('candidatePolicy.includeDetective=true면 탐정도 후보에 포함한다', () => {
    mockPlayers.length = 0;
    mockPlayers.push(
      {
        id: 'player-1',
        nickname: '나',
        isAlive: true,
        isHost: true,
        isReady: true,
        role: null,
        connectedAt: 0,
      },
      {
        id: 'player-2',
        nickname: '탐정',
        isAlive: true,
        isHost: false,
        isReady: true,
        role: PlayerRole.DETECTIVE,
        connectedAt: 0,
      }
    );
    mockModuleData.config = { candidatePolicy: { includeDetective: true } };

    render(<VotePanel send={mockSend} moduleId="vote" />);

    expect(screen.getByText('탐정')).toBeTruthy();
    expect(screen.queryByText(/탐정 1명은/)).toBeNull();
  });
});

describe('VotingPanel', () => {
  const mockSend = vi.fn();

  beforeEach(() => {
    Object.keys(mockModuleData).forEach((k) => delete mockModuleData[k]);
    mockPlayers.length = 0;
    mockPlayers.push(...PLAYERS);
    mockSend.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('후보 클릭 시 GAME_ACTION vote를 전송하고 투표 완료 상태를 표시한다', () => {
    render(<VotingPanel send={mockSend} moduleId="vote" />);

    fireEvent.click(screen.getAllByRole('button', { name: '투표' })[0]);

    expect(mockSend).toHaveBeenCalledWith(WsEventType.GAME_ACTION, {
      type: 'vote',
      targetId: 'player-2',
    });
    expect(screen.getByText('투표 완료')).toBeTruthy();
    expect(screen.getByText('선택됨')).toBeTruthy();
  });

  it('탐정 제외 정책으로 후보가 없으면 정책 안내와 빈 상태를 표시한다', () => {
    mockPlayers.length = 0;
    mockPlayers.push(
      {
        id: 'player-1',
        nickname: '나',
        isAlive: true,
        isHost: true,
        isReady: true,
        role: null,
        connectedAt: 0,
      },
      {
        id: 'player-2',
        nickname: '탐정',
        isAlive: true,
        isHost: false,
        isReady: true,
        role: PlayerRole.DETECTIVE,
        connectedAt: 0,
      }
    );
    mockModuleData.config = { candidatePolicy: { includeDetective: false } };

    render(<VotingPanel send={mockSend} moduleId="vote" />);

    expect(screen.getByText('탐정 1명은 이번 투표 후보에서 제외됩니다.')).toBeTruthy();
    expect(screen.getByText('탐정 제외 정책 때문에 투표 가능한 플레이어가 없습니다')).toBeTruthy();
    expect(screen.queryByText('탐정')).toBeNull();
  });

  it('결과가 공개되면 낮은 득표 순으로 결과 막대를 렌더링한다', () => {
    mockModuleData.results = [
      { playerId: 'player-2', nickname: '앨리스', votes: 3 },
      { playerId: 'player-3', nickname: '밥', votes: 1 },
    ];

    render(<VotingPanel send={mockSend} moduleId="vote" />);

    expect(screen.getByText('투표 결과')).toBeTruthy();
    expect(screen.getAllByText(/\d+표/).map((el) => el.textContent)).toEqual(['1표', '3표']);
  });

  it('backend 표시명이 있으면 VotingPanel 후보와 결과에 표시한다', () => {
    mockPlayers.splice(1, 1, {
      ...PLAYERS[1],
      displayName: '가면 쓴 용의자',
    });

    render(<VotingPanel send={mockSend} moduleId="vote" />);

    expect(screen.getByText('가면 쓴 용의자')).toBeTruthy();
    expect(screen.queryByText('앨리스')).toBeNull();

    cleanup();
    mockModuleData.results = [{ playerId: 'player-2', nickname: '앨리스', votes: 3 }];

    render(<VotingPanel send={mockSend} moduleId="vote" />);

    expect(screen.getByText('가면 쓴 용의자')).toBeTruthy();
    expect(screen.queryByText('앨리스')).toBeNull();
  });
});
