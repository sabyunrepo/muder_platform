import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThemeStoreState {
  selectedGenre: string | null;
  selectedPresetId: string | null;
  configValues: Record<string, unknown>;
  isDirty: boolean;
}

interface ThemeStoreActions {
  setGenre: (genre: string | null) => void;
  setPreset: (presetId: string | null) => void;
  updateField: (path: string, value: unknown) => void;
  resetConfig: () => void;
  setConfigValues: (values: Record<string, unknown>) => void;
}

type ThemeStore = ThemeStoreState & ThemeStoreActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialState: ThemeStoreState = {
  selectedGenre: null,
  selectedPresetId: null,
  configValues: {},
  isDirty: false,
};

export const useThemeStore = create<ThemeStore>()((set) => ({
  ...initialState,

  setGenre: (genre) =>
    set({
      selectedGenre: genre,
      selectedPresetId: null,
      configValues: {},
      isDirty: false,
    }),

  setPreset: (presetId) =>
    set({
      selectedPresetId: presetId,
      configValues: {},
      isDirty: false,
    }),

  updateField: (path, value) =>
    set((state) => {
      const keys = path.split(".");
      const next = { ...state.configValues };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let cursor: any = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (cursor[keys[i]] === undefined || typeof cursor[keys[i]] !== "object") {
          cursor[keys[i]] = {};
        } else {
          cursor[keys[i]] = { ...cursor[keys[i]] };
        }
        cursor = cursor[keys[i]];
      }
      cursor[keys[keys.length - 1]] = value;
      return { configValues: next, isDirty: true };
    }),

  resetConfig: () => set({ configValues: {}, isDirty: false }),

  setConfigValues: (values) => set({ configValues: values, isDirty: false }),
}));
