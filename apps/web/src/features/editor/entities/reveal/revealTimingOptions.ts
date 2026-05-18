import type { FlowNodeResponse } from "../../flowTypes";

export interface RoundRevealOption {
  value: number;
  label: string;
}

export interface ProgressNodeRevealOption {
  value: string;
  label: string;
}

export type ProgressNodeRevealScope = "progress" | "phase" | "investigation_phase";

interface ProgressNodeRevealOptionsConfig {
  scope?: ProgressNodeRevealScope;
}

const FALLBACK_ROUND_COUNT = 5;

const FLOW_NODE_TYPE_LABELS: Record<FlowNodeResponse["type"], string> = {
  start: "시작",
  phase: "장면",
  branch: "분기",
  ending: "결말",
};

export function buildRoundRevealOptions(
  nodes: FlowNodeResponse[] | undefined,
  currentValues: Array<number | null | undefined> = [],
): RoundRevealOption[] {
  const configuredMaxRound = Math.max(
    0,
    ...(nodes ?? [])
      .map((node) => node.data.rounds)
      .filter((rounds): rounds is number => Number.isFinite(rounds) && rounds > 0)
      .map((rounds) => Math.trunc(rounds)),
  );
  const currentMaxRound = Math.max(
    0,
    ...currentValues
      .filter((round): round is number => Number.isFinite(round) && round > 0)
      .map((round) => Math.trunc(round)),
  );
  const maxRound = Math.max(configuredMaxRound || FALLBACK_ROUND_COUNT, currentMaxRound);

  return Array.from({ length: maxRound }, (_, index) => {
    const round = index + 1;
    return { value: round, label: `${round}라운드` };
  });
}

export function buildProgressNodeRevealOptions(
  nodes: FlowNodeResponse[] | undefined,
  currentValues: Array<string | null | undefined> = [],
  config: ProgressNodeRevealOptionsConfig = {},
): ProgressNodeRevealOption[] {
  const scope = config.scope ?? "progress";
  const options = (nodes ?? [])
    .filter((node) => isNodeInRevealScope(node, scope))
    .map((node, index) => ({
      value: node.id,
      label: formatFlowNodeLabel(node, index),
    }));

  const knownIds = new Set(options.map((option) => option.value));
  const legacyOptions = currentValues
    .map((value) => value?.trim())
    .filter((value): value is string => !!value && !knownIds.has(value))
    .map((value) => ({ value, label: `기존 저장값 (${value})` }));

  return [...options, ...legacyOptions];
}

function isNodeInRevealScope(node: FlowNodeResponse, scope: ProgressNodeRevealScope): boolean {
  if (scope === "progress") return node.type !== "start" && node.type !== "branch";
  if (node.type !== "phase") return false;
  if (scope === "phase") return true;
  return !node.data.phase_type || node.data.phase_type === "investigation";
}

function formatFlowNodeLabel(node: FlowNodeResponse, index: number): string {
  const label = node.data.label?.trim();
  if (label) return `${label} (${FLOW_NODE_TYPE_LABELS[node.type]})`;
  return `${FLOW_NODE_TYPE_LABELS[node.type]} ${index + 1}`;
}
