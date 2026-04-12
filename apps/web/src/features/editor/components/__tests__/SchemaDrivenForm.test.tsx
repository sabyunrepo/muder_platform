import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  useTemplatesMock,
  useTemplateSchemaViaPreset,
} = vi.hoisted(() => ({
  useTemplatesMock: vi.fn(),
  useTemplateSchemaViaPreset: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: templateApi
// ---------------------------------------------------------------------------

vi.mock("@/features/editor/templateApi", () => ({
  useTemplates: () => useTemplatesMock(),
  useTemplateSchema: () => useTemplateSchemaViaPreset(),
  templateKeys: {
    all: ["templates"],
    list: () => ["templates", "list"],
    detail: (id: string) => ["templates", id],
    schema: (id: string) => ["templates", id, "schema"],
  },
}));

// ---------------------------------------------------------------------------
// Mock: themeStore
// ---------------------------------------------------------------------------

let mockSelectedGenre: string | null = null;
let mockSelectedPresetId: string | null = null;
const mockSetGenre = vi.fn((g: string | null) => { mockSelectedGenre = g; });
const mockSetPreset = vi.fn((p: string | null) => { mockSelectedPresetId = p; });
const mockUpdateField = vi.fn();

vi.mock("@/stores/themeStore", () => ({
  useThemeStore: () => ({
    selectedGenre: mockSelectedGenre,
    selectedPresetId: mockSelectedPresetId,
    configValues: {},
    isDirty: false,
    setGenre: mockSetGenre,
    setPreset: mockSetPreset,
    updateField: mockUpdateField,
    resetConfig: vi.fn(),
    setConfigValues: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { SchemaField } from "../SchemaField";
import { SchemaDrivenForm } from "../SchemaDrivenForm";
import { GenreSelect } from "../GenreSelect";
import { PresetSelect } from "../PresetSelect";
import type { JSONSchemaProperty, TemplateSchema } from "@/features/editor/templateApi";
import type { TemplateSummary } from "@/features/editor/templateApi";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockTemplates: TemplateSummary[] = [
  {
    id: "tpl-1",
    genre: "추리",
    name: "기본 추리",
    description: "기본 추리 프리셋",
    min_players: 4,
    max_players: 6,
    duration_min: 90,
  },
  {
    id: "tpl-2",
    genre: "추리",
    name: "심화 추리",
    description: "심화 추리 프리셋",
    min_players: 5,
    max_players: 8,
    duration_min: 120,
  },
  {
    id: "tpl-3",
    genre: "공포",
    name: "기본 공포",
    description: "기본 공포 프리셋",
    min_players: 3,
    max_players: 6,
    duration_min: 60,
  },
];

const mockSchema: TemplateSchema = {
  type: "object",
  title: "게임 설정",
  description: "게임의 기본 설정을 구성합니다",
  properties: {
    name: {
      type: "string",
      title: "이름",
      description: "게임 이름",
    },
    difficulty: {
      type: "string",
      title: "난이도",
      enum: ["easy", "normal", "hard"],
      default: "normal",
    },
    max_players: {
      type: "integer",
      title: "최대 플레이어",
      minimum: 2,
      maximum: 10,
      default: 6,
    },
    timer_enabled: {
      type: "boolean",
      title: "타이머 활성화",
      default: true,
    },
    tags: {
      type: "array",
      title: "태그",
      items: { type: "string" },
    },
    settings: {
      type: "object",
      title: "세부 설정",
      properties: {
        volume: {
          type: "number",
          title: "볼륨",
          minimum: 0,
          maximum: 100,
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockSelectedGenre = null;
  mockSelectedPresetId = null;
});

// =========================================================================
// 1. SchemaField — type mapping
// =========================================================================

describe("SchemaField", () => {
  it("string 타입은 text input을 렌더링한다", () => {
    const schema: JSONSchemaProperty = { type: "string", title: "이름" };
    const onChange = vi.fn();
    const { container } = render(
      <SchemaField schema={schema} path="name" value="" onChange={onChange} />,
    );
    const input = container.querySelector("input[type='text']") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(screen.getByText("이름")).toBeDefined();
  });

  it("string + enum은 select를 렌더링한다", () => {
    const schema: JSONSchemaProperty = {
      type: "string",
      title: "난이도",
      enum: ["easy", "normal", "hard"],
    };
    const onChange = vi.fn();
    const { container } = render(
      <SchemaField schema={schema} path="difficulty" value="normal" onChange={onChange} />,
    );
    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.value).toBe("normal");
    expect(screen.getByText("easy")).toBeDefined();
    expect(screen.getByText("hard")).toBeDefined();
  });

  it("number 타입은 number input을 렌더링한다", () => {
    const schema: JSONSchemaProperty = {
      type: "number",
      title: "볼륨",
      minimum: 0,
      maximum: 100,
    };
    const onChange = vi.fn();
    const { container } = render(
      <SchemaField schema={schema} path="volume" value={50} onChange={onChange} />,
    );
    const input = container.querySelector("input[type='number']") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe("50");
    expect(input.min).toBe("0");
    expect(input.max).toBe("100");
  });

  it("integer 타입은 number input을 렌더링한다", () => {
    const schema: JSONSchemaProperty = {
      type: "integer",
      title: "최대 인원",
      minimum: 2,
      maximum: 10,
    };
    const onChange = vi.fn();
    const { container } = render(
      <SchemaField schema={schema} path="max_players" value={6} onChange={onChange} />,
    );
    const input = container.querySelector("input[type='number']") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe("6");
  });

  it("boolean 타입은 checkbox를 렌더링한다", () => {
    const schema: JSONSchemaProperty = {
      type: "boolean",
      title: "타이머 활성화",
    };
    const onChange = vi.fn();
    const { container } = render(
      <SchemaField schema={schema} path="timer_enabled" value={true} onChange={onChange} />,
    );
    const checkbox = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(true);
  });

  it("boolean checkbox 변경 시 onChange를 호출한다", () => {
    const schema: JSONSchemaProperty = { type: "boolean", title: "활성화" };
    const onChange = vi.fn();
    const { container } = render(
      <SchemaField schema={schema} path="enabled" value={false} onChange={onChange} />,
    );
    const checkbox = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith("enabled", true);
  });

  it("array 타입은 항목 추가 버튼을 렌더링한다", () => {
    const schema: JSONSchemaProperty = {
      type: "array",
      title: "태그",
      items: { type: "string" },
    };
    const onChange = vi.fn();
    render(
      <SchemaField schema={schema} path="tags" value={[]} onChange={onChange} />,
    );
    expect(screen.getByText("항목 추가")).toBeDefined();
  });

  it("array 항목 추가 시 onChange를 호출한다", () => {
    const schema: JSONSchemaProperty = {
      type: "array",
      title: "태그",
      items: { type: "string" },
    };
    const onChange = vi.fn();
    render(
      <SchemaField schema={schema} path="tags" value={[]} onChange={onChange} />,
    );
    fireEvent.click(screen.getByText("항목 추가"));
    expect(onChange).toHaveBeenCalledWith("tags", [""]);
  });

  it("object 타입은 자식 필드를 재귀 렌더링한다", () => {
    const schema: JSONSchemaProperty = {
      type: "object",
      title: "세부 설정",
      properties: {
        volume: { type: "number", title: "볼륨" },
        muted: { type: "boolean", title: "음소거" },
      },
    };
    const onChange = vi.fn();
    const { container } = render(
      <SchemaField schema={schema} path="settings" value={{}} onChange={onChange} />,
    );
    expect(screen.getByText("볼륨")).toBeDefined();
    expect(screen.getByText("음소거")).toBeDefined();
    // Should have number + checkbox inputs
    expect(container.querySelector("input[type='number']")).not.toBeNull();
    expect(container.querySelector("input[type='checkbox']")).not.toBeNull();
  });

  it("schema description을 헬프 텍스트로 렌더링한다", () => {
    const schema: JSONSchemaProperty = {
      type: "string",
      title: "이름",
      description: "게임 이름을 입력하세요",
    };
    const onChange = vi.fn();
    render(
      <SchemaField schema={schema} path="name" value="" onChange={onChange} />,
    );
    expect(screen.getByText("게임 이름을 입력하세요")).toBeDefined();
  });

  it("text input 변경 시 onChange를 올바른 path로 호출한다", () => {
    const schema: JSONSchemaProperty = { type: "string", title: "이름" };
    const onChange = vi.fn();
    const { container } = render(
      <SchemaField schema={schema} path="name" value="" onChange={onChange} />,
    );
    const input = container.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "테스트" } });
    expect(onChange).toHaveBeenCalledWith("name", "테스트");
  });
});

// =========================================================================
// 2. SchemaDrivenForm
// =========================================================================

describe("SchemaDrivenForm", () => {
  it("스키마의 모든 최상위 필드를 렌더링한다", () => {
    const onChange = vi.fn();
    render(
      <SchemaDrivenForm
        schema={mockSchema}
        values={{}}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("이름")).toBeDefined();
    expect(screen.getByText("난이도")).toBeDefined();
    expect(screen.getByText("최대 플레이어")).toBeDefined();
    expect(screen.getByText("타이머 활성화")).toBeDefined();
    expect(screen.getByText("태그")).toBeDefined();
    expect(screen.getByText("세부 설정")).toBeDefined();
  });

  it("isLoading=true이면 스피너를 표시한다", () => {
    const onChange = vi.fn();
    const { container } = render(
      <SchemaDrivenForm
        schema={mockSchema}
        values={{}}
        onChange={onChange}
        isLoading={true}
      />,
    );
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).not.toBeNull();
  });

  it("properties가 비어있으면 빈 상태 메시지를 표시한다", () => {
    const onChange = vi.fn();
    const emptySchema: TemplateSchema = { type: "object", properties: {} };
    render(
      <SchemaDrivenForm
        schema={emptySchema}
        values={{}}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("설정 가능한 항목이 없습니다.")).toBeDefined();
  });

  it("onChange가 필드 변경 시 호출된다", () => {
    const onChange = vi.fn();
    const simpleSchema: TemplateSchema = {
      type: "object",
      properties: {
        name: { type: "string", title: "이름" },
      },
    };
    const { container } = render(
      <SchemaDrivenForm
        schema={simpleSchema}
        values={{ name: "기존값" }}
        onChange={onChange}
      />,
    );
    const input = container.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "새값" } });
    expect(onChange).toHaveBeenCalledWith("name", "새값");
  });

  it("schema title과 description을 표시한다", () => {
    const onChange = vi.fn();
    render(
      <SchemaDrivenForm
        schema={mockSchema}
        values={{}}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("게임 설정")).toBeDefined();
    expect(screen.getByText("게임의 기본 설정을 구성합니다")).toBeDefined();
  });
});

// =========================================================================
// 3. GenreSelect
// =========================================================================

describe("GenreSelect", () => {
  it("로딩 중일 때 스피너를 표시한다", () => {
    useTemplatesMock.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = render(<GenreSelect />);
    const spinner = container.querySelector('[role="status"]');
    expect(spinner).not.toBeNull();
  });

  it("에러 시 에러 메시지를 표시한다", () => {
    useTemplatesMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<GenreSelect />);
    expect(screen.getByText("템플릿 목록을 불러올 수 없습니다.")).toBeDefined();
  });

  it("고유 장르를 버튼으로 렌더링한다", () => {
    useTemplatesMock.mockReturnValue({ data: mockTemplates, isLoading: false, isError: false });
    render(<GenreSelect />);
    expect(screen.getByText("추리")).toBeDefined();
    expect(screen.getByText("공포")).toBeDefined();
    // 중복 제거: "추리" 버튼은 1개만
    expect(screen.getAllByText("추리").length).toBe(1);
  });

  it("장르 클릭 시 setGenre를 호출한다", () => {
    useTemplatesMock.mockReturnValue({ data: mockTemplates, isLoading: false, isError: false });
    render(<GenreSelect />);
    fireEvent.click(screen.getByText("추리"));
    expect(mockSetGenre).toHaveBeenCalledWith("추리");
  });

  it("선택된 장르에 active 스타일을 적용한다", () => {
    mockSelectedGenre = "추리";
    useTemplatesMock.mockReturnValue({ data: mockTemplates, isLoading: false, isError: false });
    render(<GenreSelect />);
    const btn = screen.getByText("추리").closest("button") as HTMLButtonElement;
    expect(btn.className).toContain("border-amber-500");
  });
});

// =========================================================================
// 4. PresetSelect
// =========================================================================

describe("PresetSelect", () => {
  beforeEach(() => {
    useTemplatesMock.mockReturnValue({ data: mockTemplates, isLoading: false, isError: false });
  });

  it("selectedGenre가 없으면 렌더링하지 않는다", () => {
    mockSelectedGenre = null;
    const { container } = render(<PresetSelect />);
    expect(container.firstChild).toBeNull();
  });

  it("선택된 장르의 프리셋만 렌더링한다", () => {
    mockSelectedGenre = "추리";
    render(<PresetSelect />);
    expect(screen.getByText("기본 추리")).toBeDefined();
    expect(screen.getByText("심화 추리")).toBeDefined();
    expect(screen.queryByText("기본 공포")).toBeNull();
  });

  it("프리셋 클릭 시 setPreset을 호출한다", () => {
    mockSelectedGenre = "추리";
    render(<PresetSelect />);
    fireEvent.click(screen.getByText("기본 추리").closest("button")!);
    expect(mockSetPreset).toHaveBeenCalledWith("tpl-1");
  });

  it("선택된 프리셋에 active 스타일을 적용한다", () => {
    mockSelectedGenre = "추리";
    mockSelectedPresetId = "tpl-1";
    render(<PresetSelect />);
    const btn = screen.getByText("기본 추리").closest("button") as HTMLButtonElement;
    expect(btn.className).toContain("border-amber-500");
  });

  it("해당 장르에 프리셋이 없으면 안내 메시지를 표시한다", () => {
    mockSelectedGenre = "판타지";
    render(<PresetSelect />);
    expect(screen.getByText("이 장르에 사용 가능한 프리셋이 없습니다.")).toBeDefined();
  });

  it("프리셋 설명과 플레이어/시간 정보를 표시한다", () => {
    mockSelectedGenre = "추리";
    render(<PresetSelect />);
    expect(screen.getByText("기본 추리 프리셋")).toBeDefined();
    expect(screen.getByText("4–6인 · 90분")).toBeDefined();
  });
});
