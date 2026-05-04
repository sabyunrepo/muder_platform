import { useEffect, useMemo, useState } from "react";
import { useEditorCharacters } from "../../api";
import { useReadingSections } from "../../readingApi";
import { InformationDeliveryContent, InformationDeliveryHeader } from "./InformationDeliveryPanelViews";
import type { FlowNodeData } from "../../flowTypes";
import {
  flowNodeToInformationDeliveries,
  informationDeliveriesToFlowNodePatch,
  isCompleteInformationDelivery,
  makeEmptyInformationDelivery,
  type InformationDeliveryViewModel,
} from "../../entities/phase/phaseEntityAdapter";

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
  const [characterQuery, setCharacterQuery] = useState("");
  const [sectionQuery, setSectionQuery] = useState("");
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

  const filteredSections = useMemo(() => {
    const query = sectionQuery.trim().toLowerCase();
    if (!query) return sections;
    return sections.filter((section) => section.name.toLowerCase().includes(query));
  }, [sections, sectionQuery]);

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

  const isStoryProgression = phaseData.phase_type === "story_progression";
  const loading = charactersLoading || sectionsLoading;
  const hasLoadError = charactersError || sectionsError;
  const canAddCharacterDelivery = characters.length > 0;

  const retryLoad = () => {
    if (charactersError) void refetchCharacters();
    if (sectionsError) void refetchSections();
  };

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <InformationDeliveryHeader
        isStoryProgression={isStoryProgression}
        canAddCharacterDelivery={canAddCharacterDelivery}
        onAddAllPlayers={addAllPlayersDelivery}
        onAddCharacter={addCharacterDelivery}
      />

      <InformationDeliveryContent
        loading={loading}
        hasLoadError={hasLoadError}
        isStoryProgression={isStoryProgression}
        hasCharacters={characters.length > 0}
        hasSections={sections.length > 0}
        characterQuery={characterQuery}
        sectionQuery={sectionQuery}
        deliveries={draftDeliveries}
        characters={filteredCharacters}
        allCharacters={characters}
        sections={filteredSections}
        allSections={sections}
        onRetryLoad={retryLoad}
        onCharacterQueryChange={setCharacterQuery}
        onSectionQueryChange={setSectionQuery}
        onSelectCharacter={(deliveryId, characterId) => updateDelivery(deliveryId, { characterId })}
        onToggleSection={toggleSection}
        onRemoveDelivery={removeDelivery}
      />
    </section>
  );
}
