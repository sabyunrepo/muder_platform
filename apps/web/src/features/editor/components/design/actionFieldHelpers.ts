import type { PhaseAction } from "../../flowTypes";

export function readAllPlayerReadingSectionId(params: PhaseAction["params"]): string {
  if (!params || typeof params !== "object") return "";
  const deliveries = (params as { deliveries?: unknown }).deliveries;
  if (!Array.isArray(deliveries)) return "";
  const delivery = deliveries.find((item): item is Record<string, unknown> => {
    if (!item || typeof item !== "object") return false;
    const target = (item as { target?: unknown }).target;
    return !!target && typeof target === "object" && (target as { type?: unknown }).type === "all_players";
  });
  const ids = delivery?.reading_section_ids;
  if (!Array.isArray(ids)) return "";
  const [first] = ids;
  return typeof first === "string" ? first : "";
}

export function createAllPlayerDeliveryParams(readingSectionId: string): Record<string, unknown> {
  if (!readingSectionId) return { deliveries: [] };
  return {
    deliveries: [
      {
        id: `delivery-${readingSectionId}`,
        target: { type: "all_players" },
        reading_section_ids: [readingSectionId],
      },
    ],
  };
}
