import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import LoginPage from "../LoginPage";

afterEach(() => {
  cleanup();
});

describe("LoginPage", () => {
  it("uses Chrome password-manager autocomplete hints on login fields", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const email = screen.getByLabelText("이메일");
    const password = screen.getByLabelText("비밀번호");

    expect(email.getAttribute("name")).toBe("email");
    expect(email.getAttribute("autocomplete")).toBe("username");
    expect(password.getAttribute("id")).toBe("current-password");
    expect(password.getAttribute("name")).toBe("password");
    expect(password.getAttribute("autocomplete")).toBe("current-password");
  });

  it("switches password autocomplete to new-password on register mode", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "계정이 없으신가요? 회원가입" }));

    expect(screen.getByLabelText("닉네임").getAttribute("autocomplete")).toBe("nickname");
    const password = screen.getByLabelText("비밀번호");
    expect(password.getAttribute("id")).toBe("new-password");
    expect(password.getAttribute("autocomplete")).toBe("new-password");
  });
});
