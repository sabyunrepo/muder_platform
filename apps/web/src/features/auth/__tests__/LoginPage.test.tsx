import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AppearanceProvider } from "@/shared/appearance";

import LoginPage from "../LoginPage";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
      clear: vi.fn(() => storage.clear()),
    },
  });
});

afterEach(() => {
  cleanup();
  storage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-preference");
  document.documentElement.style.colorScheme = "";
});

function renderLoginPage() {
  return render(
    <AppearanceProvider>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AppearanceProvider>,
  );
}

describe("LoginPage", () => {
  it("uses Chrome password-manager autocomplete hints on login fields", () => {
    renderLoginPage();

    const email = screen.getByLabelText("이메일");
    const password = screen.getByLabelText("비밀번호");

    expect(email.getAttribute("name")).toBe("email");
    expect(email.getAttribute("autocomplete")).toBe("username");
    expect(password.getAttribute("id")).toBe("current-password");
    expect(password.getAttribute("name")).toBe("password");
    expect(password.getAttribute("autocomplete")).toBe("current-password");
  });

  it("switches password autocomplete to new-password on register mode", () => {
    renderLoginPage();

    fireEvent.click(screen.getByRole("button", { name: "계정이 없으신가요? 회원가입" }));

    expect(screen.getByLabelText("닉네임").getAttribute("autocomplete")).toBe("nickname");
    const password = screen.getByLabelText("비밀번호");
    expect(password.getAttribute("id")).toBe("new-password");
    expect(password.getAttribute("autocomplete")).toBe("new-password");
  });

  it("exposes the project theme mode controls on the public login shell", () => {
    renderLoginPage();

    expect(screen.getAllByRole("button", { name: "시스템" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "라이트" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "다크" }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "다크" })[0]);
    expect(document.documentElement.dataset.themePreference).toBe("dark");

    fireEvent.click(screen.getAllByRole("button", { name: "라이트" })[0]);
    expect(document.documentElement.dataset.themePreference).toBe("light");
  });
});
