import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ProfileForm } from "../ProfileForm";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mutateMock = vi.fn();

vi.mock("@/features/profile/api", () => ({
  useUpdateProfile: () => ({
    mutate: mutateMock,
    isPending: false,
  }),
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      user: {
        id: "user-1",
        nickname: "테스트유저",
        email: "test@example.com",
        profileImage: null,
        role: "user",
        provider: "google",
      },
      setUser: vi.fn(),
    }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  mutateMock.mockReset();
});

const defaultProps = {
  nickname: "테스트유저",
  email: "test@example.com",
  profileImage: null,
  role: "user",
  provider: "google",
};

describe("ProfileForm", () => {
  describe("프로필 데이터 표시", () => {
    it("닉네임을 표시한다", () => {
      render(<ProfileForm {...defaultProps} />);
      const nicknameInput = screen.getByLabelText("닉네임") as HTMLInputElement;
      expect(nicknameInput.value).toBe("테스트유저");
    });

    it("이메일을 표시한다", () => {
      render(<ProfileForm {...defaultProps} />);
      const emailInput = screen.getByLabelText("이메일") as HTMLInputElement;
      expect(emailInput.value).toBe("test@example.com");
    });

    it("이메일은 읽기 전용이다", () => {
      render(<ProfileForm {...defaultProps} />);
      const emailInput = screen.getByLabelText("이메일") as HTMLInputElement;
      expect(emailInput.readOnly).toBe(true);
    });

    it("로그인 방식을 표시한다", () => {
      render(<ProfileForm {...defaultProps} />);
      expect(screen.getByText("Google")).toBeDefined();
    });
  });

  describe("닉네임 수정", () => {
    it("닉네임을 수정할 수 있다", () => {
      render(<ProfileForm {...defaultProps} />);
      const nicknameInput = screen.getByLabelText("닉네임") as HTMLInputElement;
      fireEvent.change(nicknameInput, { target: { value: "새닉네임" } });
      expect(nicknameInput.value).toBe("새닉네임");
    });
  });

  describe("저장 버튼 상태", () => {
    it("변경 없으면 저장 버튼이 비활성화된다", () => {
      render(<ProfileForm {...defaultProps} />);
      const submitBtn = screen.getByRole("button", { name: "저장" });
      expect(submitBtn).toHaveProperty("disabled", true);
    });

    it("닉네임 변경 시 저장 버튼이 활성화된다", () => {
      render(<ProfileForm {...defaultProps} />);
      const nicknameInput = screen.getByLabelText("닉네임");
      fireEvent.change(nicknameInput, { target: { value: "새닉네임" } });
      const submitBtn = screen.getByRole("button", { name: "저장" });
      expect(submitBtn).toHaveProperty("disabled", false);
    });
  });

  describe("닉네임 유효성 검증", () => {
    it("닉네임이 비어있으면 에러를 표시한다", () => {
      render(<ProfileForm {...defaultProps} />);
      const nicknameInput = screen.getByLabelText("닉네임");

      // 닉네임 변경 후 비우기
      fireEvent.change(nicknameInput, { target: { value: " " } });

      // 폼 제출
      const submitBtn = screen.getByRole("button", { name: "저장" });
      fireEvent.click(submitBtn);

      expect(screen.getByText("닉네임을 입력해주세요.")).toBeDefined();
    });

    it("닉네임이 1자이면 에러를 표시한다", () => {
      render(<ProfileForm {...defaultProps} />);
      const nicknameInput = screen.getByLabelText("닉네임");
      fireEvent.change(nicknameInput, { target: { value: "A" } });

      const submitBtn = screen.getByRole("button", { name: "저장" });
      fireEvent.click(submitBtn);

      expect(screen.getByText("닉네임은 2자 이상이어야 합니다.")).toBeDefined();
    });

    it("유효한 닉네임이면 mutate를 호출한다", () => {
      render(<ProfileForm {...defaultProps} />);
      const nicknameInput = screen.getByLabelText("닉네임");
      fireEvent.change(nicknameInput, { target: { value: "유효한닉네임" } });

      const submitBtn = screen.getByRole("button", { name: "저장" });
      fireEvent.click(submitBtn);

      expect(mutateMock).toHaveBeenCalledTimes(1);
      expect(mutateMock).toHaveBeenCalledWith(
        { nickname: "유효한닉네임" },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });
  });
});
