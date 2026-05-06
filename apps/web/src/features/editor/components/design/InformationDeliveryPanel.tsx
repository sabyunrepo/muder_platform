import { useEffect, useMemo, useState } from "react";
import { useEditorCharacters } from "../../api";
import { useReadingSections } from "../../readingApi";
import { useStoryInfos, type StoryInfoResponse } from "../../storyInfoApi";
import {
  filterReadingSectionOptions,
  toReadingSectionPickerOptions,
} from "../../entities/story/readingSectionAdapter";
import {
  InformationDeliveryContent,
  InformationDeliveryHeader,
  type StoryInfoOption,
} from "./InformationDeliveryPanelViews";
import type { FlowNodeData } from "../../flowTypes";
import {
  flowNodeToInformationDeliveries,
  informationDeliveriesToFlowNodePatch,
  isCompleteInformationDelivery,
  makeEmptyInformationDelivery,
  type InformationDeliveryViewModel,
} from "../../entities/shared/informationDeliveryAdapter";

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
    data: sections = [],
    isLoading: sectionsLoading,
    isError: sectionsError,
    refetch: refetchSections,
  } = useReadingSections(themeId);
  const {
    data: storyInfos = [],
    isLoading: storyInfosLoading,
    isError: storyInfosError,
    refetch: refetchStoryInfos,
  } = useStoryInfos(themeId);
  const [characterQuery, setCharacterQuery] = useState("");
  const [sectionQuery, setSectionQuery] = useState("");
  const [infoQuery, setInfoQuery] = useState("");
  const savedDeliveries = useMemo(
    () => flowNodeToInformationDeliveries(phaseData),
    [phaseData],
  );
  const [draftDeliveries, setDraftDeliveries] = useState(() => savedDeliveries);

  useEffect(() => {
    setDraftDeliveries((current) => {
      const savedIds = new Set(savedDeliveries.map((delivery) => delivery.id));
      const incompleteDrafts = current.filter(
        (delivery) => !savedIds.has(delivery.id) && !isCompleteInformationDelivery(delivery),
      );
      return [...savedDeliveries, ...incompleteDrafts];
    });
  }, [savedDeliveries]);

  const filteredCharacters = useMemo(() => {
    const query = characterQuery.trim().toLowerCase();
    if (!query) return characters;
    return characters.filter((character) => character.name.toLowerCase().includes(query));
  }, [characters, characterQuery]);

  const sectionOptions = useMemo(() => toReadingSectionPickerOptions(sections), [sections]);
  const storyInfoOptions = useMemo(() => toStoryInfoOptions(storyInfos), [storyInfos]);

  const filteredSections = useMemo(
    () => filterReadingSectionOptions(sectionOptions, sectionQuery),
    [sectionOptions, sectionQuery],
  );
  const filteredStoryInfos = useMemo(
    () => filterStoryInfoOptions(storyInfoOptions, infoQuery),
    [storyInfoOptions, infoQuery],
  );

  const updateDeliveries = (next: InformationDeliveryViewModel[]) => {
    setDraftDeliveries(next);
    onChange(informationDeliveriesToFlowNodePatch(phaseData, next));
  };

  const addCharacterDelivery = () => {
    updateDeliveries([...draftDeliveries, makeEmptyInformationDelivery("character")]);
  };

  const addAllPlayersDelivery = () => {
    updateDeliveries([...draftDeliveries, makeEmptyInformationDelivery("all_players")]);
  };

  const updateDelivery = (deliveryId: string, patch: Partial<InformationDeliveryViewModel>) => {
    updateDeliveries(
      draftDeliveries.map((delivery) =>
        delivery.id === deliveryId ? { ...delivery, ...patch } : delivery,
      ),
    );
  };

  const removeDelivery = (deliveryId: string) => {
    updateDeliveries(draftDeliveries.filter((delivery) => delivery.id !== deliveryId));
  };

  const toggleSection = (delivery: InformationDeliveryViewModel, sectionId: string) => {
    const hasSection = delivery.readingSectionIds.includes(sectionId);
    updateDelivery(delivery.id, {
      readingSectionIds: hasSection
        ? delivery.readingSectionIds.filter((id) => id !== sectionId)
        : [...delivery.readingSectionIds, sectionId],
    });
  };
  const toggleStoryInfo = (delivery: InformationDeliveryViewModel, storyInfoId: string) => {
    const hasStoryInfo = delivery.storyInfoIds.includes(storyInfoId);
    updateDelivery(delivery.id, {
      storyInfoIds: hasStoryInfo
        ? delivery.storyInfoIds.filter((id) => id !== storyInfoId)
        : [...delivery.storyInfoIds, storyInfoId],
    });
  };

  const loading = charactersLoading || sectionsLoading || storyInfosLoading;
  const hasLoadError = charactersError || sectionsError || storyInfosError;
  const canAddCharacterDelivery = characters.length > 0;

  const retryLoad = () => {
    if (charactersError) void refetchCharacters();
    if (sectionsError) void refetchSections();
    if (storyInfosError) void refetchStoryInfos();
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
        hasSections={sections.length > 0}
        hasStoryInfos={storyInfos.length > 0}
        characterQuery={characterQuery}
        sectionQuery={sectionQuery}
        infoQuery={infoQuery}
        deliveries={draftDeliveries}
        characters={filteredCharacters}
        allCharacters={characters}
        sections={filteredSections}
        allSections={sectionOptions}
        storyInfos={filteredStoryInfos}
        allStoryInfos={storyInfoOptions}
        onRetryLoad={retryLoad}
        onCharacterQueryChange={setCharacterQuery}
        onSectionQueryChange={setSectionQuery}
        onInfoQueryChange={setInfoQuery}
        onSelectCharacter={(deliveryId, characterId) => updateDelivery(deliveryId, { characterId })}
        onToggleSection={toggleSection}
        onToggleStoryInfo={toggleStoryInfo}
        onRemoveDelivery={removeDelivery}
      />
    </section>
  );
}

function toStoryInfoOptions(infos: StoryInfoResponse[]): StoryInfoOption[] {
  return infos.map((info) => ({
    id: info.id,
    name: info.title,
    summary: summarizeInfo(info.body),
    metaLabel: info.imageMediaId ? "이미지 포함" : undefined,
  }));
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
