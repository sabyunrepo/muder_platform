import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { forwardRef, useImperativeHandle, type ComponentType, type ReactNode } from "react";

const { useFlowDataMock, useEditorCharactersMock, addNodeMock, updateNodeDataMock, mutateMock, configMutateMock, useUpdateFlowNodeMock, refetchMock, toastErrorMock, useMediaListMock, useMediaCategoriesMock, useMediaDownloadUrlMock } = vi.hoisted(() => ({
  useFlowDataMock: vi.fn(),
  useEditorCharactersMock: vi.fn(),
  addNodeMock: vi.fn(),
  updateNodeDataMock: vi.fn(),
  mutateMock: vi.fn(),
  configMutateMock: vi.fn(),
  useUpdateFlowNodeMock: vi.fn(),
  refetchMock: vi.fn(),
  toastErrorMock: vi.fn(),
  useMediaListMock: vi.fn(),
  useMediaCategoriesMock: vi.fn(),
  useMediaDownloadUrlMock: vi.fn(),
}));

vi.mock("../../../hooks/useFlowData", () => ({
  useFlowData: () => useFlowDataMock(),
}));

vi.mock("../../../flowApi", () => ({
  useUpdateFlowNode: () => useUpdateFlowNodeMock(),
}));

vi.mock("@/features/editor/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/editor/api")>();
  return {
    ...actual,
    useEditorCharacters: () => useEditorCharactersMock(),
  };
});

vi.mock("../../../editorConfigApi", () => ({
  useUpdateConfigJson: () => ({ mutate: configMutateMock, isPending: false }),
}));

vi.mock("@/features/editor/mediaApi", () => ({
  useMediaList: (...args: unknown[]) => useMediaListMock(...args),
  useMediaCategories: (...args: unknown[]) => useMediaCategoriesMock(...args),
  useMediaDownloadUrl: (...args: unknown[]) => useMediaDownloadUrlMock(...args),
}));

vi.mock("@mdxeditor/editor", () => ({
  MDXEditor: forwardRef<
    { insertMarkdown: (snippet: string) => void },
    {
      markdown: string;
      onChange: (markdown: string) => void;
      plugins?: Array<{ jsxComponentDescriptors?: Array<{ name: string; Editor: ComponentType<{ mdastNode: { attributes: Array<{ name: string; value: string }> } }> }> }>;
    }
  >(({ markdown, onChange, plugins = [] }, ref) => {
    useImperativeHandle(ref, () => ({
      insertMarkdown: (snippet: string) => onChange(`${markdown}${snippet}`),
    }));
    const mediaEmbedDescriptor = plugins
      .flatMap((plugin) => plugin.jsxComponentDescriptors ?? [])
      .find((descriptor) => descriptor.name === "MediaEmbed");
    const mediaEmbeds = Array.from(markdown.matchAll(/<MediaEmbed\s+([^>]+)\/>/g));
    return (
      <div data-testid="mdx-editor-surface">
        <textarea
          aria-label="editable markdown"
          value={markdown}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        {mediaEmbedDescriptor
          ? mediaEmbeds.map((match) => {
              const attrs = match[1] ?? "";
              const mdastNode = {
                attributes: Array.from(attrs.matchAll(/(\w+)=["']([^"']+)["']/g)).map((attr) => ({
                  name: attr[1],
                  value: attr[2],
                })),
              };
              const Editor = mediaEmbedDescriptor.Editor;
              return <Editor key={`${match.index}:${match[0]}`} mdastNode={mdastNode} />;
            })
          : null}
      </div>
    );
  }),
  jsxPlugin: vi.fn((params) => params),
  useLexicalNodeRemove: vi.fn(() => vi.fn()),
  useMdastNodeUpdater: vi.fn(() => vi.fn()),
  headingsPlugin: vi.fn(() => ({})),
  listsPlugin: vi.fn(() => ({})),
  quotePlugin: vi.fn(() => ({})),
  linkPlugin: vi.fn(() => ({})),
  thematicBreakPlugin: vi.fn(() => ({})),
  toolbarPlugin: vi.fn(() => ({})),
  UndoRedo: () => null,
  BlockTypeSelect: () => null,
  BoldItalicUnderlineToggles: () => null,
  ListsToggle: () => null,
  CreateLink: () => null,
}));

vi.mock("sonner", () => ({
  toast: { error: toastErrorMock, success: vi.fn() },
}));

import { EndingEntitySubTab, EndingQuestionsTab } from "../EndingEntitySubTab";

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function clickLastButton(name: RegExp) {
  const buttons = screen.getAllByRole("button", { name });
  fireEvent.click(buttons[buttons.length - 1]);
}


const theme = {
  id: "theme-1",
  title: "테마",
  slug: "theme",
  description: null,
  cover_image: null,
  min_players: 4,
  max_players: 6,
  duration_min: 120,
  price: 0,
  coin_price: 0,
  status: "DRAFT" as const,
  config_json: {
    modules: {
      ending_branch: {
        enabled: true,
        config: {
          questions: [{ id: "q1", text: "범인은 누구인가?", type: "single", choices: ["하윤", "민재"], impact: "branch", respondents: "all" }],
          matrix: [{ priority: 1, ending: "ending-1", condition: { in: ["하윤", { var: "answers.q1.choices" }] } }],
          defaultEnding: "ending-2",
        },
      },
    },
  },
  version: 7,
  created_at: "2026-05-04T00:00:00Z",
  review_note: null,
  reviewed_at: null,
  reviewed_by: null,
};

const makeNode = (id: string, data: Record<string, unknown> = {}, type = "ending") => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label: "진실", description: "사건의 전말", ...data },
});

beforeEach(() => {
  useUpdateFlowNodeMock.mockReturnValue({ mutate: mutateMock });
  useMediaListMock.mockReturnValue({ data: [], isLoading: false });
  useMediaCategoriesMock.mockReturnValue({ data: [], isLoading: false });
  useMediaDownloadUrlMock.mockReturnValue({ data: null, isLoading: false, isError: false });
  useEditorCharactersMock.mockReturnValue({
    data: [
      {
        id: "char-1",
        theme_id: "theme-1",
        name: "하윤",
        description: null,
        image_url: null,
        is_culprit: false,
        mystery_role: "detective",
        sort_order: 1,
        is_playable: true,
        show_in_intro: true,
        can_speak_in_reading: true,
        is_voting_candidate: true,
        endcard_title: "하윤의 후일담",
        endcard_body: "사건 이후의 선택",
        endcard_image_url: null,
        alias_rules: [],
      },
      {
        id: "char-2",
        theme_id: "theme-1",
        name: "민재",
        description: null,
        image_url: null,
        is_culprit: false,
        mystery_role: "suspect",
        sort_order: 2,
        is_playable: true,
        show_in_intro: true,
        can_speak_in_reading: true,
        is_voting_candidate: true,
        endcard_title: null,
        endcard_body: null,
        endcard_image_url: null,
        alias_rules: [],
      },
    ],
    isLoading: false,
    isError: false,
  });
  useFlowDataMock.mockReturnValue({
    nodes: [
      makeNode("ending-1", {
        label: "진실",
        icon: "🎭",
        endingContent: "범인은 밝혀졌다.",
        endingVisibility: "players_only",
        endingSpoilerWarning: "스포일러 주의",
        endingShareText: "오늘의 추리는 어땠나요?",
      }),
      makeNode("phase-1", { label: "1막" }, "phase"),
      makeNode("ending-2", { label: "오판", description: "잘못된 선택" }),
    ],
    edges: [{ id: "edge-1", source: "phase-1", target: "ending-1" }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: refetchMock,
    addNode: addNodeMock,
    updateNodeData: updateNodeDataMock,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EndingEntitySubTab", () => {
  it("Flow의 ending 노드만 결말 목록에 표시한다", () => {
    renderWithClient(<EndingEntitySubTab themeId="theme-1" theme={theme} />);

    expect(screen.getByText("결말 목록")).toBeDefined();
    expect(screen.getAllByText("진실").length).toBeGreaterThan(0);
    expect(screen.getAllByText("오판").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("결말 판정 준비")).toBeDefined();
    expect(screen.getByText("본문 작성")).toBeDefined();
    expect(screen.queryByText("참가자에게만 공개")).toBeNull();
    expect(screen.queryByText("캐릭터 결과 카드 1/2명 작성")).toBeNull();
    expect(screen.queryByText("1막")).toBeNull();
  });

  it("결말이 없으면 제작자가 이해할 수 있는 빈 상태를 보여준다", () => {
    useFlowDataMock.mockReturnValue({
      nodes: [],
      edges: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchMock,
      addNode: addNodeMock,
      updateNodeData: updateNodeDataMock,
    });

    renderWithClient(<EndingEntitySubTab themeId="theme-1" theme={theme} />);

    expect(screen.getByText("아직 결말이 없습니다")).toBeDefined();
    expect(screen.getByText(/Flow에서 결말 노드를 추가하면/)).toBeDefined();
  });


  it("결말 목록을 불러오지 못하면 에러 안내와 재시도 버튼을 보여준다", () => {
    useFlowDataMock.mockReturnValue({
      nodes: [],
      edges: [],
      isLoading: false,
      isError: true,
      error: new Error("권한이 없습니다"),
      refetch: refetchMock,
      addNode: addNodeMock,
      updateNodeData: updateNodeDataMock,
    });

    renderWithClient(<EndingEntitySubTab themeId="theme-1" theme={theme} />);

    expect(screen.getByText("결말 목록을 불러오지 못했습니다.")).toBeDefined();
    expect(screen.queryByText("권한이 없습니다")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
    expect(refetchMock).toHaveBeenCalled();
  });

  it("결말 추가 버튼은 ending 노드 생성을 요청한다", () => {
    renderWithClient(<EndingEntitySubTab themeId="theme-1" theme={theme} />);

    fireEvent.click(screen.getByText("결말 추가"));

    expect(addNodeMock).toHaveBeenCalledWith("ending", expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number),
    }));
  });

  it("검색어로 결말 목록을 좁힌다", () => {
    renderWithClient(<EndingEntitySubTab themeId="theme-1" theme={theme} />);

    fireEvent.change(screen.getByPlaceholderText("결말 검색"), { target: { value: "오판" } });

    expect(screen.getAllByText("오판").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /오판/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: /진실/ })).toBeNull();
  });

  it("상세 입력을 변경하면 선택한 결말 노드 데이터만 갱신한다", () => {
    renderWithClient(<EndingEntitySubTab themeId="theme-1" theme={theme} />);

    fireEvent.change(screen.getByLabelText("결말 이름"), { target: { value: "자비" } });

    expect(updateNodeDataMock).toHaveBeenCalledWith("ending-1", { label: "자비" });

    fireEvent.blur(screen.getByLabelText("결말 이름"));
    expect(mutateMock).toHaveBeenCalledWith(
      { nodeId: "ending-1", body: { data: expect.objectContaining({ label: "자비" }) } },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("결말 상세에서 필요한 입력만 보여주고 본문을 Markdown 작성기로 저장한다", () => {
    renderWithClient(<EndingEntitySubTab themeId="theme-1" theme={theme} />);

    expect(screen.queryByLabelText("아이콘")).toBeNull();
    expect(screen.queryByLabelText("표시 색상")).toBeNull();
    expect(screen.queryByLabelText("공개 설명")).toBeNull();
    expect(screen.queryByLabelText("공개 범위")).toBeNull();
    expect(screen.queryByLabelText("스포일러 안내")).toBeNull();
    expect(screen.queryByLabelText("감상 공유 문구")).toBeNull();
    expect(screen.getByRole("region", { name: "결말 본문 작성기" })).toBeDefined();
    expect(screen.getByRole("button", { name: "결말 이미지 삽입" })).toBeDefined();
    expect(screen.getByRole("button", { name: "결말 영상 삽입" })).toBeDefined();

    fireEvent.change(screen.getByLabelText("editable markdown"), {
      target: { value: "진실은 모두에게 남았다." },
    });
    expect(updateNodeDataMock).toHaveBeenLastCalledWith("ending-1", {
      endingContent: "진실은 모두에게 남았다.",
    });
  });

  it("결말 판정 질문과 규칙을 제작자용 UI로 저장한다", () => {
    renderWithClient(<EndingQuestionsTab themeId="theme-1" theme={theme} />);

    expect(screen.getByRole("heading", { name: "질문 관리", level: 3 })).toBeDefined();
    fireEvent.change(screen.getByLabelText("질문 1 내용"), { target: { value: "진범은 누구인가?" } });
    fireEvent.click(screen.getByRole("button", { name: "질문 설정 저장" }));

    expect(configMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 7,
        modules: expect.objectContaining({
          ending_branch: expect.objectContaining({
            config: expect.objectContaining({
              questions: [expect.objectContaining({ text: "진범은 누구인가?" })],
              matrix: [
                expect.objectContaining({
                  ending: "ending-1",
                  conditions: { in: ["하윤", { var: "answers.q1.choices" }] },
                }),
              ],
              defaultEnding: "ending-2",
            }),
          }),
        }),
      }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("결말 질문 대상을 특정 플레이어 여러 명으로 저장한다", () => {
    renderWithClient(<EndingQuestionsTab themeId="theme-1" theme={theme} />);

    clickLastButton(/하윤/);
    clickLastButton(/민재/);
    fireEvent.click(screen.getByRole("button", { name: "질문 설정 저장" }));

    expect(configMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modules: expect.objectContaining({
          ending_branch: expect.objectContaining({
            config: expect.objectContaining({
              questions: [
                expect.objectContaining({
                  respondents: "char-1",
                  target: { type: "specific_players", characterIds: ["char-1", "char-2"] },
                }),
              ],
            }),
          }),
        }),
      }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("특정 플레이어 질문에서 대상이 비면 저장하지 않고 경고한다", () => {
    renderWithClient(<EndingQuestionsTab themeId="theme-1" theme={theme} />);

    clickLastButton(/하윤/);
    clickLastButton(/하윤/);
    fireEvent.click(screen.getByRole("button", { name: "질문 설정 저장" }));

    expect(configMutateMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith("특정 플레이어 질문은 받을 캐릭터를 1명 이상 선택해야 합니다");
  });

  it("삭제된 캐릭터 참조를 깨지지 않는 fallback으로 표시한다", () => {
    renderWithClient(
      <EndingQuestionsTab
        themeId="theme-1"
        theme={{
          ...theme,
          config_json: {
            modules: {
              ending_branch: {
                enabled: true,
                config: {
                  questions: [{
                    id: "q1",
                    text: "사라진 대상 질문",
                    type: "single",
                    choices: ["A", "B"],
                    impact: "branch",
                    target: { type: "specific_players", characterIds: ["missing-character"] },
                  }],
                  matrix: [{ priority: 1, ending: "ending-1", condition: { in: ["A", { var: "answers.q1.choices" }] } }],
                  defaultEnding: "ending-2",
                },
              },
            },
          },
        }}
      />,
    );

    expect(screen.getAllByText("삭제된 캐릭터").length).toBeGreaterThan(0);
  });

  it("결말 선택지는 같은 질문 안에서 중복 저장되지 않는다", () => {
    renderWithClient(<EndingQuestionsTab themeId="theme-1" theme={theme} />);

    fireEvent.change(screen.getByLabelText("질문 1 선택지 2"), { target: { value: "하윤" } });
    fireEvent.click(screen.getByRole("button", { name: "질문 설정 저장" }));

    expect(configMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modules: expect.objectContaining({
          ending_branch: expect.objectContaining({
            config: expect.objectContaining({
              questions: [
                expect.objectContaining({
                  choices: ["하윤", "민재"],
                }),
              ],
            }),
          }),
        }),
      }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("가장 많이 선택된 답 기준 결말 규칙을 저장한다", () => {
    renderWithClient(<EndingEntitySubTab themeId="theme-1" theme={theme} />);

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByLabelText("집계 기준"), { target: { value: "winning" } });
    fireEvent.click(screen.getByRole("button", { name: "조건 저장" }));
    fireEvent.click(screen.getByRole("button", { name: "판정 규칙 저장" }));

    expect(configMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modules: expect.objectContaining({
          ending_branch: expect.objectContaining({
            config: expect.objectContaining({
              matrix: [
                expect.objectContaining({
                  ending: "ending-1",
                  conditions: { "==": [{ var: "answers.q1.winning" }, "하윤"] },
                }),
              ],
            }),
          }),
        }),
      }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("복수 선택 질문은 모두 정답 기준 결말 규칙을 저장한다", () => {
    renderWithClient(
      <EndingEntitySubTab
        themeId="theme-1"
        theme={{
          ...theme,
          config_json: {
            modules: {
              ending_branch: {
                enabled: true,
                config: {
                  questions: [{
                    id: "q1",
                    text: "확보한 증거는?",
                    type: "multi",
                    choices: ["피 묻은 장갑", "부서진 시계", "찢어진 편지"],
                    impact: "branch",
                    respondents: "all",
                  }],
                  matrix: [{ priority: 1, ending: "ending-1", condition: { in: ["피 묻은 장갑", { var: "answers.q1.choices" }] } }],
                  defaultEnding: "ending-2",
                },
              },
            },
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "부서진 시계" }));
    fireEvent.change(screen.getByLabelText("집계 기준"), { target: { value: "all" } });
    fireEvent.click(screen.getByRole("button", { name: "조건 저장" }));
    fireEvent.click(screen.getByRole("button", { name: "판정 규칙 저장" }));

    expect(configMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modules: expect.objectContaining({
          ending_branch: expect.objectContaining({
            config: expect.objectContaining({
              matrix: [
                expect.objectContaining({
                  ending: "ending-1",
                  conditions: {
                    and: [
                      { in: ["피 묻은 장갑", { var: "answers.q1.choices" }] },
                      { in: ["부서진 시계", { var: "answers.q1.choices" }] },
                    ],
                  },
                }),
              ],
            }),
          }),
        }),
      }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });
});
