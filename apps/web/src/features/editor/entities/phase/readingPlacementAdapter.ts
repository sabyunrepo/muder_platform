import type { FlowNodeData } from "../../flowTypes";
import {
  flowNodeToInformationDeliveries,
  informationDeliveriesToFlowNodePatch,
  type InformationDeliveryViewModel,
} from "../shared/informationDeliveryAdapter";

export interface ReadingPlacementViewModel {
  readingSectionIds: string[];
}

export function flowNodeToReadingPlacement(data: FlowNodeData): ReadingPlacementViewModel {
  return {
    readingSectionIds: unique(
      flowNodeToInformationDeliveries(data).flatMap((delivery) => delivery.readingSectionIds),
    ),
  };
}

export function readingPlacementToFlowNodePatch(
  data: FlowNodeData,
  readingSectionIds: string[],
): Pick<FlowNodeData, "onEnter"> {
  const storyInfoDeliveries = flowNodeToInformationDeliveries(data)
    .map((delivery): InformationDeliveryViewModel => ({
      ...delivery,
      readingSectionIds: [],
    }))
    .filter((delivery) => delivery.storyInfoIds.length > 0);
  const normalizedReadingSectionIds = unique(readingSectionIds);

  if (normalizedReadingSectionIds.length === 0) {
    return informationDeliveriesToFlowNodePatch(data, storyInfoDeliveries);
  }

  return informationDeliveriesToFlowNodePatch(data, [
    ...storyInfoDeliveries,
    {
      id: findExistingReadingDeliveryId(data) ?? "reading-placement",
      recipientType: "all_players",
      readingSectionIds: normalizedReadingSectionIds,
      storyInfoIds: [],
    },
  ]);
}

function findExistingReadingDeliveryId(data: FlowNodeData): string | undefined {
  return flowNodeToInformationDeliveries(data).find(
    (delivery) => delivery.readingSectionIds.length > 0,
  )?.id;
}

function unique(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}
