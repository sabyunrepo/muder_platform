import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EndingNodePanel } from "../EndingNodePanel";

const makeNode = (data: Record<string, unknown> = {}) => ({
  id: "ending-1",
  type: "ending" as const,
  position: { x: 0, y: 0 },
  data: { label: "진실", ...data },
});

describe("EndingNodePanel", () => {
  afterEach(() => cleanup());

  it("플로우 안에서는 결말 연결 요약만 표시하고 본문 편집 폼을 숨긴다", () => {
    render(
      <EndingNodePanel
        node={makeNode({
          endingContent: "범인은 밝혀졌다.",
          endingVisibility: "players_only",
          endingSpoilerWarning: "스포일러 주의",
          endingShareText: "공유 문구",
        })}
        themeId="theme-1"
        edges={[{ target: "ending-1" }, { target: "other" }]}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("결말 연결")).toBeDefined();
    expect(screen.getByText("플로우 진행 노드")).toBeDefined();
    expect(screen.getByText("진실")).toBeDefined();
    expect(screen.getByText("본문 작성됨")).toBeDefined();
    expect(screen.getByText("참가자에게만 공개")).toBeDefined();
    expect(screen.getByText("도달 경로 1개")).toBeDefined();
    expect(screen.getByText(/결말 관리에서 수정하세요/)).toBeDefined();

    expect(screen.queryByLabelText("결말 본문")).toBeNull();
    expect(screen.queryByLabelText("공개 범위")).toBeNull();
    expect(screen.queryByPlaceholderText("엔딩 이름")).toBeNull();
    expect(screen.queryByPlaceholderText("예: 🎭")).toBeNull();
  });

  it("기존 상세 data는 유실 없이 읽기 전용 요약으로 로딩한다", () => {
    const onUpdate = vi.fn();
    render(
      <EndingNodePanel
        node={makeNode({
          label: "오판",
          description: "잘못된 추리",
          endingContent: "",
          score_multiplier: 2,
        })}
        themeId="theme-1"
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByText("오판")).toBeDefined();
    expect(screen.getByText("결말 본문을 아직 작성하지 않았습니다.")).toBeDefined();
    expect(screen.getByText("본문 필요")).toBeDefined();
    expect(screen.queryByText("점수 배율")).toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
