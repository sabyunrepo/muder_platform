import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Pagination } from "../Pagination";

afterEach(() => {
  cleanup();
});

describe("Pagination", () => {
  describe("totalPages <= 1", () => {
    it("totalPages=1이면 렌더링하지 않는다", () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />,
      );
      expect(container.innerHTML).toBe("");
    });

    it("totalPages=0이면 렌더링하지 않는다", () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={0} onPageChange={vi.fn()} />,
      );
      expect(container.innerHTML).toBe("");
    });
  });

  describe("페이지 버튼 클릭", () => {
    it("페이지 버튼 클릭 시 onPageChange를 호출한다", () => {
      const onPageChange = vi.fn();
      render(
        <Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />,
      );
      const page2 = screen.getByText("2");
      fireEvent.click(page2);
      expect(onPageChange).toHaveBeenCalledWith(2);
    });
  });

  describe("현재 페이지 하이라이트", () => {
    it("현재 페이지 버튼이 aria-current='page'를 가진다", () => {
      render(
        <Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />,
      );
      const current = screen.getByText("2");
      expect(current.getAttribute("aria-current")).toBe("page");
    });

    it("현재 페이지 버튼에 amber 클래스가 적용된다", () => {
      render(
        <Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />,
      );
      const current = screen.getByText("2");
      expect(current.className).toContain("bg-amber-500");
    });
  });

  describe("이전/다음 버튼 비활성화", () => {
    it("첫 페이지에서 이전 버튼이 비활성화된다", () => {
      render(
        <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />,
      );
      const prevBtn = screen.getByLabelText("Previous page");
      expect(prevBtn).toHaveProperty("disabled", true);
    });

    it("마지막 페이지에서 다음 버튼이 비활성화된다", () => {
      render(
        <Pagination currentPage={5} totalPages={5} onPageChange={vi.fn()} />,
      );
      const nextBtn = screen.getByLabelText("Next page");
      expect(nextBtn).toHaveProperty("disabled", true);
    });

    it("중간 페이지에서 이전/다음 버튼이 모두 활성화된다", () => {
      render(
        <Pagination currentPage={3} totalPages={5} onPageChange={vi.fn()} />,
      );
      const prevBtn = screen.getByLabelText("Previous page");
      const nextBtn = screen.getByLabelText("Next page");
      expect(prevBtn).toHaveProperty("disabled", false);
      expect(nextBtn).toHaveProperty("disabled", false);
    });

    it("이전 버튼 클릭 시 currentPage - 1로 호출한다", () => {
      const onPageChange = vi.fn();
      render(
        <Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />,
      );
      fireEvent.click(screen.getByLabelText("Previous page"));
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it("다음 버튼 클릭 시 currentPage + 1로 호출한다", () => {
      const onPageChange = vi.fn();
      render(
        <Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />,
      );
      fireEvent.click(screen.getByLabelText("Next page"));
      expect(onPageChange).toHaveBeenCalledWith(4);
    });
  });
});
