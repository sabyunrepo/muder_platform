import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Modal } from "../Modal";

afterEach(() => {
  cleanup();
});

describe("Modal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: "테스트 모달",
    children: <p>모달 내용</p>,
  };

  describe("isOpen=false", () => {
    it("렌더링되지 않는다", () => {
      render(<Modal {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByText("테스트 모달")).toBeNull();
    });
  });

  describe("isOpen=true", () => {
    it("dialog 역할로 렌더링된다", () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    it("title을 표시한다", () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByText("테스트 모달")).toBeDefined();
    });

    it("children을 렌더링한다", () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByText("모달 내용")).toBeDefined();
    });
  });

  describe("닫기 동작", () => {
    it("X 버튼 클릭 시 onClose를 호출한다", () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      const closeBtn = screen.getByLabelText("Close");
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("오버레이 클릭 시 onClose를 호출한다", () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      // 오버레이는 aria-hidden="true"인 div
      const overlay = document.querySelector('[aria-hidden="true"]');
      expect(overlay).not.toBeNull();
      fireEvent.click(overlay!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("Escape 키 입력 시 onClose를 호출한다", () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("footer", () => {
    it("footer를 렌더링한다", () => {
      render(
        <Modal {...defaultProps} footer={<button>확인</button>} />,
      );
      expect(screen.getByText("확인")).toBeDefined();
    });

    it("footer가 없으면 footer 영역을 렌더링하지 않는다", () => {
      const { container } = render(<Modal {...defaultProps} />);
      // footer 영역은 border-t 클래스를 가진 flex 컨테이너
      const dialog = screen.getByRole("dialog");
      const footerArea = dialog.querySelector(".border-t.border-slate-800");
      // header도 border-b를 가지므로, footer는 justify-end를 가진 것만 체크
      const footerDiv = dialog.querySelector(".justify-end.border-t");
      expect(footerDiv).toBeNull();
    });
  });
});
