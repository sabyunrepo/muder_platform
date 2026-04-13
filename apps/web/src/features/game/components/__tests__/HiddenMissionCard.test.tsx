import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { WsEventType } from "@mmp/shared";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockModuleData } = vi.hoisted(() => ({
  mockModuleData: { missions: [] as unknown[] },
}));

// ---------------------------------------------------------------------------
// Mock: moduleStoreFactory
// ---------------------------------------------------------------------------

vi.mock("@/stores/moduleStoreFactory", () => ({
  useModuleStore: (_moduleId: string, selector?: (s: { data: Record<string, unknown> }) => unknown) => {
    const state = { data: mockModuleData as Record<string, unknown> };
    return selector ? selector(state) : state;
  },
}));

// ---------------------------------------------------------------------------
// 테스트 대상
// ---------------------------------------------------------------------------

import { HiddenMissionCard } from "../HiddenMissionCard";
import { MissionResultOverlay } from "../MissionResultOverlay";

afterEach(() => {
  cleanup();
  mockModuleData.missions = [];
});

// ---------------------------------------------------------------------------
// HiddenMissionCard 테스트
// ---------------------------------------------------------------------------

describe("HiddenMissionCard", () => {
  describe("기본 렌더링", () => {
    it("헤더 '비밀 임무' 텍스트를 렌더링한다", () => {
      render(<HiddenMissionCard />);
      expect(screen.getByText("비밀 임무")).toBeDefined();
    });

    it("미션이 없으면 '배정된 임무가 없습니다' 메시지를 표시한다", () => {
      render(<HiddenMissionCard />);
      expect(screen.getByText("배정된 임무가 없습니다")).toBeDefined();
    });
  });

  describe("미션 목록 렌더링", () => {
    beforeEach(() => {
      mockModuleData.missions = [
        {
          id: "m1",
          type: "hold_clue",
          description: "단서 카드를 끝까지 보유하라",
          points: 10,
          verification: "auto",
          completed: false,
        },
        {
          id: "m2",
          type: "survive",
          description: "게임에서 살아남아라",
          points: 20,
          verification: "auto",
          completed: true,
        },
      ];
    });

    it("미션 설명을 렌더링한다", () => {
      render(<HiddenMissionCard />);
      expect(screen.getByText("단서 카드를 끝까지 보유하라")).toBeDefined();
      expect(screen.getByText("게임에서 살아남아라")).toBeDefined();
    });

    it("완료 미션 개수를 표시한다", () => {
      render(<HiddenMissionCard />);
      expect(screen.getByText("1/2 완료")).toBeDefined();
    });

    it("완료된 미션의 획득 점수를 합산해 표시한다", () => {
      render(<HiddenMissionCard />);
      // 완료된 미션(m2)의 점수 20만 합산 — 획득 점수 섹션 + 미션 배지에 각각 표시됨
      const elements = screen.getAllByText("20점");
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("self_report 미션", () => {
    beforeEach(() => {
      mockModuleData.missions = [
        {
          id: "m3",
          type: "vote_target",
          description: "특정 플레이어에게 투표하라",
          points: 15,
          verification: "self_report",
          completed: false,
        },
      ];
    });

    it("send가 있을 때 '완료 보고' 버튼을 렌더링한다", () => {
      const send = vi.fn();
      render(<HiddenMissionCard send={send} />);
      expect(screen.getByText("완료 보고")).toBeDefined();
    });

    it("'완료 보고' 버튼 클릭 시 send를 GAME_ACTION으로 호출한다", () => {
      const send = vi.fn();
      render(<HiddenMissionCard send={send} />);

      fireEvent.click(screen.getByText("완료 보고"));

      expect(send).toHaveBeenCalledOnce();
      expect(send).toHaveBeenCalledWith(WsEventType.GAME_ACTION, {
        type: "mission:report",
        missionId: "m3",
      });
    });

    it("send가 없으면 '완료 보고' 버튼을 렌더링하지 않는다", () => {
      render(<HiddenMissionCard />);
      expect(screen.queryByText("완료 보고")).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// MissionResultOverlay 테스트
// ---------------------------------------------------------------------------

describe("MissionResultOverlay", () => {
  it("미션이 없으면 아무것도 렌더링하지 않는다", () => {
    const { container } = render(<MissionResultOverlay />);
    expect(container.firstChild).toBeNull();
  });

  describe("결과 표시", () => {
    beforeEach(() => {
      mockModuleData.missions = [
        {
          id: "r1",
          description: "단서를 보유하라",
          points: 10,
          completed: true,
        },
        {
          id: "r2",
          description: "범인에게 투표하라",
          points: 20,
          completed: false,
        },
      ];
    });

    it("'비밀 임무 결과' 헤더를 렌더링한다", () => {
      render(<MissionResultOverlay />);
      expect(screen.getByText("비밀 임무 결과")).toBeDefined();
    });

    it("미션 설명을 렌더링한다", () => {
      render(<MissionResultOverlay />);
      expect(screen.getByText("단서를 보유하라")).toBeDefined();
      expect(screen.getByText("범인에게 투표하라")).toBeDefined();
    });

    it("완료 미션의 총점을 표시한다", () => {
      render(<MissionResultOverlay />);
      // 완료된 미션(r1) 10점만 총점에 포함
      expect(screen.getByText("10점")).toBeDefined();
    });
  });
});
