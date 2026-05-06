import type { Edge, Node } from "@xyflow/react";
import type { EndingVisibility, FlowNodeData } from "../../flowTypes";
import type { EditorCharacterResponse } from "../../api";

export interface EndingEditorViewModel {
  id: string;
  name: string;
  icon: string;
  description: string;
  contentPreview: string;
  visibility: EndingVisibility;
  visibilityLabel: string;
  spoilerWarning: string;
  shareText: string;
  isReady: boolean;
  badges: string[];
}

export interface EndingCharacterEndcardSummary {
  totalCount: number;
  readyCount: number;
  missingNames: string[];
}

export interface EndingDecisionSummary {
  totalCount: number;
  readyCount: number;
  connectedCount: number;
  defaultEndingName: string | null;
  warnings: string[];
}

export function toEndingEditorViewModel(node: Node, incomingCount = 0): EndingEditorViewModel {
  const data = node.data as FlowNodeData;
  const name = data.label?.trim() || "이름 없는 결말";
  const content = data.endingContent?.trim() ?? "";
  const visibility = normalizeEndingVisibility(data.endingVisibility);
  return {
    id: node.id,
    name,
    icon: data.icon?.trim() || "🎭",
    description: data.description?.trim() || "플레이어에게 보일 결말 설명을 작성해 주세요.",
    contentPreview: content || "결말 본문을 아직 작성하지 않았습니다.",
    visibility,
    visibilityLabel: endingVisibilityLabel(visibility),
    spoilerWarning: data.endingSpoilerWarning?.trim() || "스포일러 주의: 게임 종료 후 공개되는 결말입니다.",
    shareText: data.endingShareText?.trim() || "",
    isReady: Boolean(data.label?.trim() && content),
    badges: buildEndingBadges(Boolean(data.label?.trim()), Boolean(content), incomingCount, visibility),
  };
}

export function buildEndingDecisionSummary(nodes: Node[], edges: Edge[]): EndingDecisionSummary {
  const endingNodes = nodes.filter((node) => node.type === "ending");
  const endingIds = new Set(endingNodes.map((node) => node.id));
  const incomingByEnding = new Map<string, number>();
  for (const edge of edges) {
    if (endingIds.has(edge.target)) {
      incomingByEnding.set(edge.target, (incomingByEnding.get(edge.target) ?? 0) + 1);
    }
  }

  const viewModels = endingNodes.map((node) =>
    toEndingEditorViewModel(node, incomingByEnding.get(node.id) ?? 0),
  );
  const readyCount = viewModels.filter((ending) => ending.isReady).length;
  const connectedCount = endingNodes.filter((node) => (incomingByEnding.get(node.id) ?? 0) > 0).length;
  const warnings = buildEndingWarnings(viewModels, endingNodes.length, connectedCount);

  return {
    totalCount: endingNodes.length,
    readyCount,
    connectedCount,
    defaultEndingName: viewModels[0]?.name ?? null,
    warnings,
  };
}

export function buildCharacterEndcardSummary(
  characters: Pick<EditorCharacterResponse, "name" | "endcard_title" | "endcard_body" | "endcard_image_url">[],
): EndingCharacterEndcardSummary {
  const missingNames: string[] = [];
  let readyCount = 0;

  for (const character of characters) {
    const hasEndcard = Boolean(
      character.endcard_title?.trim() ||
      character.endcard_body?.trim() ||
      character.endcard_image_url?.trim(),
    );
    if (hasEndcard) readyCount += 1;
    else missingNames.push(character.name);
  }

  return {
    totalCount: characters.length,
    readyCount,
    missingNames,
  };
}

export function normalizeEndingVisibility(value: unknown): EndingVisibility {
  if (value === "players_only" || value === "private_note") return value;
  return "public";
}

export function endingVisibilityLabel(value: EndingVisibility): string {
  if (value === "players_only") return "참가자에게만 공개";
  if (value === "private_note") return "제작자 메모";
  return "전체 공개";
}

function buildEndingBadges(
  hasName: boolean,
  hasContent: boolean,
  incomingCount: number,
  visibility: EndingVisibility,
): string[] {
  return [
    hasName ? "이름 있음" : "이름 필요",
    hasContent ? "본문 작성됨" : "본문 필요",
    endingVisibilityLabel(visibility),
    incomingCount > 0 ? `도달 경로 ${incomingCount}개` : "아직 연결 없음",
  ];
}

function buildEndingWarnings(
  endings: EndingEditorViewModel[],
  totalCount: number,
  connectedCount: number,
): string[] {
  if (totalCount === 0) return ["최종 장면에서 보여줄 결말을 1개 이상 추가해 주세요."];

  const warnings: string[] = [];
  const missingContent = endings.filter((ending) => !ending.isReady).length;
  if (missingContent > 0) {
    warnings.push(`${missingContent}개 결말은 이름 또는 본문이 비어 있습니다.`);
  }
  if (connectedCount === 0) {
    warnings.push("장면 흐름에서 결말로 이어지는 경로가 아직 없습니다.");
  }
  return warnings;
}
