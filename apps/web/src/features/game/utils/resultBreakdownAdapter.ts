import type { Player } from '@mmp/shared';

export type VoteOutcome = 'winner' | 'tie' | 'no_result' | 'insufficient_participation';

export interface VoteBreakdownResult {
  results: Record<string, number>;
  winner?: string;
  isTie?: boolean;
  round?: number;
  outcome?: VoteOutcome;
  totalVotes?: number;
  abstainCount?: number;
  eligibleVoters?: number;
  participationPct?: number;
  tieCandidates?: string[];
}

export interface EndingBranchResult {
  selectedEnding?: string;
  matchedPriority?: number;
  myScore?: number;
}

export interface ResultVoteItem {
  id: string;
  label: string;
  votes: number;
  isWinner: boolean;
  isTieCandidate: boolean;
}

export interface ResultBreakdownViewModel {
  endingTitle: string;
  endingReason: string;
  myScoreLabel: string | null;
  voteTitle: string;
  voteSummary: string;
  voteItems: ResultVoteItem[];
  voteMeta: string[];
}

const UNKNOWN_ENDING = '결말 판정 대기 중';
const UNKNOWN_VOTE_TARGET = '알 수 없는 대상';

export function playerDisplayName(player: Player): string {
  return player.displayName?.trim() || player.nickname;
}

export function playerDisplayNameById(
  players: Player[],
  playerId: string,
  fallback: string
): string {
  const player = players.find((candidate) => candidate.id === playerId);
  return player ? playerDisplayName(player) : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readResults(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const results: Record<string, number> = {};
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === 'number' && Number.isFinite(count)) {
      results[key] = count;
    }
  }
  return results;
}

export function readVoteBreakdown(moduleData: Record<string, unknown>): VoteBreakdownResult | null {
  const raw = isRecord(moduleData.lastResult) ? moduleData.lastResult : moduleData;
  const results = readResults(raw.results);
  const hasBreakdown = Object.keys(results).length > 0 || typeof raw.outcome === 'string';
  if (!hasBreakdown) return null;

  const tieCandidates = Array.isArray(raw.tieCandidates)
    ? raw.tieCandidates.filter((item): item is string => typeof item === 'string')
    : undefined;

  return {
    results,
    winner: readString(raw.winner),
    isTie: typeof raw.isTie === 'boolean' ? raw.isTie : undefined,
    round: readNumber(raw.round),
    outcome: readString(raw.outcome) as VoteOutcome | undefined,
    totalVotes: readNumber(raw.totalVotes),
    abstainCount: readNumber(raw.abstainCount),
    eligibleVoters: readNumber(raw.eligibleVoters),
    participationPct: readNumber(raw.participationPct),
    tieCandidates,
  };
}

export function readEndingBranchResult(
  moduleData: Record<string, unknown>
): EndingBranchResult | null {
  const raw = isRecord(moduleData.result) ? moduleData.result : moduleData;
  const selectedEnding = readString(raw.selectedEnding);
  if (!selectedEnding && raw.evaluated !== true) return null;
  return {
    selectedEnding,
    matchedPriority: readNumber(raw.matchedPriority),
    myScore: readNumber(raw.myScore),
  };
}

export function buildResultBreakdownViewModel(params: {
  players: Player[];
  vote: VoteBreakdownResult | null;
  ending: EndingBranchResult | null;
}): ResultBreakdownViewModel {
  const { players, vote, ending } = params;
  const playerNameById = new Map(players.map((player) => [player.id, playerDisplayName(player)]));
  const tieCandidates = new Set(vote?.tieCandidates ?? []);
  const winner = vote?.winner;

  const voteItems = Object.entries(vote?.results ?? {})
    .map(([id, votes]) => ({
      id,
      label: playerNameById.get(id) ?? UNKNOWN_VOTE_TARGET,
      votes,
      isWinner: !!winner && id === winner,
      isTieCandidate: tieCandidates.has(id),
    }))
    .sort((a, b) => b.votes - a.votes || a.label.localeCompare(b.label, 'ko'));

  const voteTitle = vote?.round ? `${vote.round}라운드 투표 결과` : '투표 결과';
  const voteSummary = buildVoteSummary(vote, playerNameById);
  const voteMeta = buildVoteMeta(vote);

  return {
    endingTitle: ending?.selectedEnding ?? UNKNOWN_ENDING,
    endingReason: ending?.matchedPriority
      ? `우선순위 ${ending.matchedPriority}번 조건으로 결정됐어요.`
      : ending?.selectedEnding
        ? '기본 결말 또는 조건 없는 결말로 결정됐어요.'
        : '아직 결말 평가가 끝나지 않았어요.',
    myScoreLabel: typeof ending?.myScore === 'number' ? `내 결말 점수 ${ending.myScore}점` : null,
    voteTitle,
    voteSummary,
    voteItems,
    voteMeta,
  };
}

function buildVoteSummary(
  vote: VoteBreakdownResult | null,
  playerNameById: Map<string, string>
): string {
  if (!vote) return '아직 공개된 투표 결과가 없어요.';
  if (vote.outcome === 'insufficient_participation') {
    return '투표 참여 인원이 부족해서 결과가 확정되지 않았어요.';
  }
  if (vote.outcome === 'no_result') {
    return '동률 또는 무효 조건 때문에 확정된 투표 결과가 없어요.';
  }
  if (vote.outcome === 'tie') {
    return '동률이어서 재투표 또는 진행자 판단이 필요해요.';
  }
  if (vote.winner) {
    return `${playerNameById.get(vote.winner) ?? UNKNOWN_VOTE_TARGET}에게 가장 많은 표가 모였어요.`;
  }
  return '투표 결과를 집계했지만 최종 대상은 정해지지 않았어요.';
}

function buildVoteMeta(vote: VoteBreakdownResult | null): string[] {
  if (!vote) return [];
  const meta: string[] = [];
  if (typeof vote.totalVotes === 'number') meta.push(`총 ${vote.totalVotes}표`);
  if (typeof vote.eligibleVoters === 'number') meta.push(`투표 가능 ${vote.eligibleVoters}명`);
  if (typeof vote.participationPct === 'number') meta.push(`참여율 ${vote.participationPct}%`);
  if (typeof vote.abstainCount === 'number' && vote.abstainCount > 0) {
    meta.push(`기권 ${vote.abstainCount}표`);
  }
  return meta;
}
