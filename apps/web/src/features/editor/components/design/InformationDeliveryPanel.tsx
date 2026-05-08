import { useEffect, useMemo, useState } from "react";
import { useEditorCharacters, useEditorClues, type ClueResponse } from "../../api";
import { useStoryInfos, type StoryInfoResponse } from "../../storyInfoApi";
import {
  InformationDeliveryContent,
  InformationDeliveryHeader,
  type ClueOption,
  type StoryInfoOption,
} from "./InformationDeliveryPanelViews";
import type { FlowNodeData } from "../../flowTypes";
import {
  flowNodeToSceneEntryEffects,
  isCompleteSceneEntryEffect,
  makeEmptySceneEntryEffect,
  sceneEntryEffectsToFlowNodePatch,
  type SceneEntryEffectViewModel,
} from "../../entities/shared/sceneEntryEffectAdapter";

interface InformationDeliveryPanelProps {
  themeId: string;
  phaseData: FlowNodeData;
  onChange: (patch: Partial<FlowNodeData>) => void;
}

export function InformationDeliveryPanel({
  themeId,
  phaseData,
  onChange,
}: InformationDeliveryPanelProps) {
  const {
    data: characters = [],
    isLoading: charactersLoading,
    isError: charactersError,
    refetch: refetchCharacters,
  } = useEditorCharacters(themeId);
  const {
    data: storyInfos = [],
    isLoading: storyInfosLoading,
    isError: storyInfosError,
    refetch: refetchStoryInfos,
  } = useStoryInfos(themeId);
  const {
    data: clues = [],
    isLoading: cluesLoading,
    isError: cluesError,
    refetch: refetchClues,
  } = useEditorClues(themeId);
  const [characterQuery, setCharacterQuery] = useState("");
  const [infoQuery, setInfoQuery] = useState("");
  const [clueQuery, setClueQuery] = useState("");
  const savedDeliveries = useMemo(
    () => flowNodeToSceneEntryEffects(phaseData),
    [phaseData],
  );
  const [draftDeliveries, setDraftDeliveries] = useState(() => savedDeliveries);

  useEffect(() => {
    setDraftDeliveries((current) => {
      const savedIds = new Set(savedDeliveries.map((delivery) => delivery.id));
      const incompleteDrafts = current.filter(
        (delivery) => !savedIds.has(delivery.id) && !isCompleteSceneEntryEffect(delivery),
      );
      return [...savedDeliveries, ...incompleteDrafts];
    });
  }, [savedDeliveries]);

  const filteredCharacters = useMemo(() => {
    const query = characterQuery.trim().toLowerCase();
    if (!query) return characters;
    return characters.filter((character) => character.name.toLowerCase().includes(query));
  }, [characters, characterQuery]);

  const storyInfoOptions = useMemo(() => toStoryInfoOptions(storyInfos), [storyInfos]);
  const clueOptions = useMemo(() => toClueOptions(clues), [clues]);

  const filteredStoryInfos = useMemo(
    () => filterStoryInfoOptions(storyInfoOptions, infoQuery),
    [storyInfoOptions, infoQuery],
  );
  const filteredClues = useMemo(
    () => filterClueOptions(clueOptions, clueQuery),
    [clueOptions, clueQuery],
  );

  const updateDeliveries = (next: SceneEntryEffectViewModel[]) => {
    setDraftDeliveries(next);
    onChange(sceneEntryEffectsToFlowNodePatch(phaseData, next));
  };

  const addCharacterDelivery = () => {
    updateDeliveries([...draftDeliveries, makeEmptySceneEntryEffect("character")]);
  };

  const addAllPlayersDelivery = () => {
    updateDeliveries([...draftDeliveries, makeEmptySceneEntryEffect("all_players")]);
  };

  const updateDelivery = (deliveryId: string, patch: Partial<SceneEntryEffectViewModel>) => {
    updateDeliveries(
      draftDeliveries.map((delivery) =>
        delivery.id === deliveryId ? { ...delivery, ...patch } : delivery,
      ),
    );
  };

  const removeDelivery = (deliveryId: string) => {
    updateDeliveries(draftDeliveries.filter((delivery) => delivery.id !== deliveryId));
  };

  const toggleStoryInfo = (delivery: SceneEntryEffectViewModel, storyInfoId: string) => {
    const hasStoryInfo = delivery.storyInfoIds.includes(storyInfoId);
    updateDelivery(delivery.id, {
      storyInfoIds: hasStoryInfo
        ? delivery.storyInfoIds.filter((id) => id !== storyInfoId)
        : [...delivery.storyInfoIds, storyInfoId],
    });
  };

  const toggleClue = (delivery: SceneEntryEffectViewModel, clueId: string) => {
    const hasClue = delivery.clueIds.includes(clueId);
    updateDelivery(delivery.id, {
      clueIds: hasClue
        ? delivery.clueIds.filter((id) => id !== clueId)
        : [...delivery.clueIds, clueId],
    });
  };

  const loading = charactersLoading || storyInfosLoading || cluesLoading;
  const hasLoadError = charactersError || storyInfosError || cluesError;
  const canAddCharacterDelivery = characters.length > 0;

  const retryLoad = () => {
    if (charactersError) void refetchCharacters();
    if (storyInfosError) void refetchStoryInfos();
    if (cluesError) void refetchClues();
  };

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <InformationDeliveryHeader
        canAddCharacterDelivery={canAddCharacterDelivery}
        onAddAllPlayers={addAllPlayersDelivery}
        onAddCharacter={addCharacterDelivery}
      />

      <InformationDeliveryContent
        loading={loading}
        hasLoadError={hasLoadError}
        hasCharacters={characters.length > 0}
        hasStoryInfos={storyInfos.length > 0}
        hasClues={clues.length > 0}
        characterQuery={characterQuery}
        infoQuery={infoQuery}
        clueQuery={clueQuery}
        deliveries={draftDeliveries}
        characters={filteredCharacters}
        allCharacters={characters}
        storyInfos={filteredStoryInfos}
        allStoryInfos={storyInfoOptions}
        clues={filteredClues}
        allClues={clueOptions}
        onRetryLoad={retryLoad}
        onCharacterQueryChange={setCharacterQuery}
        onInfoQueryChange={setInfoQuery}
        onClueQueryChange={setClueQuery}
        onSelectCharacter={(deliveryId, characterId) => updateDelivery(deliveryId, { characterId })}
        onToggleStoryInfo={toggleStoryInfo}
        onToggleClue={toggleClue}
        onRemoveDelivery={removeDelivery}
      />
    </section>
  );
}

function toClueOptions(clues: ClueResponse[]): ClueOption[] {
  return clues.map((clue) => ({
    id: clue.id,
    name: clue.name,
    summary: clue.description?.trim() || undefined,
    metaLabel: typeof clue.reveal_round === "number" ? `R${clue.reveal_round}` : undefined,
  }));
}

function toStoryInfoOptions(infos: StoryInfoResponse[]): StoryInfoOption[] {
  return infos.map((info) => ({
    id: info.id,
    name: info.title,
    summary: summarizeInfo(info.body),
    metaLabel: info.imageMediaId ? "이미지 포함" : undefined,
  }));
}

function filterClueOptions(options: ClueOption[], query: string): ClueOption[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return options;
  return options.filter(
    (option) =>
      option.name.toLowerCase().includes(normalized) ||
      (option.summary?.toLowerCase().includes(normalized) ?? false),
  );
}

function filterStoryInfoOptions(options: StoryInfoOption[], query: string): StoryInfoOption[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return options;
  return options.filter(
    (option) =>
      option.name.toLowerCase().includes(normalized) ||
      (option.summary?.toLowerCase().includes(normalized) ?? false),
  );
}

function summarizeInfo(body: string): string | undefined {
  const trimmed = body.trim();
  if (!trimmed) return undefined;
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}...` : trimmed;
}
