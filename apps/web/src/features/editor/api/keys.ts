// ---------------------------------------------------------------------------
// Editor API — React Query keys
// ---------------------------------------------------------------------------

export const editorKeys = {
  all: ["editor"] as const,
  themes: () => [...editorKeys.all, "themes"] as const,
  theme: (id: string) => [...editorKeys.all, "themes", id] as const,
  characters: (themeId: string) =>
    [...editorKeys.all, "themes", themeId, "characters"] as const,
  maps: (themeId: string) =>
    [...editorKeys.all, "themes", themeId, "maps"] as const,
  locations: (themeId: string) =>
    [...editorKeys.all, "themes", themeId, "locations"] as const,
  clues: (themeId: string) =>
    [...editorKeys.all, "themes", themeId, "clues"] as const,
  storyInfos: (themeId: string) =>
    [...editorKeys.all, "themes", themeId, "story-infos"] as const,
  content: (themeId: string, key: string) =>
    [...editorKeys.all, "themes", themeId, "content", key] as const,
  characterRoleSheet: (characterId: string) =>
    [...editorKeys.all, "characters", characterId, "role-sheet"] as const,
  moduleSchemas: () => [...editorKeys.all, "module-schemas"] as const,
};
