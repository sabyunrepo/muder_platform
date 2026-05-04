import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayerRole } from "@mmp/shared";

vi.mock("@/stores/gameSessionStore", () => ({
  useGameSessionStore: (selector: (s: unknown) => unknown) =>
    selector({
      players: [
        {
          id: "p1",
          nickname: "한서윤",
          role: PlayerRole.CIVILIAN,
          isAlive: true,
          isHost: false,
          isReady: true,
          connectedAt: 1,
        },
        {
          id: "p2",
          nickname: "강도윤",
          role: PlayerRole.DETECTIVE,
          isAlive: true,
          isHost: false,
          isReady: true,
          connectedAt: 2,
        },
      ],
    }),
}));

vi.mock("@/stores/moduleStoreFactory", () => ({
  useModuleStore: (moduleId: string, selector: (s: { data: Record<string, unknown> }) => unknown) => {
    const dataByModule: Record<string, Record<string, unknown>> = {
      voting: {
        lastResult: {
          results: { p1: 3, p2: 1 },
          winner: "p1",
          outcome: "winner",
          round: 1,
          totalVotes: 4,
          eligibleVoters: 4,
          participationPct: 100,
        },
      },
      ending_branch: {
        result: {
          selectedEnding: "진실의 밤",
          matchedPriority: 1,
          myScore: 3,
        },
      },
    };
    return selector({ data: dataByModule[moduleId] ?? {} });
  },
}));

import { ResultBreakdownPanel } from "../ResultBreakdownPanel";

afterEach(() => cleanup());

describe("ResultBreakdownPanel", () => {
  it("renders ending and voting breakdown from module states", () => {
    render(<ResultBreakdownPanel />);

    expect(screen.getByText("진실의 밤")).toBeTruthy();
    expect(screen.getByText("내 결말 점수 3점")).toBeTruthy();
    expect(screen.getByText("1라운드 투표 결과")).toBeTruthy();
    expect(screen.getByText("한서윤에게 가장 많은 표가 모였어요.")).toBeTruthy();
    expect(screen.getByText("총 4표")).toBeTruthy();
    expect(screen.getByText("참여율 100%")).toBeTruthy();
    expect(screen.getByText("3표")).toBeTruthy();
  });
});
