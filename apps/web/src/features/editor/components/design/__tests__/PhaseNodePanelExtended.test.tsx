import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../flowApi", () => ({
  useUpdateFlowNode: () => ({ mutate: vi.fn() }),
}));

vi.mock("../../../mediaApi", () => ({
  useMediaList: () => ({
    data: [
      {
        id: "media-1",
        theme_id: "t1",
        name: "오프닝 BGM",
        type: "BGM",
        source_type: "FILE",
        tags: [],
        sort_order: 0,
        created_at: "2026-05-06T00:00:00Z",
      },
    ],
    isLoading: false,
  }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { PhaseNodePanel } from "../PhaseNodePanel";

afterEach(cleanup);

/** Wrap render with a fresh QueryClient (PhaseNodePanel now uses useQueryClient). */
function renderWithQC(ui: ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const makeNode = (data: Record<string, unknown> = {}) => ({
  id: "node-1",
  type: "phase" as const,
  position: { x: 0, y: 0 },
  data: { label: "테스트 페이즈", ...data },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PhaseNodePanel extended fields", () => {
  it("자동진행 토글이 렌더링된다", () => {
    renderWithQC(
      <PhaseNodePanel
        node={makeNode()}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByRole("switch")).toBeDefined();
  });

  it("자동진행 토글 클릭 시 onUpdate가 호출된다", () => {
    const onUpdate = vi.fn();
    renderWithQC(
      <PhaseNodePanel
        node={makeNode()}
        themeId="t1"
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onUpdate).toHaveBeenCalledWith("node-1", { autoAdvance: true });
  });

  it("autoAdvance=true 시 경고타이머 입력이 표시된다", () => {
    renderWithQC(
      <PhaseNodePanel
        node={makeNode({ autoAdvance: true })}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("30")).toBeDefined();
  });

  it("autoAdvance=false 시 경고타이머가 숨겨진다", () => {
    renderWithQC(
      <PhaseNodePanel
        node={makeNode({ autoAdvance: false })}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.queryByPlaceholderText("30")).toBeNull();
  });

  it("장면 시작/종료 트리거 섹션이 렌더링된다", () => {
    renderWithQC(
      <PhaseNodePanel
        node={makeNode()}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText("장면 연출")).toBeDefined();
    expect(screen.getByText("장면 시작 트리거")).toBeDefined();
    expect(screen.getByText("장면 종료 트리거")).toBeDefined();
    expect(screen.getAllByText("트리거 실행 결과 없음")).toHaveLength(3);
  });

  it("장면 연출 cue를 시작 트리거와 분리해 저장한다", () => {
    const onUpdate = vi.fn();
    renderWithQC(
      <PhaseNodePanel
        node={makeNode({
          onEnter: [
            { id: "vote", type: "OPEN_VOTING" },
            { id: "bgm", type: "SET_BGM", params: { mediaId: "media-1" } },
          ],
        })}
        themeId="t1"
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByText("오프닝 BGM · 배경음악")).toBeDefined();
    expect(screen.queryByRole("combobox", { name: "장면 시작 트리거 2 실행 결과" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "장면 연출 1 삭제" }));

    expect(onUpdate).toHaveBeenCalledWith("node-1", {
      onEnter: [{ id: "vote", type: "OPEN_VOTING" }],
    });
  });

  it("장면 연출 cue만 수정해도 기존 시작 트리거 실행 순서를 유지한다", () => {
    const onUpdate = vi.fn();
    renderWithQC(
      <PhaseNodePanel
        node={makeNode({
          onEnter: [
            { id: "bgm", type: "SET_BGM", params: {} },
            { id: "vote", type: "OPEN_VOTING" },
          ],
        })}
        themeId="t1"
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "BGM 선택" }));
    fireEvent.click(screen.getByRole("button", { name: /오프닝 BGM/ }));

    expect(onUpdate).toHaveBeenCalledWith("node-1", {
      onEnter: [
        { id: "bgm", type: "SET_BGM", params: { mediaId: "media-1" } },
        { id: "vote", type: "OPEN_VOTING" },
      ],
    });
  });

  it("토론방 정책을 장면 데이터로 저장한다", () => {
    const onUpdate = vi.fn();
    renderWithQC(
      <PhaseNodePanel
        node={makeNode({
          discussionRoomPolicy: {
            enabled: true,
            mainRoomName: "전체 토론",
            privateRoomsEnabled: false,
            privateRoomName: "밀담방",
            availability: "phase_active",
          },
        })}
        themeId="t1"
        onUpdate={onUpdate}
      />,
    );

    fireEvent.change(screen.getByLabelText("메인 토론방"), {
      target: { value: "추리 회의" },
    });

    expect(onUpdate).toHaveBeenLastCalledWith("node-1", {
      discussionRoomPolicy: {
        enabled: true,
        roomKind: "all",
        mainRoomName: "추리 회의",
        privateRoomsEnabled: false,
        privateRoomName: "밀담방",
        participantMode: "all",
        participantSummary: "",
        availability: "phase_active",
        conditionalRoomName: "",
        closeBehavior: "close_on_exit",
      },
    });
  });

  it("조건부 토론방 이름을 저장한다", () => {
    const onUpdate = vi.fn();
    renderWithQC(
      <PhaseNodePanel
        node={makeNode({
          discussionRoomPolicy: {
            enabled: true,
            mainRoomName: "전체 토론",
            privateRoomsEnabled: false,
            privateRoomName: "밀담방",
            availability: "condition",
          },
        })}
        themeId="t1"
        onUpdate={onUpdate}
      />,
    );

    fireEvent.change(screen.getByLabelText("조건부 방명"), {
      target: { value: "비밀 토론" },
    });

    expect(onUpdate).toHaveBeenLastCalledWith("node-1", {
      discussionRoomPolicy: {
        enabled: true,
        roomKind: "all",
        mainRoomName: "전체 토론",
        privateRoomsEnabled: false,
        privateRoomName: "밀담방",
        participantMode: "all",
        participantSummary: "",
        availability: "condition",
        conditionalRoomName: "비밀 토론",
        closeBehavior: "close_on_exit",
      },
    });
  });

  it("토론방 사용 여부와 밀담방 허용 상태를 장면 데이터로 저장한다", () => {
    const onUpdate = vi.fn();
    renderWithQC(
      <PhaseNodePanel
        node={makeNode({
          discussionRoomPolicy: {
            enabled: true,
            roomKind: "all",
            mainRoomName: "전체 토론",
            privateRoomsEnabled: false,
            privateRoomName: "밀담방",
            participantMode: "all",
            participantSummary: "",
            availability: "phase_active",
            conditionalRoomName: "",
            closeBehavior: "close_on_exit",
          },
        })}
        themeId="t1"
        onUpdate={onUpdate}
      />,
    );

    const discussionPanel = screen.getByTestId("discussion-room-policy-panel");
    fireEvent.click(within(discussionPanel).getByRole("checkbox", { name: /토론방/ }));
    expect(onUpdate).toHaveBeenLastCalledWith("node-1", {
      discussionRoomPolicy: expect.objectContaining({
        enabled: false,
      }),
    });

    fireEvent.click(within(discussionPanel).getByRole("checkbox", { name: /밀담방 허용/ }));
    expect(onUpdate).toHaveBeenLastCalledWith("node-1", {
      discussionRoomPolicy: expect.objectContaining({
        enabled: true,
        privateRoomsEnabled: true,
      }),
    });
  });

  it("토론 유형, 참여 대상, 종료 정책을 장면 데이터로 저장한다", () => {
    const onUpdate = vi.fn();
    renderWithQC(
      <PhaseNodePanel
        node={makeNode({
          discussionRoomPolicy: {
            enabled: true,
            mainRoomName: "전체 토론",
            privateRoomsEnabled: false,
            privateRoomName: "밀담방",
            availability: "phase_active",
          },
        })}
        themeId="t1"
        onUpdate={onUpdate}
      />,
    );

    fireEvent.change(screen.getByLabelText("토론 유형"), {
      target: { value: "small_group" },
    });
    expect(onUpdate).toHaveBeenLastCalledWith("node-1", {
      discussionRoomPolicy: expect.objectContaining({
        enabled: true,
        roomKind: "small_group",
      }),
    });

    fireEvent.change(screen.getByLabelText("참여 대상"), {
      target: { value: "characters" },
    });
    expect(onUpdate).toHaveBeenLastCalledWith("node-1", {
      discussionRoomPolicy: expect.objectContaining({
        enabled: true,
        participantMode: "characters",
      }),
    });

    fireEvent.change(screen.getByLabelText("장면 종료 시 처리"), {
      target: { value: "keep_until_next_scene" },
    });
    expect(onUpdate).toHaveBeenLastCalledWith("node-1", {
      discussionRoomPolicy: expect.objectContaining({
        enabled: true,
        closeBehavior: "keep_until_next_scene",
      }),
    });
  });

  it("특정 참여 대상 메모를 장면 데이터로 저장한다", () => {
    const onUpdate = vi.fn();
    renderWithQC(
      <PhaseNodePanel
        node={makeNode({
          discussionRoomPolicy: {
            enabled: true,
            roomKind: "small_group",
            mainRoomName: "전체 토론",
            privateRoomsEnabled: false,
            privateRoomName: "밀담방",
            participantMode: "characters",
            participantSummary: "",
            availability: "phase_active",
            closeBehavior: "close_on_exit",
          },
        })}
        themeId="t1"
        onUpdate={onUpdate}
      />,
    );

    fireEvent.change(screen.getByLabelText("참여 캐릭터 메모"), {
      target: { value: "탐정, 목격자" },
    });

    expect(onUpdate).toHaveBeenLastCalledWith("node-1", {
      discussionRoomPolicy: expect.objectContaining({
        enabled: true,
        participantMode: "characters",
        participantSummary: "탐정, 목격자",
      }),
    });
  });
});
