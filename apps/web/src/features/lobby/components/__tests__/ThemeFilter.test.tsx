import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { ThemeFilter, type ThemeFilterValues } from "../ThemeFilter";

afterEach(() => {
  cleanup();
});

const defaultValues: ThemeFilterValues = {
  search: "",
  difficulty: "",
  playerCount: "",
  sort: "latest",
};

describe("ThemeFilter", () => {
  describe("기본 렌더링", () => {
    it("검색 Input을 렌더링한다", () => {
      render(<ThemeFilter values={defaultValues} onChange={vi.fn()} />);
      const input = screen.getByPlaceholderText("테마 검색...");
      expect(input).toBeDefined();
    });

    it("난이도 Select를 렌더링한다", () => {
      render(<ThemeFilter values={defaultValues} onChange={vi.fn()} />);
      // 난이도 select는 "전체 난이도" 옵션을 포함
      expect(screen.getByDisplayValue("전체 난이도")).toBeDefined();
    });

    it("인원수 Select를 렌더링한다", () => {
      render(<ThemeFilter values={defaultValues} onChange={vi.fn()} />);
      expect(screen.getByDisplayValue("전체 인원")).toBeDefined();
    });

    it("정렬 Select를 렌더링한다", () => {
      render(<ThemeFilter values={defaultValues} onChange={vi.fn()} />);
      expect(screen.getByDisplayValue("최신순")).toBeDefined();
    });
  });

  describe("필터 변경", () => {
    it("난이도 변경 시 onChange를 호출한다", () => {
      const onChange = vi.fn();
      render(<ThemeFilter values={defaultValues} onChange={onChange} />);

      const difficultySelect = screen.getByDisplayValue("전체 난이도");
      fireEvent.change(difficultySelect, { target: { value: "hard" } });

      expect(onChange).toHaveBeenCalledWith({
        ...defaultValues,
        difficulty: "hard",
      });
    });

    it("인원수 변경 시 onChange를 호출한다", () => {
      const onChange = vi.fn();
      render(<ThemeFilter values={defaultValues} onChange={onChange} />);

      const playerCountSelect = screen.getByDisplayValue("전체 인원");
      fireEvent.change(playerCountSelect, { target: { value: "4-6" } });

      expect(onChange).toHaveBeenCalledWith({
        ...defaultValues,
        playerCount: "4-6",
      });
    });

    it("정렬 변경 시 onChange를 호출한다", () => {
      const onChange = vi.fn();
      render(<ThemeFilter values={defaultValues} onChange={onChange} />);

      const sortSelect = screen.getByDisplayValue("최신순");
      fireEvent.change(sortSelect, { target: { value: "popular" } });

      expect(onChange).toHaveBeenCalledWith({
        ...defaultValues,
        sort: "popular",
      });
    });

    it("검색어 입력 시 debounce 후 onChange를 호출한다", async () => {
      vi.useFakeTimers();
      const onChange = vi.fn();
      render(<ThemeFilter values={defaultValues} onChange={onChange} />);

      const searchInput = screen.getByPlaceholderText("테마 검색...");
      fireEvent.change(searchInput, { target: { value: "추리" } });

      // debounce 전에는 호출되지 않는다
      expect(onChange).not.toHaveBeenCalled();

      // 300ms 경과
      vi.advanceTimersByTime(300);

      expect(onChange).toHaveBeenCalledWith({
        ...defaultValues,
        search: "추리",
      });

      vi.useRealTimers();
    });
  });
});
