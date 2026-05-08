import type { FlowNodeData, PhaseAction } from "../../flowTypes";
import {
  DELIVER_INFORMATION_ACTION,
  GRANT_CLUE_ACTION,
  isClueGrantAction,
  isInformationDeliveryAction,
} from "./actionAdapter";
import type { InformationRecipientType } from "./informationDeliveryAdapter";

export interface SceneEntryEffectViewModel {
  id: string;
  recipientType: InformationRecipientType;
  characterId?: string;
  storyInfoIds: string[];
  clueIds: string[];
}

interface StoredEffectDelivery {
  id?: string;
  target?: {
    type?: unknown;
    character_id?: unknown;
  };
  recipient_type?: unknown;
  character_id?: unknown;
  reading_section_ids?: unknown;
  story_info_ids?: unknown;
  storyInfoIds?: unknown;
  clue_ids?: unknown;
  clueIds?: unknown;
}

interface DeliveryParams {
  deliveries?: unknown;
}

export { DELIVER_INFORMATION_ACTION, GRANT_CLUE_ACTION };

export function flowNodeToSceneEntryEffects(data: FlowNodeData): SceneEntryEffectViewModel[] {
  const merged = new Map<string, SceneEntryEffectViewModel>();
  for (const action of (data.onEnter ?? []).filter(isInformationDeliveryAction)) {
    for (const delivery of readDeliveries(action.params)) {
      mergeEffect(merged, normalizeStoredDelivery(delivery, "story"));
    }
  }
  for (const action of (data.onEnter ?? []).filter(isClueGrantAction)) {
    for (const delivery of readDeliveries(action.params)) {
      mergeEffect(merged, normalizeStoredDelivery(delivery, "clue"));
    }
  }
  return Array.from(merged.values()).map(normalizeViewModel).filter(hasAnyEffect);
}

export function sceneEntryEffectsToFlowNodePatch(
  data: FlowNodeData,
  effects: SceneEntryEffectViewModel[],
): Pick<FlowNodeData, "onEnter"> {
  const nextActions = (data.onEnter ?? []).filter(
    (action) => !isInformationDeliveryAction(action) && !isClueGrantAction(action),
  );
  const normalized = effects.map(normalizeViewModel).filter(isCompleteSceneEntryEffect);
  const infoDeliveries = normalized.filter((effect) => effect.storyInfoIds.length > 0);
  const clueDeliveries = normalized.filter((effect) => effect.clueIds.length > 0);

  if (infoDeliveries.length > 0) {
    nextActions.push({
      id: findAction(data.onEnter ?? [], isInformationDeliveryAction)?.id ?? makeId(),
      type: DELIVER_INFORMATION_ACTION,
      params: {
        deliveries: infoDeliveries.map((effect) => ({
          id: effect.id,
          target: toStoredTarget(effect),
          reading_section_ids: findExistingReadingSectionIds(data.onEnter ?? [], effect),
          story_info_ids: effect.storyInfoIds,
        })),
      },
    });
  }

  if (clueDeliveries.length > 0) {
    nextActions.push({
      id: findAction(data.onEnter ?? [], isClueGrantAction)?.id ?? makeId(),
      type: GRANT_CLUE_ACTION,
      params: {
        deliveries: clueDeliveries.map((effect) => ({
          id: effect.id,
          target: toStoredTarget(effect),
          clue_ids: effect.clueIds,
        })),
      },
    });
  }

  return { onEnter: nextActions };
}

export function makeEmptySceneEntryEffect(
  recipientType: InformationRecipientType = "character",
): SceneEntryEffectViewModel {
  return {
    id: makeId(),
    recipientType,
    storyInfoIds: [],
    clueIds: [],
  };
}

export function isCompleteSceneEntryEffect(effect: SceneEntryEffectViewModel): boolean {
  if (!hasAnyEffect(effect)) return false;
  return effect.recipientType === "all_players" || Boolean(effect.characterId);
}

function findAction(
  actions: PhaseAction[],
  predicate: (action: PhaseAction) => boolean,
): PhaseAction | undefined {
  return actions.find(predicate);
}

function readDeliveries(params: PhaseAction["params"]): StoredEffectDelivery[] {
  if (!params || typeof params !== "object") return [];
  const maybeDeliveries = (params as DeliveryParams).deliveries;
  return Array.isArray(maybeDeliveries) ? (maybeDeliveries as StoredEffectDelivery[]) : [];
}

function findExistingReadingSectionIds(
  actions: PhaseAction[],
  effect: SceneEntryEffectViewModel,
): string[] {
  const matchingDeliveries = actions
    .filter(isInformationDeliveryAction)
    .flatMap((action) => readDeliveries(action.params))
    .filter((delivery) => isSameStoredDelivery(delivery, effect));

  return uniqueStrings(
    matchingDeliveries.flatMap((delivery) =>
      Array.isArray(delivery.reading_section_ids)
        ? delivery.reading_section_ids.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [],
    ),
  );
}

function isSameStoredDelivery(
  delivery: StoredEffectDelivery,
  effect: SceneEntryEffectViewModel,
): boolean {
  if (delivery.id === effect.id) return true;
  const deliveryType =
    delivery.target?.type === "all_players" || delivery.recipient_type === "all_players"
      ? "all_players"
      : "character";
  if (deliveryType !== effect.recipientType) return false;
  if (effect.recipientType === "all_players") return true;
  const deliveryCharacterId =
    typeof delivery.target?.character_id === "string"
      ? delivery.target.character_id
      : typeof delivery.character_id === "string"
        ? delivery.character_id
        : undefined;
  return Boolean(effect.characterId) && deliveryCharacterId === effect.characterId;
}

function normalizeStoredDelivery(
  delivery: StoredEffectDelivery,
  source: "story" | "clue",
): SceneEntryEffectViewModel {
  const rawStoryInfoIds =
    source === "story"
      ? Array.isArray(delivery.story_info_ids)
        ? delivery.story_info_ids
        : Array.isArray(delivery.storyInfoIds)
          ? delivery.storyInfoIds
          : []
      : [];
  const rawClueIds =
    source === "clue"
      ? Array.isArray(delivery.clue_ids)
        ? delivery.clue_ids
        : Array.isArray(delivery.clueIds)
          ? delivery.clueIds
          : []
      : [];
  return normalizeViewModel({
    id: typeof delivery.id === "string" && delivery.id ? delivery.id : makeId(),
    recipientType:
      delivery.target?.type === "all_players" || delivery.recipient_type === "all_players"
        ? "all_players"
        : "character",
    characterId:
      typeof delivery.target?.character_id === "string"
        ? delivery.target.character_id
        : typeof delivery.character_id === "string"
          ? delivery.character_id
          : undefined,
    storyInfoIds: rawStoryInfoIds.filter((id): id is string => typeof id === "string" && id.length > 0),
    clueIds: rawClueIds.filter((id): id is string => typeof id === "string" && id.length > 0),
  });
}

function mergeEffect(
  merged: Map<string, SceneEntryEffectViewModel>,
  effect: SceneEntryEffectViewModel,
) {
  const key = effect.recipientType === "all_players" ? "all_players" : `character:${effect.characterId ?? effect.id}`;
  const current = merged.get(key);
  if (!current) {
    merged.set(key, effect);
    return;
  }
  merged.set(key, normalizeViewModel({
    ...current,
    storyInfoIds: [...current.storyInfoIds, ...effect.storyInfoIds],
    clueIds: [...current.clueIds, ...effect.clueIds],
  }));
}

function normalizeViewModel(effect: SceneEntryEffectViewModel): SceneEntryEffectViewModel {
  const storyInfoIds = uniqueStrings(effect.storyInfoIds);
  const clueIds = uniqueStrings(effect.clueIds);
  if (effect.recipientType === "all_players") {
    return { id: effect.id || makeId(), recipientType: "all_players", storyInfoIds, clueIds };
  }
  return {
    id: effect.id || makeId(),
    recipientType: "character",
    characterId: effect.characterId,
    storyInfoIds,
    clueIds,
  };
}

function hasAnyEffect(effect: SceneEntryEffectViewModel): boolean {
  return effect.storyInfoIds.length > 0 || effect.clueIds.length > 0;
}

function toStoredTarget(effect: SceneEntryEffectViewModel) {
  return effect.recipientType === "all_players"
    ? { type: "all_players" }
    : { type: "character", character_id: effect.characterId };
}

function uniqueStrings(ids: string[]): string[] {
  return Array.from(new Set(ids)).filter(Boolean);
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `effect-${Math.random().toString(36).slice(2)}`;
}
