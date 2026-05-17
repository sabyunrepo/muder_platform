import type { PhaseAction } from "../../flowTypes";
import { GRANT_CLUE_ACTION, LEGACY_GRANT_CLUE_ACTION } from "../../entities/shared/actionAdapter";
import { OptionList, type OptionItem } from "./InformationDeliveryOptionList";

const ALL_PLAYERS_TARGET_ID = "__all_players__";

interface CharacterOption extends OptionItem {
  id: string;
  name: string;
}

interface ClueOption extends OptionItem {
  id: string;
  name: string;
}

interface ClueGrantDelivery {
  id?: string;
  target?: {
    type?: string;
    character_id?: string;
    characterId?: string;
  };
  clue_ids?: string[];
  clueIds?: string[];
}

export function ClueGrantActionFields({
  action,
  characters,
  clues,
  onParamsChange,
}: {
  action: PhaseAction;
  characters: CharacterOption[];
  clues: ClueOption[];
  onParamsChange: (params: Record<string, unknown>) => void;
}) {
  if (action.type !== GRANT_CLUE_ACTION && action.type !== LEGACY_GRANT_CLUE_ACTION) return null;

  const params = action.params ?? {};
  const delivery = readFirstDelivery(params);
  const targetOptions: CharacterOption[] = [
    { id: ALL_PLAYERS_TARGET_ID, name: "전체 캐릭터", summary: "모든 플레이어에게 단서 지급" },
    ...characters,
  ];
  const selectedTargetId = readTargetId(delivery?.target);
  const selectedClueIds = readClueIds(delivery);

  const writeDelivery = (next: ClueGrantDelivery) => {
    onParamsChange({
      ...params,
      deliveries: [
        {
          id: next.id || delivery?.id || `grant-${crypto.randomUUID()}`,
          target: next.target,
          clue_ids: next.clue_ids ?? [],
        },
      ],
    });
  };

  const handleTargetChange = (targetId: string) => {
    writeDelivery({
      ...delivery,
      target:
        targetId === ALL_PLAYERS_TARGET_ID
          ? { type: "all_players" }
          : { type: "character", character_id: targetId },
      clue_ids: selectedClueIds,
    });
  };

  const handleClueToggle = (clueId: string) => {
    const nextClueIds = selectedClueIds.includes(clueId)
      ? selectedClueIds.filter((id) => id !== clueId)
      : [...selectedClueIds, clueId];
    writeDelivery({
      ...delivery,
      target: delivery?.target ?? { type: "all_players" },
      clue_ids: nextClueIds,
    });
  };

  return (
    <div className="grid gap-2">
      <OptionList
        title="단서 지급 대상"
        emptyText="캐릭터가 없습니다."
        items={targetOptions}
        selectedIds={selectedTargetId ? [selectedTargetId] : []}
        getMeta={() => undefined}
        onToggle={handleTargetChange}
        single
      />
      <OptionList
        title="지급할 단서"
        emptyText="단서가 없습니다."
        items={clues}
        selectedIds={selectedClueIds}
        getMeta={(clue) => clue.summary}
        onToggle={handleClueToggle}
      />
    </div>
  );
}

function readFirstDelivery(params: Record<string, unknown>): ClueGrantDelivery | undefined {
  const deliveries = params.deliveries;
  if (!Array.isArray(deliveries)) return undefined;
  const first = deliveries[0];
  return first && typeof first === "object" ? (first as ClueGrantDelivery) : undefined;
}

function readTargetId(target: ClueGrantDelivery["target"]): string {
  if (!target || typeof target !== "object") return "";
  if (target.type === "all_players") return ALL_PLAYERS_TARGET_ID;
  if (target.type !== "character") return "";
  return target.character_id || target.characterId || "";
}

function readClueIds(delivery: ClueGrantDelivery | undefined): string[] {
  if (!delivery) return [];
  const rawIds = Array.isArray(delivery.clue_ids) ? delivery.clue_ids : delivery.clueIds;
  if (!Array.isArray(rawIds)) return [];
  return rawIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}
