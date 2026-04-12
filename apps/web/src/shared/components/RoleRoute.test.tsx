import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import RoleRoute from "@/shared/components/RoleRoute";
import { useAuthStore } from "@/stores/authStore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWithRouter(roles: Array<"user" | "creator" | "admin"> = ["admin"]) {
  return render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route path="/login" element={<div>로그인 페이지</div>} />
        <Route path="/" element={<div>홈 페이지</div>} />
        <Route element={<RoleRoute roles={roles} />}>
          <Route path="/protected" element={<div>보호된 페이지</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RoleRoute", () => {
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

  it("renders spinner when auth is loading", () => {
    useAuthStore.setState({
      isLoading: true,
      isAuthenticated: false,
      user: null,
    });

    const { container } = renderWithRouter();

    const spinner = container.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
    expect(screen.queryByText("보호된 페이지")).toBeNull();
    expect(screen.queryByText("로그인 페이지")).toBeNull();
  });

  it("redirects to /login when not authenticated", () => {
    useAuthStore.setState({
      isLoading: false,
      isAuthenticated: false,
      user: null,
    });

    renderWithRouter();

    expect(screen.getByText("로그인 페이지")).toBeDefined();
    expect(screen.queryByText("보호된 페이지")).toBeNull();
  });

  it("redirects to / when user role not in allowed roles", () => {
    useAuthStore.setState({
      isLoading: false,
      isAuthenticated: true,
      user: {
        id: "user-1",
        nickname: "TestUser",
        email: "test@example.com",
        profileImage: null,
        role: "user",
        provider: "google",
      },
    });

    renderWithRouter(["admin"]);

    expect(screen.getByText("홈 페이지")).toBeDefined();
    expect(screen.queryByText("보호된 페이지")).toBeNull();
  });

  it("renders children (Outlet) when user has allowed role", () => {
    useAuthStore.setState({
      isLoading: false,
      isAuthenticated: true,
      user: {
        id: "user-1",
        nickname: "TestUser",
        email: "test@example.com",
        profileImage: null,
        role: "admin",
        provider: "google",
      },
    });

    renderWithRouter(["admin"]);

    expect(screen.getByText("보호된 페이지")).toBeDefined();
    expect(screen.queryByText("로그인 페이지")).toBeNull();
    expect(screen.queryByText("홈 페이지")).toBeNull();
  });
});
