import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { WsEventType } from "@mmp/shared";

const handlers = new Map<string, (payload: unknown, seq: number) => void>();

vi.mock("@/hooks/useWsEvent", () => ({
  useWsEvent: (
    _endpoint: "game" | "social",
    eventType: string,
    handler: (payload: unknown, seq: number) => void,
  ) => {
    handlers.set(eventType, handler);
  },
}));

import { PresentationLayer } from "./PresentationLayer";

describe("PresentationLayer", () => {
  beforeEach(() => {
    handlers.clear();
  });

  it("presentation WS cue로 배경과 컬러 테마 상태를 갱신한다", () => {
    const { container } = render(
      <PresentationLayer>
        <button type="button">채팅 열기</button>
      </PresentationLayer>,
    );

    act(() => {
      handlers.get(WsEventType.PRESENTATION_SET_BACKGROUND)!(
        { mediaId: "image-1", url: "https://cdn.example/bg.png" },
        1,
      );
      handlers.get(WsEventType.PRESENTATION_SET_THEME_COLOR)!({ themeToken: "tension" }, 2);
    });

    const root = container.firstElementChild;
    expect(root?.getAttribute("data-presentation-theme")).toBe("tension");
    expect(root?.outerHTML).not.toContain("image-1");
  });

  it("배경 layer가 자식 UI 클릭을 가로막지 않는다", () => {
    const onClick = vi.fn();
    render(
      <PresentationLayer>
        <button type="button" onClick={onClick}>
          주요 행동
        </button>
      </PresentationLayer>,
    );

    handlers.get(WsEventType.PRESENTATION_SET_BACKGROUND)!(
      { mediaId: "image-1", url: "https://cdn.example/bg.png" },
      1,
    );
    fireEvent.click(screen.getByRole("button", { name: "주요 행동" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
