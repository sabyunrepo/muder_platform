import { createContext, useContext } from "react";
import type { AudioOrchestrator } from "./AudioOrchestrator";

// ---------------------------------------------------------------------------
// React context exposing the singleton AudioOrchestrator constructed by
// AudioProvider on mount. Consumers (e.g. useGameMediaEvents) read it via
// useAudioOrchestrator(); the value is null until the provider has finished
// constructing the orchestrator (e.g. SSR/test environments without
// AudioContext).
// ---------------------------------------------------------------------------

export interface AudioOrchestratorContextValue {
  orchestrator: AudioOrchestrator | null;
}

export const AudioOrchestratorContext =
  createContext<AudioOrchestratorContextValue>({
    orchestrator: null,
  });

export function useAudioOrchestrator(): AudioOrchestrator | null {
  return useContext(AudioOrchestratorContext).orchestrator;
}
