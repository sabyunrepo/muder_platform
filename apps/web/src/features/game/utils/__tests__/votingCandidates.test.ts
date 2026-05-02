import { describe, expect, it } from "vitest";
import { PlayerRole, type Player } from "@mmp/shared";
import {
  countExcludedDetectives,
  filterVotingCandidates,
  readVotingCandidatePolicy,
} from "../votingCandidates";

function player(overrides: Partial<Player>): Player {
  return {
    id: "p-1",
    nickname: "플레이어",
    role: null,
    isAlive: true,
    isHost: false,
    isReady: true,
    connectedAt: 0,
    ...overrides,
  };
}

describe("votingCandidates", () => {
  it("defaults to excluding detective, self, and dead players", () => {
    expect(readVotingCandidatePolicy({})).toEqual({
      includeDetective: false,
      includeSelf: false,
      includeDeadPlayers: false,
    });
  });

  it("reads candidatePolicy from voting module config", () => {
    expect(
      readVotingCandidatePolicy({
        config: {
          candidatePolicy: {
            includeDetective: true,
            includeSelf: true,
            includeDeadPlayers: true,
          },
        },
      }),
    ).toEqual({ includeDetective: true, includeSelf: true, includeDeadPlayers: true });
  });

  it("filters detective candidates when includeDetective is false", () => {
    const players = [
      player({ id: "me", nickname: "나" }),
      player({ id: "detective", nickname: "탐정", role: PlayerRole.DETECTIVE }),
      player({ id: "suspect", nickname: "용의자", role: PlayerRole.CIVILIAN }),
      player({ id: "dead", nickname: "탈락자", isAlive: false }),
    ];

    expect(
      filterVotingCandidates(players, "me", {
        includeDetective: false,
        includeSelf: false,
        includeDeadPlayers: false,
      }).map((p) => p.id),
    ).toEqual(["suspect"]);
  });

  it("can include detective, self, and dead players when policy allows it", () => {
    const players = [
      player({ id: "me", nickname: "나" }),
      player({ id: "detective", nickname: "탐정", role: PlayerRole.DETECTIVE }),
      player({ id: "dead", nickname: "탈락자", isAlive: false }),
    ];

    expect(
      filterVotingCandidates(players, "me", {
        includeDetective: true,
        includeSelf: true,
        includeDeadPlayers: true,
      }).map((p) => p.id),
    ).toEqual(["me", "detective", "dead"]);
  });

  it("counts detectives hidden by the current policy", () => {
    const players = [
      player({ id: "me", nickname: "나" }),
      player({ id: "detective", nickname: "탐정", role: PlayerRole.DETECTIVE }),
    ];

    expect(
      countExcludedDetectives(players, "me", {
        includeDetective: false,
        includeSelf: false,
        includeDeadPlayers: false,
      }),
    ).toBe(1);
  });
});
