import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import ProtectedRoute from "@/shared/components/ProtectedRoute";
import { useAuthStore } from "@/stores/authStore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWithRouter(initialRoute = "/protected") {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/login" element={<div>로그인 페이지</div>} />
        <Route element={<ProtectedRoute />}>
          <Route
            path="/protected"
            element={<div>보호된 페이지</div>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProtectedRoute", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  describe("isLoading false, isAuthenticated false", () => {
    it("/login으로 리다이렉트한다", () => {
      renderWithRouter();

      expect(screen.getByText("로그인 페이지")).toBeDefined();
      expect(screen.queryByText("보호된 페이지")).toBeNull();
    });
  });

  describe("isLoading true (토큰 갱신 진행 중)", () => {
    it("스피너를 표시한다", () => {
      useAuthStore.setState({
        refreshToken: "refresh-token",
        accessToken: null,
        isAuthenticated: false,
        isLoading: true,
      });

      const { container } = renderWithRouter();

      // 스피너 (animate-spin 클래스를 가진 div)
      const spinner = container.querySelector(".animate-spin");
      expect(spinner).not.toBeNull();
      expect(screen.queryByText("보호된 페이지")).toBeNull();
      expect(screen.queryByText("로그인 페이지")).toBeNull();
    });
  });

  describe("isLoading false, isAuthenticated false (accessToken 없음)", () => {
    it("isAuthenticated 기준으로 /login으로 리다이렉트한다", () => {
      useAuthStore.setState({
        refreshToken: "refresh-token",
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      });

      renderWithRouter();

      expect(screen.getByText("로그인 페이지")).toBeDefined();
      expect(screen.queryByText("보호된 페이지")).toBeNull();
    });
  });

  describe("인증 완료 상태", () => {
    it("Outlet(자식 라우트)을 렌더링한다", () => {
      useAuthStore.setState({
        refreshToken: "refresh-token",
        accessToken: "access-token",
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: "user-1",
          nickname: "TestUser",
          email: "test@example.com",
          profileImage: null,
          role: "user",
          provider: "google",
        },
      });

      renderWithRouter();

      expect(screen.getByText("보호된 페이지")).toBeDefined();
      expect(screen.queryByText("로그인 페이지")).toBeNull();
    });
  });

  describe("isLoading true + 나머지 조건 충족", () => {
    it("로딩 중이면 스피너를 표시한다", () => {
      useAuthStore.setState({
        refreshToken: "refresh-token",
        accessToken: "access-token",
        isAuthenticated: true,
        isLoading: true,
      });

      const { container } = renderWithRouter();

      const spinner = container.querySelector(".animate-spin");
      expect(spinner).not.toBeNull();
      expect(screen.queryByText("보호된 페이지")).toBeNull();
    });
  });
});
