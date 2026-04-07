import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// localStorage mock (jsdom 환경 보강)
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "mmp-audio-settings";

async function freshStore() {
  vi.resetModules();
  const mod = await import("../audioStore");
  return mod.useAudioStore;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("audioStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  describe("초기 상태 (저장값 없음)", () => {
    it("masterVolume 기본값은 0.8", async () => {
      const store = await freshStore();
      expect(store.getState().masterVolume).toBe(0.8);
    });

    it("sfxVolume 기본값은 1", async () => {
      const store = await freshStore();
      expect(store.getState().sfxVolume).toBe(1);
    });

    it("bgmVolume 기본값은 0.5", async () => {
      const store = await freshStore();
      expect(store.getState().bgmVolume).toBe(0.5);
    });

    it("voiceVolume 기본값은 1.0", async () => {
      const store = await freshStore();
      expect(store.getState().voiceVolume).toBe(1);
    });

    it("isMuted 기본값은 false", async () => {
      const store = await freshStore();
      expect(store.getState().isMuted).toBe(false);
    });

    it("bgmMediaId 기본값은 null", async () => {
      const store = await freshStore();
      expect(store.getState().bgmMediaId).toBeNull();
    });
  });

  describe("setMasterVolume (기존 동작 회귀)", () => {
    it("값을 갱신하고 0..1로 클램프한다", async () => {
      const store = await freshStore();
      store.getState().setMasterVolume(0.3);
      expect(store.getState().masterVolume).toBe(0.3);

      store.getState().setMasterVolume(2);
      expect(store.getState().masterVolume).toBe(1);

      store.getState().setMasterVolume(-0.5);
      expect(store.getState().masterVolume).toBe(0);
    });

    it("localStorage에 저장된다", async () => {
      const store = await freshStore();
      store.getState().setMasterVolume(0.42);
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.masterVolume).toBe(0.42);
    });
  });

  describe("toggleMute (기존 동작 회귀)", () => {
    it("isMuted를 토글한다", async () => {
      const store = await freshStore();
      store.getState().toggleMute();
      expect(store.getState().isMuted).toBe(true);
      store.getState().toggleMute();
      expect(store.getState().isMuted).toBe(false);
    });
  });

  describe("setVoiceVolume", () => {
    it("값을 갱신한다", async () => {
      const store = await freshStore();
      store.getState().setVoiceVolume(0.6);
      expect(store.getState().voiceVolume).toBe(0.6);
    });

    it("0..1 상한으로 클램프한다", async () => {
      const store = await freshStore();
      store.getState().setVoiceVolume(1.5);
      expect(store.getState().voiceVolume).toBe(1);
    });

    it("0..1 하한으로 클램프한다", async () => {
      const store = await freshStore();
      store.getState().setVoiceVolume(-0.2);
      expect(store.getState().voiceVolume).toBe(0);
    });

    it("localStorage에 저장된다", async () => {
      const store = await freshStore();
      store.getState().setVoiceVolume(0.33);
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.voiceVolume).toBe(0.33);
    });

    it("저장된 값은 새 모듈 인스턴스에서 복원된다", async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          masterVolume: 0.8,
          sfxVolume: 1,
          bgmVolume: 0.5,
          voiceVolume: 0.25,
          isMuted: false,
        }),
      );
      const store = await freshStore();
      expect(store.getState().voiceVolume).toBe(0.25);
    });
  });

  describe("setBgmMediaId", () => {
    it("media id를 갱신한다", async () => {
      const store = await freshStore();
      store.getState().setBgmMediaId("media-abc");
      expect(store.getState().bgmMediaId).toBe("media-abc");
    });

    it("null로 초기화할 수 있다", async () => {
      const store = await freshStore();
      store.getState().setBgmMediaId("media-abc");
      store.getState().setBgmMediaId(null);
      expect(store.getState().bgmMediaId).toBeNull();
    });

    it("setBgmMediaId 단독으로는 localStorage에 저장되지 않는다", async () => {
      const store = await freshStore();
      store.getState().setBgmMediaId("media-xyz");
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).toBeNull();
    });

    it("다른 setter가 호출돼도 bgmMediaId는 직렬화에서 제외된다", async () => {
      const store = await freshStore();
      store.getState().setBgmMediaId("media-xyz");
      store.getState().setMasterVolume(0.7);
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.bgmMediaId).toBeUndefined();
      expect(parsed.masterVolume).toBe(0.7);
    });

    it("새 모듈 인스턴스에서는 항상 null로 초기화된다 (저장값 무시)", async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          masterVolume: 0.8,
          sfxVolume: 1,
          bgmVolume: 0.5,
          voiceVolume: 1,
          isMuted: false,
          bgmMediaId: "should-not-restore",
        }),
      );
      const store = await freshStore();
      expect(store.getState().bgmMediaId).toBeNull();
    });
  });
});
