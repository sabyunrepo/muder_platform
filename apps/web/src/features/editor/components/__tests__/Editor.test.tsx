import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Hoisted mocks (available inside vi.mock factories)
// ---------------------------------------------------------------------------

const {
  navigateMock,
  toastSuccess,
  toastError,
  mutateMock,
  useEditorThemesMock,
  useCreateThemeMock,
  useDeleteThemeMock,
  usePublishThemeMock,
  useUnpublishThemeMock,
  useUpdateThemeMock,
  useEditorCharactersMock,
  useDeleteCharacterMock,
  useUpdateConfigJsonMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  mutateMock: vi.fn(),
  useEditorThemesMock: vi.fn(),
  useCreateThemeMock: vi.fn(),
  useDeleteThemeMock: vi.fn(),
  usePublishThemeMock: vi.fn(),
  useUnpublishThemeMock: vi.fn(),
  useUpdateThemeMock: vi.fn(),
  useEditorCharactersMock: vi.fn(),
  useDeleteCharacterMock: vi.fn(),
  useUpdateConfigJsonMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: react-router
// ---------------------------------------------------------------------------

vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
}));

// ---------------------------------------------------------------------------
// Mock: sonner
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

// ---------------------------------------------------------------------------
// Mock: @/features/editor/api
// ---------------------------------------------------------------------------

vi.mock("@/features/editor/api", () => ({
  useEditorThemes: () => useEditorThemesMock(),
  useCreateTheme: () => useCreateThemeMock(),
  useDeleteTheme: () => useDeleteThemeMock(),
  usePublishTheme: () => usePublishThemeMock(),
  useUnpublishTheme: () => useUnpublishThemeMock(),
  useUpdateTheme: () => useUpdateThemeMock(),
  useEditorCharacters: () => useEditorCharactersMock(),
  useDeleteCharacter: () => useDeleteCharacterMock(),
  useUpdateConfigJson: () => useUpdateConfigJsonMock(),
}));

// ---------------------------------------------------------------------------
// Mock: @/features/editor/constants
// ---------------------------------------------------------------------------

vi.mock("@/features/editor/constants", () => ({
  STATUS_LABEL: { DRAFT: "초안", PUBLISHED: "출판됨" },
  STATUS_COLOR: {
    DRAFT: "bg-slate-600 text-slate-200",
    PUBLISHED: "bg-emerald-600 text-emerald-100",
  },
  MODULE_CATEGORIES: [
    {
      key: "core",
      label: "코어",
      modules: [
        { id: "connection", name: "접속 관리", description: "플레이어 접속/재접속 처리" },
        { id: "room", name: "방 관리", description: "방 생성/참가/나가기" },
      ],
    },
    {
      key: "progression",
      label: "진행",
      modules: [
        { id: "script_progression", name: "스크립트 진행", description: "순차적 페이즈 진행" },
      ],
    },
    {
      key: "communication",
      label: "소통",
      modules: [
        { id: "text_chat", name: "텍스트 채팅", description: "전체/그룹 채팅" },
      ],
    },
    {
      key: "decision",
      label: "결정",
      modules: [
        { id: "voting", name: "투표", description: "다수결 투표 시스템" },
      ],
    },
    {
      key: "exploration",
      label: "탐색",
      modules: [
        { id: "floor_exploration", name: "층 탐색", description: "건물 층별 탐색" },
      ],
    },
    {
      key: "clue_distribution",
      label: "단서 배포",
      modules: [
        { id: "conditional_clue", name: "조건부 단서", description: "조건 충족 시 단서 제공" },
      ],
    },
  ],
  EDITOR_TABS: [
    { key: "overview", label: "개요" },
    { key: "characters", label: "캐릭터" },
    { key: "modules", label: "모듈" },
    { key: "config", label: "설정 JSON" },
  ],
}));

// ---------------------------------------------------------------------------
// Mock: CharacterForm (used inside CharactersTab)
// ---------------------------------------------------------------------------

vi.mock("../CharacterForm", () => ({
  CharacterForm: () => <div data-testid="character-form" />,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { EditorDashboard } from "../EditorDashboard";
import { PublishBar } from "../PublishBar";
import { OverviewTab } from "../OverviewTab";
import { CharactersTab } from "../CharactersTab";
import { ConfigJsonTab } from "../ConfigJsonTab";
import { ModulesTab } from "../ModulesTab";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockTheme = {
  id: "theme-1",
  title: "테스트 테마",
  slug: "test-theme",
  description: "테스트 설명",
  cover_image: null,
  min_players: 4,
  max_players: 6,
  duration_min: 90,
  price: 0,
  status: "DRAFT" as const,
  config_json: { modules: ["text_chat", "voting"] },
  version: 1,
  created_at: "2026-04-05T00:00:00Z",
};

const mockPublishedTheme = {
  ...mockTheme,
  id: "theme-2",
  title: "출판된 테마",
  status: "PUBLISHED" as const,
};

const mockCharacters = [
  {
    id: "char-1",
    theme_id: "theme-1",
    name: "탐정",
    description: "사건을 조사하는 탐정",
    image_url: null,
    is_culprit: false,
    sort_order: 1,
  },
  {
    id: "char-2",
    theme_id: "theme-1",
    name: "범인 캐릭터",
    description: "진짜 범인",
    image_url: null,
    is_culprit: true,
    sort_order: 2,
  },
];

const mockThemeSummaries = [
  {
    id: "theme-1",
    title: "테스트 테마",
    status: "DRAFT" as const,
    min_players: 4,
    max_players: 6,
    version: 1,
    created_at: "2026-04-05T00:00:00Z",
  },
  {
    id: "theme-2",
    title: "출판된 테마",
    status: "PUBLISHED" as const,
    min_players: 3,
    max_players: 8,
    version: 2,
    created_at: "2026-04-04T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultMutationReturn() {
  return { mutate: mutateMock, isPending: false };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// =========================================================================
// 1. EditorDashboard
// =========================================================================

describe("EditorDashboard", () => {
  beforeEach(() => {
    useCreateThemeMock.mockReturnValue(defaultMutationReturn());
    useDeleteThemeMock.mockReturnValue(defaultMutationReturn());
  });

  it("로딩 중일 때 스피너를 표시한다", () => {
    useEditorThemesMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const { container } = render(<EditorDashboard />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).not.toBeNull();
  });

  it("테마가 없을 때 빈 상태를 표시한다", () => {
    useEditorThemesMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    render(<EditorDashboard />);
    expect(screen.getByText("아직 테마가 없습니다")).toBeDefined();
  });

  it("테마 카드에 제목과 상태를 렌더링한다", () => {
    useEditorThemesMock.mockReturnValue({
      data: mockThemeSummaries,
      isLoading: false,
      isError: false,
    });

    render(<EditorDashboard />);
    expect(screen.getByText("테스트 테마")).toBeDefined();
    expect(screen.getByText("출판된 테마")).toBeDefined();
    expect(screen.getByText("초안")).toBeDefined();
    expect(screen.getByText("출판됨")).toBeDefined();
  });

  it("'새 테마 만들기' 버튼이 존재한다", () => {
    useEditorThemesMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    render(<EditorDashboard />);
    const buttons = screen.getAllByText("새 테마 만들기");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("생성 버튼 클릭 시 '새 테마 만들기' 모달이 열린다", () => {
    useEditorThemesMock.mockReturnValue({
      data: mockThemeSummaries,
      isLoading: false,
      isError: false,
    });

    render(<EditorDashboard />);

    // 헤더의 '새 테마 만들기' 버튼 클릭
    const createButton = screen.getByText("새 테마 만들기");
    fireEvent.click(createButton);

    // Modal이 열리면 title="새 테마 만들기"인 dialog가 나타남
    const dialog = screen.getByRole("dialog", { name: "새 테마 만들기" });
    expect(dialog).toBeDefined();
  });

  it("에러 발생 시 에러 메시지를 표시한다", () => {
    useEditorThemesMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<EditorDashboard />);
    expect(
      screen.getByText("테마 목록을 불러오는 데 실패했습니다."),
    ).toBeDefined();
  });
});

// =========================================================================
// 2. PublishBar
// =========================================================================

describe("PublishBar", () => {
  beforeEach(() => {
    usePublishThemeMock.mockReturnValue(defaultMutationReturn());
    useUnpublishThemeMock.mockReturnValue(defaultMutationReturn());
  });

  it("테마 제목과 상태 배지를 표시한다", () => {
    render(<PublishBar theme={mockTheme} />);
    expect(screen.getByText("테스트 테마")).toBeDefined();
    expect(screen.getByText("초안")).toBeDefined();
  });

  it("DRAFT 테마에 '출판하기' 버튼을 표시한다", () => {
    render(<PublishBar theme={mockTheme} />);
    expect(screen.getByText("출판하기")).toBeDefined();
  });

  it("PUBLISHED 테마에 '비공개로 전환' 버튼을 표시한다", () => {
    render(<PublishBar theme={mockPublishedTheme} />);
    expect(screen.getByText("비공개로 전환")).toBeDefined();
  });

  it("PUBLISHED 테마에는 '출판하기' 버튼이 없다", () => {
    render(<PublishBar theme={mockPublishedTheme} />);
    expect(screen.queryByText("출판하기")).toBeNull();
  });

  it("DRAFT 테마에는 '비공개로 전환' 버튼이 없다", () => {
    render(<PublishBar theme={mockTheme} />);
    expect(screen.queryByText("비공개로 전환")).toBeNull();
  });
});

// =========================================================================
// 3. OverviewTab
// =========================================================================

describe("OverviewTab", () => {
  beforeEach(() => {
    useUpdateThemeMock.mockReturnValue(defaultMutationReturn());
  });

  it("테마 데이터가 폼에 미리 채워져 렌더링된다", () => {
    render(<OverviewTab themeId="theme-1" theme={mockTheme} />);

    // Input의 id는 label을 lowercase + 하이픈 변환한 값
    const titleInput = screen.getByDisplayValue("테스트 테마");
    expect(titleInput).toBeDefined();

    // description textarea
    const descInput = screen.getByDisplayValue("테스트 설명");
    expect(descInput).toBeDefined();
  });

  it("빈 제목으로 제출 시 에러를 표시한다", () => {
    render(<OverviewTab themeId="theme-1" theme={mockTheme} />);

    // 제목을 공백만으로 설정 (trim 후 빈 문자열)
    const titleInput = screen.getByDisplayValue("테스트 테마");
    fireEvent.change(titleInput, { target: { value: "   " } });

    // 폼 제출 (저장 버튼 클릭)
    const submitButton = screen.getByText("저장");
    fireEvent.click(submitButton);

    // 에러 메시지 표시
    expect(screen.getByText("제목은 필수입니다")).toBeDefined();
    // mutate가 호출되지 않아야 한다
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("유효한 제출 시 mutate를 올바른 body로 호출한다", () => {
    render(<OverviewTab themeId="theme-1" theme={mockTheme} />);

    // 제목 변경
    const titleInput = screen.getByDisplayValue("테스트 테마");
    fireEvent.change(titleInput, { target: { value: "수정된 제목" } });

    // 폼 제출
    const submitButton = screen.getByText("저장");
    fireEvent.click(submitButton);

    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [body] = mutateMock.mock.calls[0];
    expect(body).toHaveProperty("title", "수정된 제목");
    expect(body).toHaveProperty("min_players", 4);
    expect(body).toHaveProperty("max_players", 6);
    expect(body).toHaveProperty("duration_min", 90);
  });
});

// =========================================================================
// 4. CharactersTab
// =========================================================================

describe("CharactersTab", () => {
  beforeEach(() => {
    useDeleteCharacterMock.mockReturnValue(defaultMutationReturn());
  });

  it("로딩 중일 때 스피너를 표시한다", () => {
    useEditorCharactersMock.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { container } = render(<CharactersTab themeId="theme-1" />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).not.toBeNull();
  });

  it("캐릭터가 없을 때 빈 상태를 표시한다", () => {
    useEditorCharactersMock.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<CharactersTab themeId="theme-1" />);
    expect(screen.getByText("등록된 캐릭터가 없습니다")).toBeDefined();
  });

  it("캐릭터 이름을 렌더링한다", () => {
    useEditorCharactersMock.mockReturnValue({
      data: mockCharacters,
      isLoading: false,
    });

    render(<CharactersTab themeId="theme-1" />);
    expect(screen.getByText("탐정")).toBeDefined();
    expect(screen.getByText("범인 캐릭터")).toBeDefined();
  });

  it("범인 캐릭터에 '범인' 배지를 표시한다", () => {
    useEditorCharactersMock.mockReturnValue({
      data: mockCharacters,
      isLoading: false,
    });

    render(<CharactersTab themeId="theme-1" />);
    expect(screen.getByText("범인")).toBeDefined();
  });

  it("'캐릭터 추가' 버튼이 존재한다", () => {
    useEditorCharactersMock.mockReturnValue({
      data: mockCharacters,
      isLoading: false,
    });

    render(<CharactersTab themeId="theme-1" />);
    expect(screen.getByText("캐릭터 추가")).toBeDefined();
  });
});

// =========================================================================
// 5. ConfigJsonTab
// =========================================================================

describe("ConfigJsonTab", () => {
  beforeEach(() => {
    useUpdateConfigJsonMock.mockReturnValue(defaultMutationReturn());
  });

  it("JSON 콘텐츠가 textarea에 렌더링된다", () => {
    const { container } = render(
      <ConfigJsonTab themeId="theme-1" theme={mockTheme} />,
    );
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.value).toContain("text_chat");
    expect(textarea.value).toContain("voting");
  });

  it("텍스트 수정 시 '변경사항 있음' 배지를 표시한다", () => {
    const { container } = render(
      <ConfigJsonTab themeId="theme-1" theme={mockTheme} />,
    );
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;

    // 초기에는 배지가 없어야 한다
    expect(screen.queryByText("변경사항 있음")).toBeNull();

    // 텍스트 수정
    fireEvent.change(textarea, { target: { value: '{"modules":["voting"]}' } });

    expect(screen.getByText("변경사항 있음")).toBeDefined();
  });

  it("유효하지 않은 JSON 저장 시 에러를 표시한다", () => {
    const { container } = render(
      <ConfigJsonTab themeId="theme-1" theme={mockTheme} />,
    );
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;

    // 잘못된 JSON 입력
    fireEvent.change(textarea, { target: { value: "{invalid json" } });

    // 저장 버튼 클릭
    const saveButton = screen.getByText("저장");
    fireEvent.click(saveButton);

    expect(screen.getByText("유효하지 않은 JSON 형식입니다")).toBeDefined();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("유효한 JSON 저장 시 mutate를 호출한다", () => {
    const { container } = render(
      <ConfigJsonTab themeId="theme-1" theme={mockTheme} />,
    );
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;

    // 유효한 JSON으로 수정
    const newJson = '{"modules":["voting"]}';
    fireEvent.change(textarea, { target: { value: newJson } });

    // 저장 버튼 클릭
    const saveButton = screen.getByText("저장");
    fireEvent.click(saveButton);

    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [parsed] = mutateMock.mock.calls[0];
    expect(parsed).toHaveProperty("modules");
    expect((parsed as Record<string, unknown>).modules).toContain("voting");
  });
});

// =========================================================================
// 6. ModulesTab
// =========================================================================

describe("ModulesTab", () => {
  beforeEach(() => {
    useUpdateConfigJsonMock.mockReturnValue(defaultMutationReturn());
  });

  it("6개 카테고리 라벨을 모두 렌더링한다", () => {
    render(<ModulesTab themeId="theme-1" theme={mockTheme} />);

    expect(screen.getByText("코어")).toBeDefined();
    expect(screen.getByText("진행")).toBeDefined();
    expect(screen.getByText("소통")).toBeDefined();
    expect(screen.getByText("결정")).toBeDefined();
    expect(screen.getByText("탐색")).toBeDefined();
    expect(screen.getByText("단서 배포")).toBeDefined();
  });

  it("선택된 모듈의 체크박스가 체크되어 있다", () => {
    render(<ModulesTab themeId="theme-1" theme={mockTheme} />);

    // mockTheme.config_json.modules = ["text_chat", "voting"]
    const checkboxes = screen.getAllByRole("checkbox");

    // text_chat과 voting에 해당하는 체크박스 찾기
    // 라벨에서 모듈 이름으로 찾기
    const textChatLabel = screen.getByText("텍스트 채팅");
    const votingLabel = screen.getByText("투표");

    // 체크박스는 label의 자식으로 있음 — label 요소 내부의 input을 찾는다
    const textChatCheckbox = textChatLabel
      .closest("label")
      ?.querySelector("input[type='checkbox']") as HTMLInputElement;
    const votingCheckbox = votingLabel
      .closest("label")
      ?.querySelector("input[type='checkbox']") as HTMLInputElement;

    expect(textChatCheckbox).not.toBeNull();
    expect(textChatCheckbox.checked).toBe(true);
    expect(votingCheckbox).not.toBeNull();
    expect(votingCheckbox.checked).toBe(true);

    // 선택되지 않은 모듈은 체크 해제
    const connectionLabel = screen.getByText("접속 관리");
    const connectionCheckbox = connectionLabel
      .closest("label")
      ?.querySelector("input[type='checkbox']") as HTMLInputElement;
    expect(connectionCheckbox.checked).toBe(false);
  });

  it("총 선택 개수를 표시한다", () => {
    render(<ModulesTab themeId="theme-1" theme={mockTheme} />);

    // mockTheme에서 text_chat, voting 2개 선택 / 총 7개 모듈 (mock categories 합계)
    expect(screen.getByText("2/7 모듈 선택됨")).toBeDefined();
  });
});
