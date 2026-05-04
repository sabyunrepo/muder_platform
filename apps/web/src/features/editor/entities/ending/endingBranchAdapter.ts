import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "../../flowTypes";
import {
  readModuleConfig,
  writeModuleConfig,
  type EditorConfig,
} from "../../utils/configShape";

export const ENDING_BRANCH_MODULE_ID = "ending_branch";

export type EndingBranchQuestionType = "single" | "multi";
export type EndingBranchQuestionImpact = "branch" | "score";

export interface EndingBranchQuestion {
  id: string;
  text: string;
  type: EndingBranchQuestionType;
  choices: string[];
  respondents: "all" | string;
  impact: EndingBranchQuestionImpact;
  scoreMap?: Record<string, number>;
}

export interface EndingBranchMatrixRow {
  priority: number;
  ending: string;
  condition: EditorConfig;
}

export interface EndingBranchConfig {
  questions: EndingBranchQuestion[];
  matrix: EndingBranchMatrixRow[];
  defaultEnding: string;
  multiVoteThreshold?: number;
}

export interface EndingBranchQuestionDraft {
  id: string;
  label: string;
  typeLabel: string;
  choices: string[];
  impactLabel: string;
  scoreMap: Record<string, number>;
}

export interface EndingBranchMatrixDraft {
  priority: number;
  questionId: string | null;
  choice: string | null;
  endingId: string;
  endingName: string;
}

export interface EndingBranchEditorViewModel {
  questions: EndingBranchQuestionDraft[];
  matrix: EndingBranchMatrixDraft[];
  defaultEndingId: string;
  defaultEndingName: string;
  thresholdPercent: number;
  warnings: string[];
}

function isRecord(value: unknown): value is EditorConfig {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readQuestionType(value: unknown): EndingBranchQuestionType {
  return value === "multi" ? "multi" : "single";
}

function readQuestionImpact(value: unknown): EndingBranchQuestionImpact {
  return value === "score" ? "score" : "branch";
}

function readScoreMap(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizeThreshold(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : undefined;
}

function normalizeQuestion(value: unknown, index: number): EndingBranchQuestion | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" && value.id.trim() ? value.id.trim() : `question-${index + 1}`;
  const text = typeof value.text === "string" ? value.text : "";
  const choices = stringList(value.choices).filter((choice) => choice.trim());
  return {
    id,
    text,
    type: readQuestionType(value.type),
    choices,
    respondents: typeof value.respondents === "string" && value.respondents.trim()
      ? value.respondents
      : "all",
    impact: readQuestionImpact(value.impact),
    ...(readScoreMap(value.scoreMap) ? { scoreMap: readScoreMap(value.scoreMap) } : {}),
  };
}

function normalizeMatrixRow(value: unknown, index: number): EndingBranchMatrixRow | null {
  if (!isRecord(value)) return null;
  const ending = typeof value.ending === "string" ? value.ending : "";
  const condition = isRecord(value.condition) ? value.condition : {};
  const priority = typeof value.priority === "number" && Number.isFinite(value.priority)
    ? value.priority
    : index + 1;
  return { priority, ending, condition };
}

export function readEndingBranchConfig(
  configJson: EditorConfig | null | undefined,
): EndingBranchConfig {
  const moduleConfig = readModuleConfig(configJson, ENDING_BRANCH_MODULE_ID);
  const questions = Array.isArray(moduleConfig.questions)
    ? moduleConfig.questions
      .map((question, index) => normalizeQuestion(question, index))
      .filter((question): question is EndingBranchQuestion => Boolean(question))
    : [];
  const matrix = Array.isArray(moduleConfig.matrix)
    ? moduleConfig.matrix
      .map((row, index) => normalizeMatrixRow(row, index))
      .filter((row): row is EndingBranchMatrixRow => Boolean(row))
      .sort((a, b) => a.priority - b.priority)
    : [];

  return {
    questions,
    matrix,
    defaultEnding: typeof moduleConfig.defaultEnding === "string" ? moduleConfig.defaultEnding : "",
    ...(normalizeThreshold(moduleConfig.multiVoteThreshold) !== undefined
      ? { multiVoteThreshold: normalizeThreshold(moduleConfig.multiVoteThreshold) }
      : {}),
  };
}

export function writeEndingBranchConfig(
  configJson: EditorConfig | null | undefined,
  config: EndingBranchConfig,
): EditorConfig {
  return writeModuleConfig(configJson, ENDING_BRANCH_MODULE_ID, {
    questions: config.questions,
    matrix: config.matrix,
    defaultEnding: config.defaultEnding,
    ...(config.multiVoteThreshold !== undefined
      ? { multiVoteThreshold: config.multiVoteThreshold }
      : {}),
  });
}

export function createEndingBranchQuestion(index: number): EndingBranchQuestion {
  return {
    id: `ending-question-${Date.now()}-${index + 1}`,
    text: "새 결말 질문",
    type: "single",
    choices: ["선택지 1", "선택지 2"],
    respondents: "all",
    impact: "branch",
  };
}

export function createEndingBranchMatrixRow(
  config: EndingBranchConfig,
  endingId: string,
): EndingBranchMatrixRow {
  const branchQuestion = config.questions.find((question) => question.impact === "branch");
  const firstChoice = branchQuestion?.choices[0] ?? "";
  return {
    priority: config.matrix.length + 1,
    ending: endingId,
    condition: branchQuestion && firstChoice
      ? buildChoiceCondition(branchQuestion.id, firstChoice)
      : {},
  };
}

export function buildChoiceCondition(questionId: string, choice: string): EditorConfig {
  return { in: [choice, { var: `answers.${questionId}.choices` }] };
}

export function updateMatrixCondition(
  row: EndingBranchMatrixRow,
  questionId: string,
  choice: string,
): EndingBranchMatrixRow {
  return { ...row, condition: buildChoiceCondition(questionId, choice) };
}

export function readChoiceCondition(
  condition: EditorConfig,
): { questionId: string; choice: string } | null {
  const raw = condition.in;
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const [choice, source] = raw;
  if (typeof choice !== "string" || !isRecord(source) || typeof source.var !== "string") return null;
  const match = source.var.match(/^answers\.(.+)\.choices$/);
  return match ? { questionId: match[1], choice } : null;
}

function endingNameById(nodes: Node[]): Map<string, string> {
  return new Map(
    nodes
      .filter((node) => node.type === "ending")
      .map((node) => {
        const data = node.data as FlowNodeData;
        return [node.id, data.label?.trim() || "이름 없는 결말"] as const;
      }),
  );
}

function questionTypeLabel(type: EndingBranchQuestionType): string {
  return type === "multi" ? "복수 선택" : "하나 선택";
}

function impactLabel(impact: EndingBranchQuestionImpact): string {
  return impact === "score" ? "점수 계산" : "결말 분기";
}

export function toEndingBranchEditorViewModel(
  configJson: EditorConfig | null | undefined,
  endingNodes: Node[],
): EndingBranchEditorViewModel {
  const config = readEndingBranchConfig(configJson);
  const names = endingNameById(endingNodes);
  const defaultEndingId = config.defaultEnding || endingNodes[0]?.id || "";
  const defaultEndingName = names.get(defaultEndingId) ?? "아직 없음";
  const questionMap = new Map(config.questions.map((question) => [question.id, question]));

  const questions = config.questions.map((question) => ({
    id: question.id,
    label: question.text.trim() || "질문 내용 필요",
    typeLabel: questionTypeLabel(question.type),
    choices: question.choices,
    impactLabel: impactLabel(question.impact),
    scoreMap: question.scoreMap ?? {},
  }));

  const matrix = config.matrix.map((row) => {
    const parsed = readChoiceCondition(row.condition);
    const question = parsed ? questionMap.get(parsed.questionId) : null;
    const choice = parsed?.choice && question?.choices.includes(parsed.choice) ? parsed.choice : null;
    return {
      priority: row.priority,
      questionId: question?.id ?? null,
      choice,
      endingId: row.ending,
      endingName: names.get(row.ending) ?? "결말 선택 필요",
    };
  });

  return {
    questions,
    matrix,
    defaultEndingId,
    defaultEndingName,
    thresholdPercent: Math.round((config.multiVoteThreshold ?? 0.5) * 100),
    warnings: buildEndingBranchWarnings(config, endingNodes),
  };
}

function buildEndingBranchWarnings(config: EndingBranchConfig, endingNodes: Node[]): string[] {
  const warnings: string[] = [];
  const endingIds = new Set(endingNodes.filter((node) => node.type === "ending").map((node) => node.id));
  if (endingIds.size === 0) warnings.push("먼저 플레이어에게 보여줄 결말을 추가해 주세요.");
  if (config.questions.length === 0) warnings.push("결말을 가를 질문을 1개 이상 추가해 주세요.");
  if (config.matrix.length === 0) warnings.push("질문 답변이 어떤 결말로 이어지는지 규칙을 추가해 주세요.");
  if (!config.defaultEnding || !endingIds.has(config.defaultEnding)) warnings.push("기본 결말을 선택해 주세요.");
  for (const question of config.questions) {
    if (!question.text.trim()) warnings.push("내용이 비어 있는 결말 질문이 있습니다.");
    if (question.choices.length < 2) warnings.push(`'${question.text || "이름 없는 질문"}' 질문은 선택지가 2개 이상 필요합니다.`);
  }
  for (const row of config.matrix) {
    if (!endingIds.has(row.ending)) warnings.push("결말 규칙 중 도착 결말이 비어 있습니다.");
    if (!readChoiceCondition(row.condition)) warnings.push("결말 규칙 중 질문/선택지 조건이 비어 있습니다.");
  }
  return Array.from(new Set(warnings));
}
