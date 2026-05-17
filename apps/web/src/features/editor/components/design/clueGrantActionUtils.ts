interface ClueGrantDelivery {
  target?: {
    type?: string;
    character_id?: string;
    characterId?: string;
  };
  clue_ids?: string[];
  clueIds?: string[];
}

export function hasCompleteClueGrantParams(params: Record<string, unknown> | undefined): boolean {
  const delivery = readFirstDelivery(params ?? {});
  if (!delivery) return false;
  if (!hasCompleteTarget(delivery.target)) return false;
  return readClueIds(delivery).length > 0;
}

function readFirstDelivery(params: Record<string, unknown>): ClueGrantDelivery | undefined {
  const deliveries = params.deliveries;
  if (!Array.isArray(deliveries)) return undefined;
  const first = deliveries[0];
  return first && typeof first === "object" ? (first as ClueGrantDelivery) : undefined;
}

function hasCompleteTarget(target: ClueGrantDelivery["target"]): boolean {
  if (!target || typeof target !== "object") return false;
  if (target.type === "all_players") return true;
  return target.type === "character" && Boolean(target.character_id || target.characterId);
}

function readClueIds(delivery: ClueGrantDelivery | undefined): string[] {
  if (!delivery) return [];
  const rawIds = Array.isArray(delivery.clue_ids) ? delivery.clue_ids : delivery.clueIds;
  if (!Array.isArray(rawIds)) return [];
  return rawIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}
