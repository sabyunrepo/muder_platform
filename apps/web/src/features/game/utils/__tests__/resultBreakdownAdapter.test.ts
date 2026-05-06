import { describe, expect, it } from 'vitest';
import { PlayerRole, type Player } from '@mmp/shared';

import {
  buildResultBreakdownViewModel,
  playerDisplayName,
  playerDisplayNameById,
  readEndingBranchResult,
  readVoteBreakdown,
} from '../resultBreakdownAdapter';

const players: Player[] = [
  {
    id: 'p1',
    nickname: '한서윤',
    role: PlayerRole.CIVILIAN,
    isAlive: true,
    isHost: false,
    isReady: true,
    connectedAt: 1,
  },
  {
    id: 'p2',
    nickname: '강도윤',
    displayName: '가면 쓴 탐정',
    role: PlayerRole.DETECTIVE,
    isAlive: true,
    isHost: false,
    isReady: true,
    connectedAt: 2,
  },
];

describe('resultBreakdownAdapter', () => {
  it('reads backend lastResult and builds creator-safe vote labels', () => {
    const vote = readVoteBreakdown({
      lastResult: {
        results: { p1: 3, p2: 1 },
        winner: 'p1',
        outcome: 'winner',
        round: 2,
        totalVotes: 4,
        eligibleVoters: 5,
        participationPct: 80,
      },
    });
    const ending = readEndingBranchResult({
      result: { selectedEnding: '진실의 밤', matchedPriority: 1, myScore: 3 },
    });

    const vm = buildResultBreakdownViewModel({ players, vote, ending });

    expect(vm.endingTitle).toBe('진실의 밤');
    expect(vm.endingReason).toContain('우선순위 1번');
    expect(vm.myScoreLabel).toBe('내 결말 점수 3점');
    expect(vm.voteTitle).toBe('2라운드 투표 결과');
    expect(vm.voteSummary).toContain('한서윤');
    expect(vm.voteMeta).toEqual(['총 4표', '투표 가능 5명', '참여율 80%']);
    expect(vm.voteItems[0]).toMatchObject({ label: '한서윤', votes: 3, isWinner: true });
  });

  it('explains insufficient participation without exposing raw JSON', () => {
    const vote = readVoteBreakdown({
      results: { p1: 1 },
      outcome: 'insufficient_participation',
      totalVotes: 1,
      eligibleVoters: 4,
      participationPct: 25,
      abstainCount: 1,
    });

    const vm = buildResultBreakdownViewModel({ players, vote, ending: null });

    expect(vm.endingTitle).toBe('결말 판정 대기 중');
    expect(vm.voteSummary).toBe('투표 참여 인원이 부족해서 결과가 확정되지 않았어요.');
    expect(vm.voteMeta).toContain('기권 1표');
  });

  it('marks tie candidates and uses safe fallback label when player is unknown', () => {
    const vote = readVoteBreakdown({
      results: { p1: 2, char_unknown: 2 },
      outcome: 'tie',
      tieCandidates: ['p1', 'char_unknown'],
    });

    const vm = buildResultBreakdownViewModel({ players, vote, ending: null });

    expect(vm.voteSummary).toContain('동률');
    expect(vm.voteItems).toEqual([
      expect.objectContaining({
        id: 'char_unknown',
        label: '알 수 없는 대상',
        isTieCandidate: true,
      }),
      expect.objectContaining({ id: 'p1', label: '한서윤', isTieCandidate: true }),
    ]);
  });

  it('uses backend-resolved character display names before account nicknames', () => {
    const vote = readVoteBreakdown({
      results: { p2: 4 },
      winner: 'p2',
      outcome: 'winner',
    });

    const vm = buildResultBreakdownViewModel({ players, vote, ending: null });

    expect(vm.voteSummary).toContain('가면 쓴 탐정');
    expect(vm.voteItems[0]).toMatchObject({ id: 'p2', label: '가면 쓴 탐정' });
  });

  it('trims display names and falls back to nicknames or caller labels', () => {
    expect(playerDisplayName({ ...players[1], displayName: '  비밀 탐정  ' })).toBe('비밀 탐정');
    expect(playerDisplayName({ ...players[0], displayName: '   ' })).toBe('한서윤');
    expect(playerDisplayNameById(players, 'missing', '알 수 없음')).toBe('알 수 없음');
  });

  it('returns null before backend exposes a result', () => {
    expect(readVoteBreakdown({ isOpen: true })).toBeNull();
    expect(readEndingBranchResult({ evaluated: false })).toBeNull();
  });
});
