import { create } from "zustand";
import type { EditorTab } from "@/features/editor/constants";

// ---------------------------------------------------------------------------
// Editor UI Store
// ---------------------------------------------------------------------------

interface EditorUIState {
  activeTab: EditorTab;
  setActiveTab: (tab: EditorTab) => void;
  validationErrors: Record<string, string[]>; // tab key → errors
  setValidationErrors: (errors: Record<string, string[]>) => void;
  clearValidationErrors: () => void;
}

export const useEditorUI = create<EditorUIState>()((set) => ({
  activeTab: "storyMap",
  setActiveTab: (tab) => set({ activeTab: tab }),
  validationErrors: {},
  setValidationErrors: (errors) => set({ validationErrors: errors }),
  clearValidationErrors: () => set({ validationErrors: {} }),
}));
