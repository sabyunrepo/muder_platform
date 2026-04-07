import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  useUpdateReadingSectionMock,
  useDeleteReadingSectionMock,
  useMediaListMock,
  invalidateQueriesMock,
} = vi.hoisted(() => ({
  useUpdateReadingSectionMock: vi.fn(),
  useDeleteReadingSectionMock: vi.fn(),
  useMediaListMock: vi.fn(),
  invalidateQueriesMock: vi.fn(),
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
}));

vi.mock("@/services/queryClient", () => ({
  queryClient: {
    invalidateQueries: invalidateQueriesMock,
  },
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
      AdvanceBy: "gm",
    },
    {
      Index: 1,
      Text: "누구냐?",
      Speaker: "Alice",
      VoiceMediaID: "",
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

  it("409 conflict error shows refresh prompt", async () => {
    mutateAsyncUpdate.mockRejectedValueOnce(new Error("HTTP 409 Conflict"));
    renderEditor();
    const input = screen.getByLabelText("섹션 이름") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() =>
      expect(screen.getByText(/다른 곳에서 수정되었습니다/)).toBeTruthy(),
    );

    fireEvent.click(screen.getByRole("button", { name: /새로고침/ }));
    expect(invalidateQueriesMock).toHaveBeenCalled();
  });
});
