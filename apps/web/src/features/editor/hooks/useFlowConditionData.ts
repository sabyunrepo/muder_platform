import { useEditorCharacters, useEditorClues } from "@/features/editor/api";
import type { SelectOption } from "@/features/editor/components/design/condition/ConditionRule";

// ---------------------------------------------------------------------------
// useFlowConditionData
// Provides character / clue select options for ConditionBuilder.
// Mission list is not stored server-side yet; callers pass missions directly.
// ---------------------------------------------------------------------------

interface FlowConditionData {
  characters: SelectOption[];
  clues: SelectOption[];
  isLoading: boolean;
}

export function useFlowConditionData(themeId: string): FlowConditionData {
  const { data: chars, isLoading: charsLoading } =
    useEditorCharacters(themeId);
  const { data: clues, isLoading: cluesLoading } = useEditorClues(themeId);

  const characters: SelectOption[] = (chars ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const clueOptions: SelectOption[] = (clues ?? []).map((cl) => ({
    id: cl.id,
    name: cl.name,
  }));

  return {
    characters,
    clues: clueOptions,
    isLoading: charsLoading || cluesLoading,
  };
}
