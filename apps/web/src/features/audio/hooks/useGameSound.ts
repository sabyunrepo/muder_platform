import { WsEventType } from "@mmp/shared";
import { useWsEvent } from "@/hooks/useWsEvent";
import { useAudioStore, selectIsMuted } from "@/stores/audioStore";
import type { AudioManager } from "../AudioManager";
import type { SoundPlayPayload } from "../types";

/**
 * WS `sound:play` 이벤트를 구독하여 AudioManager로 재생.
 * - 음소거 상태이면 재생 스킵
 * - 탭이 백그라운드(hidden)이면 SFX 스킵
 */
export function useGameSound(manager: AudioManager | null): void {
  useWsEvent<SoundPlayPayload>("game", WsEventType.SOUND_PLAY, (payload) => {
    if (!manager) return;

    // 음소거 체크
    if (useAudioStore.getState().isMuted) return;

    // 탭 hidden 시 SFX 무시
    if (document.visibilityState === "hidden") return;

    manager.play(payload.soundId);
  });
}

// Re-export selectIsMuted for convenience
export { selectIsMuted };
