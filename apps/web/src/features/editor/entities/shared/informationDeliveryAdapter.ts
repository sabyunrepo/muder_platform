import type { FlowNodeData, PhaseAction } from "../../flowTypes";
import {
  DELIVER_INFORMATION_ACTION,
  LEGACY_DELIVER_INFORMATION_ACTION,
  isInformationDeliveryAction,
} from "./actionAdapter";

export type InformationRecipientType = "character" | "all_players";

export interface InformationDeliveryViewModel {
  id: string;
  recipientType: InformationRecipientType;
  characterId?: string;
  readingSectionIds: string[];
  storyInfoIds: string[];
}

interface StoredInformationDelivery {
  id?: string;
  target?: {
    type?: unknown;
    character_id?: unknown;
  };
  recipient_type?: unknown;
  character_id?: unknown;
  reading_section_ids?: unknown;
  readingSectionIds?: unknown;
  story_info_ids?: unknown;
  storyInfoIds?: unknown;
}

interface DeliverInformationParams {
  deliveries?: unknown;
}

export { DELIVER_INFORMATION_ACTION, LEGACY_DELIVER_INFORMATION_ACTION, isInformationDeliveryAction };

export function flowNodeToInformationDeliveries(
  data: FlowNodeData,
): InformationDeliveryViewModel[] {
  const action = findDeliverInformationAction(data.onEnter ?? []);
  const deliveries = readDeliveries(action?.params);
  return deliveries.map(normalizeDelivery);
}

export function informationDeliveriesToFlowNodePatch(
  data: FlowNodeData,
  deliveries: InformationDeliveryViewModel[],
): Pick<FlowNodeData, "onEnter"> {
  const nextActions = withoutDeliverInformationActions(data.onEnter ?? []);
  const normalized = deliveries
    .map(normalizeViewModel)
    .filter(isCompleteInformationDelivery);

  if (normalized.length === 0) {
    return { onEnter: nextActions };
  }

  return {
    onEnter: [
      ...nextActions,
      {
        id: findDeliverInformationAction(data.onEnter ?? [])?.id ?? makeId(),
        type: DELIVER_INFORMATION_ACTION,
        params: {
          deliveries: normalized.map(toStoredDelivery),
        },
      },
    ],
  };
}

export function makeEmptyInformationDelivery(
  recipientType: InformationRecipientType = "character",
): InformationDeliveryViewModel {
  return {
    id: makeId(),
    recipientType,
    readingSectionIds: [],
    storyInfoIds: [],
  };
}

export function isCompleteInformationDelivery(delivery: InformationDeliveryViewModel): boolean {
  if (delivery.readingSectionIds.length === 0 && delivery.storyInfoIds.length === 0) return false;
  return delivery.recipientType === "all_players" || Boolean(delivery.characterId);
}

function findDeliverInformationAction(actions: PhaseAction[]): PhaseAction | undefined {
  return actions.find(isInformationDeliveryAction);
}

function withoutDeliverInformationActions(actions: PhaseAction[]): PhaseAction[] {
  return actions.filter((action) => !isInformationDeliveryAction(action));
}

function readDeliveries(params: PhaseAction["params"]): StoredInformationDelivery[] {
  if (!params || typeof params !== "object") return [];
  const maybeDeliveries = (params as DeliverInformationParams).deliveries;
  return Array.isArray(maybeDeliveries)
    ? (maybeDeliveries as StoredInformationDelivery[])
    : [];
}

function normalizeDelivery(
  delivery: StoredInformationDelivery,
): InformationDeliveryViewModel {
  const targetType =
    delivery.target?.type === "all_players" || delivery.recipient_type === "all_players"
      ? "all_players"
      : "character";
  const rawSectionIds = Array.isArray(delivery.reading_section_ids)
    ? delivery.reading_section_ids
    : Array.isArray(delivery.readingSectionIds)
      ? delivery.readingSectionIds
      : [];
  const rawStoryInfoIds = Array.isArray(delivery.story_info_ids)
    ? delivery.story_info_ids
    : Array.isArray(delivery.storyInfoIds)
      ? delivery.storyInfoIds
      : [];

  return normalizeViewModel({
    id: typeof delivery.id === "string" && delivery.id ? delivery.id : makeId(),
    recipientType: targetType,
    characterId:
      typeof delivery.target?.character_id === "string"
        ? delivery.target.character_id
        : typeof delivery.character_id === "string"
          ? delivery.character_id
          : undefined,
    readingSectionIds: rawSectionIds.filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    ),
    storyInfoIds: rawStoryInfoIds.filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    ),
  });
}

function normalizeViewModel(
  delivery: InformationDeliveryViewModel,
): InformationDeliveryViewModel {
  const uniqueSectionIds = Array.from(new Set(delivery.readingSectionIds)).filter(Boolean);
  const uniqueStoryInfoIds = Array.from(new Set(delivery.storyInfoIds)).filter(Boolean);
  if (delivery.recipientType === "all_players") {
    return {
      id: delivery.id || makeId(),
      recipientType: "all_players",
      readingSectionIds: uniqueSectionIds,
      storyInfoIds: uniqueStoryInfoIds,
    };
  }
  return {
    id: delivery.id || makeId(),
    recipientType: "character",
    characterId: delivery.characterId,
    readingSectionIds: uniqueSectionIds,
    storyInfoIds: uniqueStoryInfoIds,
  };
}

function toStoredDelivery(delivery: InformationDeliveryViewModel) {
  return {
    id: delivery.id,
    target:
      delivery.recipientType === "all_players"
        ? { type: "all_players" }
        : { type: "character", character_id: delivery.characterId },
    reading_section_ids: delivery.readingSectionIds,
    story_info_ids: delivery.storyInfoIds,
  };
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `delivery-${Math.random().toString(36).slice(2)}`;
}
