import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { YouTubeAddModal } from "../YouTubeAddModal";

// Mock the create hook so we can drive success/error.
const mockMutateAsync = vi.fn();

vi.mock("@/features/editor/mediaApi", async () => {
  const actual =
    await vi.importActual<typeof import("@/features/editor/mediaApi")>(
      "@/features/editor/mediaApi",
    );
  return {
    ...actual,
    useCreateYouTubeMedia: () => ({
      mutateAsync: mockMutateAsync,
    }),
  };
});

function renderModal(open = true, onClose = vi.fn()) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    onClose,
    ...render(
      <QueryClientProvider client={qc}>
        <YouTubeAddModal open={open} onClose={onClose} themeId="theme-1" />
      </QueryClientProvider>,
    ),
  };
}

describe("YouTubeAddModal", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = renderModal(false);
    expect(container.firstChild).toBeNull();
  });

  it("renders URL input and fields when open", () => {
    renderModal(true);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText("YouTube URL")).toBeTruthy();
    expect(screen.getByLabelText("이름")).toBeTruthy();
    expect(screen.getByLabelText("유형")).toBeTruthy();
  });

  it("URL parsing: valid youtube.com URL shows preview", () => {
    renderModal(true);
    const input = screen.getByLabelText("YouTube URL") as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: "https://youtube.com/watch?v=dQw4w9WgXcQ" },
    });
    const img = screen.getByAltText("YouTube 미리보기") as HTMLImageElement;
    expect(img.src).toContain("dQw4w9WgXcQ");
    expect(img.src).toContain("img.youtube.com");
  });

  it("URL parsing: valid youtu.be URL shows preview", () => {
    renderModal(true);
    const input = screen.getByLabelText("YouTube URL") as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: "https://youtu.be/dQw4w9WgXcQ" },
    });
    const img = screen.getByAltText("YouTube 미리보기") as HTMLImageElement;
    expect(img.src).toContain("dQw4w9WgXcQ");
  });

  it("invalid URL shows error hint, hides preview", () => {
    renderModal(true);
    const input = screen.getByLabelText("YouTube URL") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://example.com/foo" } });
    expect(screen.getByText("올바르지 않은 YouTube URL입니다")).toBeTruthy();
    expect(screen.queryByAltText("YouTube 미리보기")).toBeNull();
  });

  it("empty name disables create button", () => {
    renderModal(true);
    fireEvent.change(screen.getByLabelText("YouTube URL"), {
      target: { value: "https://youtu.be/dQw4w9WgXcQ" },
    });
    const createBtn = screen.getByRole("button", {
      name: "추가",
    }) as HTMLButtonElement;
    expect(createBtn.disabled).toBe(true);
  });

  it("valid URL + name enables create button", () => {
    renderModal(true);
    fireEvent.change(screen.getByLabelText("YouTube URL"), {
      target: { value: "https://youtu.be/dQw4w9WgXcQ" },
    });
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "My Track" },
    });
    const createBtn = screen.getByRole("button", {
      name: "추가",
    }) as HTMLButtonElement;
    expect(createBtn.disabled).toBe(false);
  });

  it("type select: BGM vs VIDEO changes description text", () => {
    renderModal(true);
    expect(screen.getByText("오디오만 재생됩니다")).toBeTruthy();
    const select = screen.getByLabelText("유형") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "VIDEO" } });
    expect(
      screen.getByText("풀스크린 컷신 또는 인라인 증거 영상으로 사용됩니다"),
    ).toBeTruthy();
  });

  it("create success calls onClose", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      id: "m1",
      theme_id: "theme-1",
      name: "My Track",
      type: "BGM",
      source_type: "YOUTUBE",
      tags: [],
      sort_order: 0,
      created_at: "",
    });
    const { onClose } = renderModal(true);
    fireEvent.change(screen.getByLabelText("YouTube URL"), {
      target: { value: "https://youtu.be/dQw4w9WgXcQ" },
    });
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "My Track" },
    });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockMutateAsync).toHaveBeenCalledWith({
      url: "https://youtu.be/dQw4w9WgXcQ",
      name: "My Track",
      type: "BGM",
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("create with VIDEO type passes correct payload", async () => {
    mockMutateAsync.mockResolvedValueOnce({});
    renderModal(true);
    fireEvent.change(screen.getByLabelText("YouTube URL"), {
      target: { value: "https://youtu.be/dQw4w9WgXcQ" },
    });
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "Cutscene" },
    });
    fireEvent.change(screen.getByLabelText("유형"), {
      target: { value: "VIDEO" },
    });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({
        url: "https://youtu.be/dQw4w9WgXcQ",
        name: "Cutscene",
        type: "VIDEO",
      }),
    );
  });

  it("create error shows error message", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("서버 에러"));
    renderModal(true);
    fireEvent.change(screen.getByLabelText("YouTube URL"), {
      target: { value: "https://youtu.be/dQw4w9WgXcQ" },
    });
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "My Track" },
    });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("서버 에러"),
    );
  });

  it("reset when modal closes", () => {
    const { rerender } = renderModal(true);
    fireEvent.change(screen.getByLabelText("YouTube URL"), {
      target: { value: "https://youtu.be/dQw4w9WgXcQ" },
    });
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "Hello" },
    });
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    rerender(
      <QueryClientProvider client={qc}>
        <YouTubeAddModal open={false} onClose={vi.fn()} themeId="theme-1" />
      </QueryClientProvider>,
    );
    rerender(
      <QueryClientProvider client={qc}>
        <YouTubeAddModal open={true} onClose={vi.fn()} themeId="theme-1" />
      </QueryClientProvider>,
    );
    const urlInput = screen.getByLabelText("YouTube URL") as HTMLInputElement;
    const nameInput = screen.getByLabelText("이름") as HTMLInputElement;
    expect(urlInput.value).toBe("");
    expect(nameInput.value).toBe("");
  });
});
