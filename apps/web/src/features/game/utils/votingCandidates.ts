import { PlayerRole, type Player } from "@mmp/shared";

export interface VotingCandidatePolicy {
  includeDetective: boolean;
  includeSelf: boolean;
  includeDeadPlayers: boolean;
}

type CandidatePlayer = Player & {
  isPlayable?: boolean;
  isVotingCandidate?: boolean;
};

export const DEFAULT_VOTING_CANDIDATE_POLICY: VotingCandidatePolicy = {
  includeDetective: false,
  includeSelf: false,
  includeDeadPlayers: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function boolOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function readVotingCandidatePolicy(moduleData: Record<string, unknown>): VotingCandidatePolicy {
  const rawConfig = isRecord(moduleData.config) ? moduleData.config : moduleData;
  const rawPolicy = isRecord(rawConfig.candidatePolicy) ? rawConfig.candidatePolicy : {};

  return {
    includeDetective: boolOrDefault(
      rawPolicy.includeDetective,
      DEFAULT_VOTING_CANDIDATE_POLICY.includeDetective,
    ),
    includeSelf: boolOrDefault(rawPolicy.includeSelf, DEFAULT_VOTING_CANDIDATE_POLICY.includeSelf),
    includeDeadPlayers: boolOrDefault(
      rawPolicy.includeDeadPlayers,
      DEFAULT_VOTING_CANDIDATE_POLICY.includeDeadPlayers,
    ),
  };
}

export function isDetectivePlayer(player: Player): boolean {
  return player.role === PlayerRole.DETECTIVE;
}

export function isEligibleCharacterCandidate(player: CandidatePlayer): boolean {
  if (player.isPlayable === false) return false;
  if (player.isVotingCandidate === false) return false;
  return true;
}

export function filterVotingCandidates(
  players: CandidatePlayer[],
  myPlayerId: string | null,
  policy: VotingCandidatePolicy,
): CandidatePlayer[] {
  return players.filter((player) => {
    if (!isEligibleCharacterCandidate(player)) return false;
    if (!policy.includeDeadPlayers && !player.isAlive) return false;
    if (!policy.includeSelf && player.id === myPlayerId) return false;
    if (!policy.includeDetective && isDetectivePlayer(player)) return false;
    return true;
  });
}

export function countExcludedDetectives(
  players: CandidatePlayer[],
  myPlayerId: string | null,
  policy: VotingCandidatePolicy,
): number {
  if (policy.includeDetective) return 0;
  return players.filter((player) => {
    if (!isEligibleCharacterCandidate(player)) return false;
    if (!isDetectivePlayer(player)) return false;
    if (!policy.includeDeadPlayers && !player.isAlive) return false;
    if (!policy.includeSelf && player.id === myPlayerId) return false;
    return true;
  }).length;
}
