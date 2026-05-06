import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  useUpdateReadingSectionMock,
  useDeleteReadingSectionMock,
  useMediaListMock,
  useMediaCategoriesMock,
  useRequestUploadUrlMock,
  useConfirmUploadMock,
  invalidateQueriesMock,
  writeTextMock,
} = vi.hoisted(() => ({
  useUpdateReadingSectionMock: vi.fn(),
  useDeleteReadingSectionMock: vi.fn(),
  useMediaListMock: vi.fn(),
  useMediaCategoriesMock: vi.fn(),
  useRequestUploadUrlMock: vi.fn(),
  useConfirmUploadMock: vi.fn(),
  invalidateQueriesMock: vi.fn(),
  writeTextMock: vi.fn(),
}));

vi.mock("@/features/editor/readingApi", async () => {
  const actual =
    await vi.importActual<typeof import("@/features/editor/readingApi")>(
      "@/features/editor/readingApi",
    );
  return {
    ...actual,
    useUpdateReadingSection: () => useUpdateReadingSectionMock(),
    useDeleteReadingSection: () => useDeleteReadingSectionMock(),
  };
});

vi.mock("@/features/editor/mediaApi", () => ({
  useMediaList: (...args: unknown[]) => useMediaListMock(...args),
  useMediaCategories: (...args: unknown[]) => useMediaCategoriesMock(...args),
  useRequestUploadUrl: (...args: unknown[]) => useRequestUploadUrlMock(...args),
  useConfirmUpload: (...args: unknown[]) => useConfirmUploadMock(...args),
}));

vi.mock("@/services/queryClient", () => ({
  queryClient: {
    invalidateQueries: invalidateQueriesMock,
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ReadingSectionEditor } from "../ReadingSectionEditor";
import { computeSmartAdvanceBy } from "../advanceByDefaults";
import type { ReadingSectionResponse } from "@/features/editor/readingApi";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleSection: ReadingSectionResponse = {
  id: "sec-1",
  themeId: "theme-1",
  name: "오프닝",
  bgmMediaId: null,
  sortOrder: 0,
  version: 3,
  createdAt: "2026-04-05T00:00:00Z",
  updatedAt: "2026-04-05T00:00:00Z",
  lines: [
    {
      Index: 0,
      Text: "어두운 방 안.",
      Speaker: "나레이션",
      VoiceMediaID: "",
      ImageMediaID: "",
      AdvanceBy: "gm",
    },
    {
      Index: 1,
      Text: "누구냐?",
      Speaker: "Alice",
      VoiceMediaID: "",
      ImageMediaID: "",
      AdvanceBy: "role:c1",
    },
  ],
};

const characters = [
  { id: "c1", name: "Alice" },
  { id: "c2", name: "Bob" },
];

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let mutateAsyncUpdate: ReturnType<typeof vi.fn>;
let mutateAsyncDelete: ReturnType<typeof vi.fn>;

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: {
      writeText: writeTextMock,
    },
  });
  writeTextMock.mockResolvedValue(undefined);
  mutateAsyncUpdate = vi.fn().mockResolvedValue(sampleSection);
  mutateAsyncDelete = vi.fn().mockResolvedValue(undefined);

  useUpdateReadingSectionMock.mockReturnValue({
    mutateAsync: mutateAsyncUpdate,
    isPending: false,
  });
  useDeleteReadingSectionMock.mockReturnValue({
    mutateAsync: mutateAsyncDelete,
    isPending: false,
  });
  useMediaListMock.mockReturnValue({ data: [], isLoading: false });
  useMediaCategoriesMock.mockReturnValue({ data: [] });
  useRequestUploadUrlMock.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });
  useConfirmUploadMock.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Smart defaults — pure function
// ---------------------------------------------------------------------------

describe("computeSmartAdvanceBy", () => {
  it("narration → gm", () => {
    expect(computeSmartAdvanceBy({ Speaker: "나레이션" }, true, characters)).toBe(
      "gm",
    );
  });

  it("voice attached → voice", () => {
    expect(
      computeSmartAdvanceBy(
        { Speaker: "Alice", VoiceMediaID: "m-1" },
        false,
        characters,
      ),
    ).toBe("voice");
  });

  it("character speaker → role:<character.id>", () => {
    // Speaker is a display name; resolved to the stable character id so the
    // advance permission check on the server (which compares role ids) works.
    expect(
      computeSmartAdvanceBy({ Speaker: "Alice" }, false, characters),
    ).toBe("role:c1");
    expect(computeSmartAdvanceBy({ Speaker: "Bob" }, false, characters)).toBe(
      "role:c2",
    );
  });

  it("unknown speaker (no matching character) → gm fallback", () => {
    expect(
      computeSmartAdvanceBy({ Speaker: "Nobody" }, false, characters),
    ).toBe("gm");
  });

  it("empty fallback → gm", () => {
    expect(computeSmartAdvanceBy({}, false, characters)).toBe("gm");
  });
});

// ---------------------------------------------------------------------------
// ReadingSectionEditor
// ---------------------------------------------------------------------------

describe("ReadingSectionEditor", () => {
  function renderEditor(
    overrides?: Partial<React.ComponentProps<typeof ReadingSectionEditor>>,
  ) {
    return render(
      <ReadingSectionEditor
        themeId="theme-1"
        section={sampleSection}
        characters={characters}
        {...overrides}
      />,
    );
  }

  it("renders section name as editable input", () => {
    renderEditor();
    const input = screen.getByLabelText("섹션 이름") as HTMLInputElement;
    expect(input.value).toBe("오프닝");
  });

  it("renders all line rows", () => {
    renderEditor();
    expect(screen.getByDisplayValue("어두운 방 안.")).toBeTruthy();
    expect(screen.getByDisplayValue("누구냐?")).toBeTruthy();
  });

  it("add line appends a new empty row", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: /줄 추가/ }));
    expect(screen.getByText(/대사 \(3줄\)/)).toBeTruthy();
  });

  it("delete line removes a row", () => {
    renderEditor();
    const deleteButtons = screen.getAllByLabelText("줄 삭제");
    fireEvent.click(deleteButtons[0]);
    expect(screen.queryByDisplayValue("어두운 방 안.")).toBeNull();
  });

  it("editing line text updates draft", () => {
    renderEditor();
    const ta = screen.getByDisplayValue("어두운 방 안.") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "변경된 지문" } });
    expect(
      (screen.getByDisplayValue("변경된 지문") as HTMLTextAreaElement).value,
    ).toBe("변경된 지문");
  });

  it("changing speaker updates the line", () => {
    renderEditor();
    const speakerSelects = screen.getAllByLabelText("화자");
    fireEvent.change(speakerSelects[0], { target: { value: "Bob" } });
    expect((speakerSelects[0] as HTMLSelectElement).value).toBe("Bob");
  });

  it("save calls useUpdateReadingSection with version + patch", async () => {
    renderEditor();
    const input = screen.getByLabelText("섹션 이름") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "재명명" } });

    const saveBtn = screen.getByRole("button", { name: /저장/ });
    fireEvent.click(saveBtn);

    await waitFor(() => expect(mutateAsyncUpdate).toHaveBeenCalledTimes(1));
    const callArg = mutateAsyncUpdate.mock.calls[0][0];
    expect(callArg.id).toBe("sec-1");
    expect(callArg.patch.version).toBe(3);
    expect(callArg.patch.name).toBe("재명명");
    expect(Array.isArray(callArg.patch.lines)).toBe(true);
  });

  it("line image picker stores an IMAGE media reference", async () => {
    useMediaListMock.mockImplementation((_themeId: string, type?: string) => {
      if (type === "IMAGE") {
        return {
          data: [
            {
              id: "image-1",
              theme_id: "theme-1",
              name: "현장 사진",
              type: "IMAGE",
              source_type: "FILE",
              url: "https://example.com/image.png",
              tags: [],
              sort_order: 1,
              created_at: "2026-04-05T00:00:00Z",
            },
          ],
          isLoading: false,
        };
      }
      return { data: [], isLoading: false };
    });

    renderEditor();
    fireEvent.click(screen.getAllByRole("button", { name: "이미지 추가" })[0]);

    expect(useMediaListMock).toHaveBeenCalledWith("theme-1", "IMAGE");
    expect(screen.getByText(/이미지 유형만 표시됩니다/)).toBeTruthy();
    fireEvent.click(screen.getByText("현장 사진").closest("button") as HTMLElement);

    expect(screen.getByText("현장 사진")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() => expect(mutateAsyncUpdate).toHaveBeenCalledTimes(1));
    expect(mutateAsyncUpdate.mock.calls[0][0].patch.lines[0].ImageMediaID).toBe(
      "image-1",
    );
  });

  it("line image picker serializes cleared image references", async () => {
    useMediaListMock.mockImplementation((_themeId: string, type?: string) => {
      if (type === "IMAGE") {
        return {
          data: [
            {
              id: "image-1",
              theme_id: "theme-1",
              name: "현장 사진",
              type: "IMAGE",
              source_type: "FILE",
              url: "https://example.com/image.png",
              tags: [],
              sort_order: 1,
              created_at: "2026-04-05T00:00:00Z",
            },
          ],
          isLoading: false,
        };
      }
      return { data: [], isLoading: false };
    });

    renderEditor({
      section: {
        ...sampleSection,
        lines: [{ ...sampleSection.lines[0], ImageMediaID: "image-1" }],
      },
    });

    expect(screen.getByText("현장 사진")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "이미지 제거" }));
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() => expect(mutateAsyncUpdate).toHaveBeenCalledTimes(1));
    expect(mutateAsyncUpdate.mock.calls[0][0].patch.lines[0].ImageMediaID).toBe(
      "",
    );
  });

  it("save button is disabled when not dirty", () => {
    renderEditor();
    const saveBtn = screen.getByRole("button", { name: /저장/ }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it("delete section calls useDeleteReadingSection after confirm", async () => {
    const onDeleted = vi.fn();
    renderEditor({ onDeleted });
    fireEvent.click(screen.getByRole("button", { name: /섹션 삭제/ }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(mutateAsyncDelete).toHaveBeenCalledWith("sec-1"));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });

  it("409 conflict error shows reload, preserve, and cancel recovery actions", async () => {
    mutateAsyncUpdate.mockRejectedValueOnce(new Error("HTTP 409 Conflict"));
    renderEditor();
    const input = screen.getByLabelText("섹션 이름") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() =>
      expect(screen.getByRole("alert", { name: "읽기 대사 저장 충돌" })).toBeTruthy(),
    );
    expect(screen.getByText(/다른 탭이나 사용자가 더 최신 내용을 저장했습니다/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "내 변경 복사" }));
    expect(writeTextMock).toHaveBeenCalledWith(
      JSON.stringify(
        {
          name: "x",
          bgmMediaId: sampleSection.bgmMediaId,
          lines: sampleSection.lines,
          sortOrder: sampleSection.sortOrder,
        },
        null,
        2,
      ),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("내 변경 내용을 클립보드에 복사했습니다"),
    );

    fireEvent.click(screen.getByRole("button", { name: "최신 상태 다시 불러오기" }));
    expect(invalidateQueriesMock).toHaveBeenCalled();
    expect(screen.queryByRole("alert", { name: "읽기 대사 저장 충돌" })).toBeNull();

    mutateAsyncUpdate.mockRejectedValueOnce(new Error("HTTP 409 Conflict"));
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert", { name: "읽기 대사 저장 충돌" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("alert", { name: "읽기 대사 저장 충돌" })).toBeNull();
  });

  it("copy draft reports clipboard failure", async () => {
    writeTextMock.mockRejectedValueOnce(new Error("denied"));
    mutateAsyncUpdate.mockRejectedValueOnce(new Error("HTTP 409 Conflict"));

    renderEditor();
    const input = screen.getByLabelText("섹션 이름") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() =>
      expect(screen.getByRole("alert", { name: "읽기 대사 저장 충돌" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "내 변경 복사" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("클립보드에 복사할 수 없습니다"),
    );
    expect(toast.success).not.toHaveBeenCalledWith("내 변경 내용을 클립보드에 복사했습니다");
  });
});
