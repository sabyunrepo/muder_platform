import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "../uiStore";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("uiStore", () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebarOpen: false,
      activeModal: null,
    });
  });

  describe("초기 상태", () => {
    it("sidebarOpen은 false이다", () => {
      expect(useUIStore.getState().sidebarOpen).toBe(false);
    });

    it("activeModal은 null이다", () => {
      expect(useUIStore.getState().activeModal).toBeNull();
    });
  });

  describe("toggleSidebar", () => {
    it("false에서 true로 토글한다", () => {
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    it("true에서 false로 토글한다", () => {
      useUIStore.getState().toggleSidebar();
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(false);
    });

    it("연속 토글이 정상 동작한다", () => {
      const { toggleSidebar } = useUIStore.getState();
      toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(true);
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(false);
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });
  });

  describe("setSidebarOpen", () => {
    it("true로 직접 설정한다", () => {
      useUIStore.getState().setSidebarOpen(true);
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    it("false로 직접 설정한다", () => {
      useUIStore.getState().setSidebarOpen(true);
      useUIStore.getState().setSidebarOpen(false);
      expect(useUIStore.getState().sidebarOpen).toBe(false);
    });
  });

  describe("openModal", () => {
    it("activeModal을 설정한다", () => {
      useUIStore.getState().openModal("settings");
      expect(useUIStore.getState().activeModal).toBe("settings");
    });

    it("다른 모달로 변경한다", () => {
      useUIStore.getState().openModal("settings");
      useUIStore.getState().openModal("profile");
      expect(useUIStore.getState().activeModal).toBe("profile");
    });
  });

  describe("closeModal", () => {
    it("activeModal을 null로 설정한다", () => {
      useUIStore.getState().openModal("settings");
      useUIStore.getState().closeModal();
      expect(useUIStore.getState().activeModal).toBeNull();
    });

    it("이미 null인 경우에도 안전하게 동작한다", () => {
      useUIStore.getState().closeModal();
      expect(useUIStore.getState().activeModal).toBeNull();
    });
  });
});
