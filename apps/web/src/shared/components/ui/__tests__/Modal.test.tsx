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
      const closeBtn = screen.getByLabelText("닫기");
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("오버레이 클릭 시 onClose를 호출한다", () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
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
      render(<Modal {...defaultProps} />);
      // footer 영역은 border-t 클래스를 가진 flex 컨테이너
      const dialog = screen.getByRole("dialog");
      const footerDiv = dialog.querySelector(".justify-end.border-t");
      expect(footerDiv).toBeNull();
    });
  });

  describe("focus", () => {
    it("열릴 때 첫 focusable 요소에 focus하고 닫힐 때 이전 focus를 복원한다", () => {
      const onClose = vi.fn();
      render(
        <>
          <button type="button">트리거</button>
          <Modal isOpen onClose={onClose} title="포커스 모달">
            <button type="button">첫 버튼</button>
          </Modal>
        </>,
      );

      expect(screen.getByRole("button", { name: "닫기" })).toBe(document.activeElement);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
