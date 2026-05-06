import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const {
  useStoryInfosMock,
  useCreateStoryInfoMock,
  useUpdateStoryInfoMock,
  useDeleteStoryInfoMock,
  useEditorCharactersMock,
  useEditorCluesMock,
  useEditorLocationsMock,
  useMediaListMock,
  mediaPickerPropsMock,
} = vi.hoisted(() => ({
  useStoryInfosMock: vi.fn(),
  useCreateStoryInfoMock: vi.fn(),
  useUpdateStoryInfoMock: vi.fn(),
  useDeleteStoryInfoMock: vi.fn(),
  useEditorCharactersMock: vi.fn(),
  useEditorCluesMock: vi.fn(),
  useEditorLocationsMock: vi.fn(),
  useMediaListMock: vi.fn(),
  mediaPickerPropsMock: vi.fn(),
}));

vi.mock("@/features/editor/storyInfoApi", () => ({
  useStoryInfos: (...args: unknown[]) => useStoryInfosMock(...args),
  useCreateStoryInfo: (...args: unknown[]) => useCreateStoryInfoMock(...args),
  useUpdateStoryInfo: (...args: unknown[]) => useUpdateStoryInfoMock(...args),
  useDeleteStoryInfo: (...args: unknown[]) => useDeleteStoryInfoMock(...args),
}));

vi.mock("@/features/editor/api", () => ({
  useEditorCharacters: (...args: unknown[]) => useEditorCharactersMock(...args),
  useEditorClues: (...args: unknown[]) => useEditorCluesMock(...args),
  useEditorLocations: (...args: unknown[]) => useEditorLocationsMock(...args),
}));

vi.mock("@/features/editor/mediaApi", () => ({
  useMediaList: (...args: unknown[]) => useMediaListMock(...args),
}));

vi.mock("../../media/MediaPicker", () => ({
  MediaPicker: (props: {
    open: boolean;
    filterType?: string;
    title?: string;
    onSelect: (media: { id: string; name: string }) => void;
  }) => {
    mediaPickerPropsMock(props);
    if (!props.open) return null;
    return (
      <div data-testid="media-picker">
        <span>{props.title}</span>
        <span>filter:{props.filterType}</span>
        <button
          type="button"
          onClick={() => props.onSelect({ id: "image-2", name: "새 이미지" })}
        >
          새 이미지 선택
        </button>
      </div>
    );
  },
}));

import { InfoTab } from "../InfoTab";

const baseInfo = {
  id: "info-1",
  themeId: "theme-1",
  title: "피해자의 비밀",
  body: "처음 공개되는 정보",
  imageMediaId: "image-1",
  relatedCharacterIds: ["char-1"],
  relatedClueIds: [],
  relatedLocationIds: [],
  sortOrder: 0,
  version: 3,
  createdAt: "2026-05-06T00:00:00Z",
  updatedAt: "2026-05-06T00:00:00Z",
};

let createMutate: ReturnType<typeof vi.fn>;
let updateMutate: ReturnType<typeof vi.fn>;
let deleteMutate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  createMutate = vi.fn().mockResolvedValue({ ...baseInfo, id: "info-2" });
  updateMutate = vi.fn().mockResolvedValue({ ...baseInfo, title: "수정된 정보" });
  deleteMutate = vi.fn().mockResolvedValue(undefined);

  useStoryInfosMock.mockReturnValue({
    data: [baseInfo],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useCreateStoryInfoMock.mockReturnValue({
    mutateAsync: createMutate,
    isPending: false,
  });
  useUpdateStoryInfoMock.mockReturnValue({
    mutateAsync: updateMutate,
    isPending: false,
  });
  useDeleteStoryInfoMock.mockReturnValue({
    mutateAsync: deleteMutate,
    isPending: false,
  });
  useEditorCharactersMock.mockReturnValue({
    data: [
      { id: "char-1", name: "탐정" },
      { id: "char-2", name: "용의자" },
    ],
  });
  useEditorCluesMock.mockReturnValue({ data: [{ id: "clue-1", name: "혈흔" }] });
  useEditorLocationsMock.mockReturnValue({ data: [{ id: "loc-1", name: "서재" }] });
  useMediaListMock.mockReturnValue({
    data: [
      { id: "image-1", name: "기존 이미지", type: "IMAGE" },
      { id: "image-2", name: "새 이미지", type: "IMAGE" },
    ],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InfoTab", () => {
  it("renders story info list and selected detail editor", () => {
    render(<InfoTab themeId="theme-1" />);

    expect(screen.getByText("정보 관리")).toBeDefined();
    expect(screen.getByText("피해자의 비밀")).toBeDefined();
    expect(screen.getByLabelText("정보 제목")).toHaveProperty("value", "피해자의 비밀");
    expect(screen.getByText("기존 이미지")).toBeDefined();
    expect(screen.getByText("탐정")).toBeDefined();
    expect(screen.getByText("혈흔")).toBeDefined();
    expect(screen.getByText("서재")).toBeDefined();
  });

  it("creates a new story info card with empty refs", async () => {
    render(<InfoTab themeId="theme-1" />);

    fireEvent.click(screen.getByRole("button", { name: /정보 추가/ }));

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate).toHaveBeenCalledWith({
      title: "새 스토리 정보",
      body: "",
      imageMediaId: null,
      relatedCharacterIds: [],
      relatedClueIds: [],
      relatedLocationIds: [],
      sortOrder: 1,
    });
  });

  it("shows a user-visible message when story info creation fails", async () => {
    createMutate.mockRejectedValueOnce(new Error("서버 오류"));
    render(<InfoTab themeId="theme-1" />);

    fireEvent.click(screen.getByRole("button", { name: /정보 추가/ }));

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "서버 오류");
  });

  it("uses IMAGE-only MediaPicker and saves selected image plus references", async () => {
    render(<InfoTab themeId="theme-1" />);

    fireEvent.click(screen.getByRole("button", { name: /기존 이미지/ }));
    expect(screen.getByTestId("media-picker")).toBeDefined();
    expect(screen.getByText("filter:IMAGE")).toBeDefined();
    expect(mediaPickerPropsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ filterType: "IMAGE", selectedId: "image-1" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "새 이미지 선택" }));
    fireEvent.click(screen.getByLabelText("용의자"));
    fireEvent.click(screen.getByLabelText("혈흔"));
    fireEvent.change(screen.getByLabelText("정보 제목"), {
      target: { value: "수정된 정보" },
    });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate).toHaveBeenCalledWith({
      id: "info-1",
      patch: {
        title: "수정된 정보",
        body: "처음 공개되는 정보",
        imageMediaId: "image-2",
        relatedCharacterIds: ["char-1", "char-2"],
        relatedClueIds: ["clue-1"],
        relatedLocationIds: [],
        sortOrder: 0,
        version: 3,
      },
    });
  });

  it("uses the saved version for a second save without stale dirty metadata", async () => {
    updateMutate
      .mockResolvedValueOnce({
        ...baseInfo,
        title: "1차 수정",
        version: 4,
        updatedAt: "2026-05-06T00:01:00Z",
      })
      .mockResolvedValueOnce({
        ...baseInfo,
        title: "2차 수정",
        version: 5,
        updatedAt: "2026-05-06T00:02:00Z",
      });
    render(<InfoTab themeId="theme-1" />);

    fireEvent.change(screen.getByLabelText("정보 제목"), {
      target: { value: "1차 수정" },
    });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));
    await waitFor(() =>
      expect(updateMutate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          patch: expect.objectContaining({ title: "1차 수정", version: 3 }),
        }),
      ),
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /저장/ })).toHaveProperty(
        "disabled",
        true,
      ),
    );
    fireEvent.change(screen.getByLabelText("정보 제목"), {
      target: { value: "2차 수정" },
    });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() =>
      expect(updateMutate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          patch: expect.objectContaining({ title: "2차 수정", version: 4 }),
        }),
      ),
    );
  });
});
