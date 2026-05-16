import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { editorKeys } from "../../../api";

const { configMutateMock } = vi.hoisted(() => ({
  configMutateMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../flowApi", () => ({
  useUpdateFlowNode: () => ({ mutate: vi.fn() }),
}));

vi.mock("../../../editorConfigApi", () => ({
  useUpdateConfigJson: () => ({ mutate: configMutateMock, isPending: false }),
}));

vi.mock("../../../editorMapApi", () => ({
  useEditorMaps: () => ({
    data: [
      {
        id: "map-1",
        theme_id: "t1",
        name: "저택 1층",
        image_url: null,
        sort_order: 1,
        created_at: "2026-04-15T00:00:00Z",
      },
      {
        id: "map-2",
        theme_id: "t1",
        name: "저택 2층",
        image_url: null,
        sort_order: 2,
        created_at: "2026-04-15T00:00:00Z",
      },
    ],
    isLoading: false,
  }),
}));

vi.mock("../../../readingApi", () => ({
  useReadingSections: () => ({
    data: [{ id: "rs-1", name: "오프닝 낭독", lines: [{ Text: "시작" }] }],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../../mediaApi", () => ({
  useMediaList: () => ({ data: [], isLoading: false }),
  useMediaCategories: () => ({ data: [] }),
  useRequestUploadUrl: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useConfirmUpload: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { PhaseNodePanel } from "../PhaseNodePanel";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderWithQC(ui: ReactElement, seedTheme?: Record<string, unknown>) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (seedTheme) {
    qc.setQueryData(editorKeys.theme("t1"), seedTheme);
  }
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const makeNode = (data: Record<string, unknown> = {}) => ({
  id: "node-1",
  type: "phase" as const,
  position: { x: 0, y: 0 },
  data: { label: "테스트 페이즈", phase_type: "investigation", ...data },
});

describe("PhaseNodePanel type-specific fields", () => {
  it("플레이어킬 모듈이 켜져 있으면 장면별 살해 가능 체크를 저장한다", () => {
    renderWithQC(
      <PhaseNodePanel
        node={makeNode({ phase_type: "story_progression" })}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
      {
        id: "t1",
        version: 7,
        config_json: {
          modules: {
            player_kill: {
              enabled: true,
              config: {
                killableCharacterIds: [],
                muteOnKilled: false,
                killResolutionMode: "all_weapons_vs_all_armor",
                allowedSceneIds: [],
              },
            },
          },
        },
      },
    );

    fireEvent.click(screen.getByLabelText("살해 가능 장면"));

    expect(configMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 7,
        modules: expect.objectContaining({
          player_kill: expect.objectContaining({
            config: expect.objectContaining({ allowedSceneIds: ["node-1"] }),
          }),
        }),
      }),
    );
  });

  it("스토리 진행 페이즈가 아니면 장면별 살해 가능 체크를 숨긴다", () => {
    renderWithQC(
      <PhaseNodePanel
        node={makeNode({ phase_type: "investigation" })}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
      {
        id: "t1",
        version: 7,
        config_json: {
          modules: {
            player_kill: {
              enabled: true,
              config: {
                killableCharacterIds: [],
                muteOnKilled: false,
                killResolutionMode: "all_weapons_vs_all_armor",
                allowedSceneIds: [],
              },
            },
          },
        },
      },
    );

    expect(screen.queryByLabelText("살해 가능 장면")).toBeNull();
  });

  it("수사 장면은 기본 정보, 시간, 맵 선택, 자동 진행 안내를 표시한다", () => {
    renderWithQC(
      <PhaseNodePanel node={makeNode()} themeId="t1" onUpdate={vi.fn()} />,
    );

    expect(screen.getByText("장면 설정")).toBeDefined();
    expect(screen.getByLabelText("라벨")).toBeDefined();
    expect(screen.getByLabelText("타입")).toBeDefined();
    expect(screen.getByLabelText("시간 (분)")).toBeDefined();
    expect(screen.getByLabelText("사용할 맵")).toBeDefined();
    expect(screen.getByText(/다음 연결 장면으로 자동 진행/)).toBeDefined();

    expect(screen.queryByText("라운드 수")).toBeNull();
    expect(screen.queryByText("장면 진입 효과")).toBeNull();
    expect(screen.queryByText("토론방 설정")).toBeNull();
    expect(screen.queryByText("읽기 대사 배치")).toBeNull();
    expect(screen.queryByText("장면 시작 트리거")).toBeNull();
  });

  it("수사 장면에서 사용할 맵을 선택하면 investigationMapId를 저장한다", () => {
    const onUpdate = vi.fn();
    renderWithQC(
      <PhaseNodePanel node={makeNode({ investigationMapId: "map-1" })} themeId="t1" onUpdate={onUpdate} />,
    );

    const mapSelect = screen.getByLabelText("사용할 맵") as HTMLSelectElement;
    expect(mapSelect.value).toBe("map-1");

    fireEvent.change(mapSelect, { target: { value: "map-2" } });

    expect(onUpdate).toHaveBeenLastCalledWith("node-1", { investigationMapId: "map-2" });
  });

  it("진행 시간은 음수를 0으로 보정하고 빈 값은 제거한다", () => {
    const onUpdate = vi.fn();
    renderWithQC(
      <PhaseNodePanel node={makeNode({ duration: 15 })} themeId="t1" onUpdate={onUpdate} />,
    );

    const durationInput = screen.getByLabelText("시간 (분)");
    fireEvent.change(durationInput, { target: { value: "-5" } });
    expect(onUpdate).toHaveBeenLastCalledWith("node-1", { duration: 0 });

    fireEvent.change(durationInput, { target: { value: "" } });
    expect(onUpdate).toHaveBeenLastCalledWith("node-1", { duration: undefined });
  });

  it("토론 장면은 시간과 새 토론방 UI를 표시한다", () => {
    renderWithQC(
      <PhaseNodePanel
        node={makeNode({
          phase_type: "discussion",
          discussionRoomPolicy: {
            enabled: true,
            mainRoomName: "전체 토론",
            privateRooms: [
              { id: "p1", name: "비밀방", maxMembers: 3, timeLimitSeconds: 300 },
            ],
            closeBehavior: "return_to_main",
          },
        })}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("토론방 설정")).toBeDefined();
    expect(screen.queryByLabelText("사용할 맵")).toBeNull();
    expect((screen.getByLabelText("전체토론방 이름") as HTMLInputElement).value).toBe("전체 토론");
    expect((screen.getByLabelText("밀담방 1 이름") as HTMLInputElement).value).toBe("비밀방");
    expect((screen.getByLabelText("최대 인원") as HTMLInputElement).value).toBe("3");
    expect((screen.getByLabelText("제한시간 (분)") as HTMLInputElement).value).toBe("5");

    expect(screen.queryByText("라운드 수")).toBeNull();
    expect(screen.queryByText("장면 진입 효과")).toBeNull();
    expect(screen.queryByText("읽기 대사 배치")).toBeNull();
    expect(screen.queryByText("질문")).toBeNull();
  });

  it("토론 밀담방을 추가하고 이름, 최소 인원, 빈 제한시간을 저장한다", () => {
    const onUpdate = vi.fn();
    renderWithQC(
      <PhaseNodePanel
        node={makeNode({ phase_type: "discussion" })}
        themeId="t1"
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "밀담방 추가" }));
    expect(onUpdate).toHaveBeenLastCalledWith("node-1", {
      discussionRoomPolicy: expect.objectContaining({
        enabled: true,
        privateRooms: [
          { id: "private-1", name: "밀담방 1", maxMembers: 2, timeLimitSeconds: null },
        ],
      }),
    });

    cleanup();
    onUpdate.mockClear();
    renderWithQC(
      <PhaseNodePanel
        node={makeNode({
          phase_type: "discussion",
          discussionRoomPolicy: {
            enabled: true,
            mainRoomName: "전체토론방",
            privateRooms: [
              { id: "private-1", name: "밀담방 1", maxMembers: 2, timeLimitSeconds: 600 },
            ],
            closeBehavior: "return_to_main",
          },
        })}
        themeId="t1"
        onUpdate={onUpdate}
      />,
    );

    const panel = screen.getByTestId("discussion-phase-panel");
    fireEvent.change(within(panel).getByLabelText("밀담방 1 이름"), {
      target: { value: "탐정 밀담" },
    });
    expect(onUpdate).toHaveBeenLastCalledWith("node-1", {
      discussionRoomPolicy: expect.objectContaining({
        privateRooms: [
          { id: "private-1", name: "탐정 밀담", maxMembers: 2, timeLimitSeconds: 600 },
        ],
      }),
    });

    fireEvent.change(within(panel).getByLabelText("최대 인원"), { target: { value: "1" } });
    expect(onUpdate).toHaveBeenLastCalledWith("node-1", {
      discussionRoomPolicy: expect.objectContaining({
        privateRooms: [
          { id: "private-1", name: "밀담방 1", maxMembers: 2, timeLimitSeconds: 600 },
        ],
      }),
    });

    fireEvent.change(within(panel).getByLabelText("제한시간 (분)"), { target: { value: "" } });
    expect(onUpdate).toHaveBeenLastCalledWith("node-1", {
      discussionRoomPolicy: expect.objectContaining({
        privateRooms: [
          { id: "private-1", name: "밀담방 1", maxMembers: 2, timeLimitSeconds: null },
        ],
      }),
    });
  });

  it("삭제 후 밀담방을 다시 추가해도 기존 ID와 충돌하지 않는다", () => {
    const onUpdate = vi.fn();
    const node = makeNode({
      phase_type: "discussion",
      discussionRoomPolicy: {
        enabled: true,
        mainRoomName: "전체토론방",
        privateRooms: [
          { id: "private-1", name: "밀담방 1", maxMembers: 2, timeLimitSeconds: null },
          { id: "private-2", name: "밀담방 2", maxMembers: 2, timeLimitSeconds: null },
          { id: "private-3", name: "밀담방 3", maxMembers: 2, timeLimitSeconds: null },
        ],
        closeBehavior: "return_to_main",
      },
    });
    const { rerender } = renderWithQC(
      <PhaseNodePanel node={node} themeId="t1" onUpdate={onUpdate} />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "삭제" })[1]);
    expect(onUpdate).toHaveBeenLastCalledWith("node-1", {
      discussionRoomPolicy: expect.objectContaining({
        privateRooms: [
          { id: "private-1", name: "밀담방 1", maxMembers: 2, timeLimitSeconds: null },
          { id: "private-3", name: "밀담방 3", maxMembers: 2, timeLimitSeconds: null },
        ],
      }),
    });

    onUpdate.mockClear();
    rerender(
      <QueryClientProvider
        client={new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })}
      >
        <PhaseNodePanel
          node={makeNode({
            phase_type: "discussion",
            discussionRoomPolicy: {
              enabled: true,
              mainRoomName: "전체토론방",
              privateRooms: [
                { id: "private-1", name: "밀담방 1", maxMembers: 2, timeLimitSeconds: null },
                { id: "private-3", name: "밀담방 3", maxMembers: 2, timeLimitSeconds: null },
              ],
              closeBehavior: "return_to_main",
            },
          })}
          themeId="t1"
          onUpdate={onUpdate}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "밀담방 추가" }));
    expect(onUpdate).toHaveBeenLastCalledWith("node-1", {
      discussionRoomPolicy: expect.objectContaining({
        privateRooms: [
          { id: "private-1", name: "밀담방 1", maxMembers: 2, timeLimitSeconds: null },
          { id: "private-3", name: "밀담방 3", maxMembers: 2, timeLimitSeconds: null },
          { id: "private-4", name: "밀담방 4", maxMembers: 2, timeLimitSeconds: null },
        ],
      }),
    });
  });

  it("투표/질문 장면은 질문 상세 없이 시간까지만 표시한다", () => {
    renderWithQC(
      <PhaseNodePanel
        node={makeNode({ phase_type: "voting", duration: 10 })}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );

    expect((screen.getByLabelText("타입") as HTMLSelectElement).value).toBe("voting");
    expect(screen.getByLabelText("시간 (분)")).toBeDefined();
    expect(screen.queryByText("토론방 설정")).toBeNull();
    expect(screen.queryByText("읽기 대사 배치")).toBeNull();
    expect(screen.queryByText("질문 선택")).toBeNull();
    expect(screen.queryByText("장면 시작 트리거")).toBeNull();
  });

  it("리딩 장면은 진행 시간 없이 읽기 대사 배치만 표시한다", () => {
    renderWithQC(
      <PhaseNodePanel
        node={makeNode({ phase_type: "story_progression", duration: 10 })}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );

    expect((screen.getByLabelText("타입") as HTMLSelectElement).value).toBe("story_progression");
    expect(screen.getAllByText("읽기 대사 배치").length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText("대사 이름으로 찾기")).toBeDefined();
    expect(screen.queryByLabelText("시간 (분)")).toBeNull();
    expect(screen.queryByText("자동 진행")).toBeNull();
    expect(screen.queryByText("토론방 설정")).toBeNull();
    expect(screen.queryByText("장면 시작 트리거")).toBeNull();
  });
});
