import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Button } from "../Button";

afterEach(() => {
  cleanup();
});

describe("Button", () => {
  describe("기본 렌더링", () => {
    it("children을 표시한다", () => {
      render(<Button>클릭</Button>);
      expect(screen.getByRole("button", { name: "클릭" })).toBeDefined();
    });

    it("button 요소로 렌더링된다", () => {
      render(<Button>테스트</Button>);
      expect(screen.getByRole("button")).toBeDefined();
    });
  });

  describe("variant별 스타일 클래스", () => {
    it("primary variant는 amber 클래스를 가진다", () => {
      render(<Button variant="primary">Primary</Button>);
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("bg-amber-500");
    });

    it("secondary variant는 slate 클래스를 가진다", () => {
      render(<Button variant="secondary">Secondary</Button>);
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("bg-slate-800");
    });

    it("danger variant는 red 클래스를 가진다", () => {
      render(<Button variant="danger">Danger</Button>);
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("bg-red-600");
    });

    it("ghost variant는 bg-transparent 클래스를 가진다", () => {
      render(<Button variant="ghost">Ghost</Button>);
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("bg-transparent");
    });
  });

  describe("isLoading", () => {
    it("isLoading=true이면 disabled 상태가 된다", () => {
      render(<Button isLoading>로딩</Button>);
      const btn = screen.getByRole("button");
      expect(btn).toHaveProperty("disabled", true);
    });

    it("isLoading=true이면 스피너를 표시한다", () => {
      const { container } = render(<Button isLoading>로딩</Button>);
      const spinner = container.querySelector('[role="status"]');
      expect(spinner).not.toBeNull();
    });
  });

  describe("leftIcon / rightIcon", () => {
    it("leftIcon을 렌더링한다", () => {
      render(
        <Button leftIcon={<span data-testid="left-icon">L</span>}>
          버튼
        </Button>,
      );
      expect(screen.getByTestId("left-icon")).toBeDefined();
    });

    it("rightIcon을 렌더링한다", () => {
      render(
        <Button rightIcon={<span data-testid="right-icon">R</span>}>
          버튼
        </Button>,
      );
      expect(screen.getByTestId("right-icon")).toBeDefined();
    });

    it("isLoading=true이면 rightIcon을 렌더링하지 않는다", () => {
      render(
        <Button isLoading rightIcon={<span data-testid="right-icon">R</span>}>
          버튼
        </Button>,
      );
      expect(screen.queryByTestId("right-icon")).toBeNull();
    });
  });

  describe("disabled 상태", () => {
    it("disabled일 때 onClick이 호출되지 않는다", () => {
      const onClick = vi.fn();
      render(
        <Button disabled onClick={onClick}>
          비활성
        </Button>,
      );
      const btn = screen.getByRole("button");
      fireEvent.click(btn);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("size별 크기 클래스", () => {
    it("sm 사이즈는 px-3 py-1.5 클래스를 가진다", () => {
      render(<Button size="sm">Small</Button>);
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("px-3");
      expect(btn.className).toContain("py-1.5");
    });

    it("md 사이즈는 px-4 py-2 클래스를 가진다", () => {
      render(<Button size="md">Medium</Button>);
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("px-4");
      expect(btn.className).toContain("py-2");
    });

    it("lg 사이즈는 px-6 py-3 클래스를 가진다", () => {
      render(<Button size="lg">Large</Button>);
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("px-6");
      expect(btn.className).toContain("py-3");
    });
  });
});
