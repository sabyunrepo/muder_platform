import type { EditorConfig } from "../../utils/configShape";

export const HIDDEN_MISSION_MODULE_ID = "hidden_mission";
export const LEGACY_CHARACTER_MISSIONS_KEY = "character_missions";

export type MissionCreatorType = "kill" | "possess" | "secret" | "protect";
export type MissionRuntimeType = "hold_clue" | "vote_target" | "transfer_clue" | "survive" | "custom";
export type MissionVerification = "auto" | "self_report" | "gm_verify";
export type MissionResultVisibility = "result_only";
export type MissionRuntimeOwner = "backend_engine";
export type MissionRevealTiming =
  | "game_start"
  | "intro_start"
  | "intro_end"
  | "round_start"
  | "node_reached";

export interface Mission {
  id: string;
  type: MissionCreatorType | string;
  description: string;
  points: number;
  targetCharacterId?: string;
  targetClueId?: string;
  condition?: string;
  quantity?: number;
  secretContent?: string;
  penalty?: number;
  difficulty?: number;
  verification?: MissionVerification;
  visibleFrom?: MissionRevealTiming;
  revealRound?: number;
  revealNodeId?: string;
}

export interface MissionEditorCharacter {
  id: string;
  name: string;
}

export interface MissionEditorClue {
  id: string;
  name: string;
}

export interface MissionViewModel {
  id: string;
  title: string;
  typeLabel: string;
  pointsLabel: string;
  resultVisibilityLabel: string;
  runtimeType: MissionRuntimeType;
  verification: MissionVerification;
  verificationLabel: string;
  revealLabel: string;
  engineOwnerLabel: string;
  warnings: string[];
}

export interface MissionRuntimeDraft {
  id: string;
  type: MissionRuntimeType;
  description: string;
  points: number;
  verification: MissionVerification;
  resultVisibility: MissionResultVisibility;
  engineOwner: MissionRuntimeOwner;
  visibleFrom: MissionRevealTiming;
  revealRound?: number;
  revealNodeId?: string;
  targetCharacterId?: string;
  targetClueId?: string;
  legacyConditionNote?: string;
}

export interface MissionEngineAssignmentDraft {
  characterId: string;
  missions: MissionRuntimeDraft[];
  totalPoints: number;
  autoVerifiableCount: number;
  manualReviewCount: number;
}

export interface MissionEngineContractDraft {
  moduleId: typeof HIDDEN_MISSION_MODULE_ID;
  resultVisibility: MissionResultVisibility;
  engineOwner: MissionRuntimeOwner;
  assignments: MissionEngineAssignmentDraft[];
}

export const MISSION_TYPES: Array<{ value: MissionCreatorType; label: string }> = [
  { value: "kill", label: "살해" },
  { value: "possess", label: "보유" },
  { value: "secret", label: "비밀" },
  { value: "protect", label: "보호" },
];

const MISSION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  MISSION_TYPES.map((type) => [type.value, type.label]),
);

export const MISSION_REVEAL_OPTIONS: Array<{ value: MissionRevealTiming; label: string }> = [
  { value: "game_start", label: "게임 시작부터" },
  { value: "intro_start", label: "자기소개 시작부터" },
  { value: "intro_end", label: "자기소개 종료 후" },
  { value: "round_start", label: "특정 라운드 시작부터" },
  { value: "node_reached", label: "특정 진행 노드 도달 후" },
];

const REVEAL_LABELS: Record<MissionRevealTiming, string> = Object.fromEntries(
  MISSION_REVEAL_OPTIONS.map((option) => [option.value, option.label]),
) as Record<MissionRevealTiming, string>;

function isRecord(value: unknown): value is EditorConfig {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isMissionVerification(value: unknown): value is MissionVerification {
  return value === "auto" || value === "self_report" || value === "gm_verify";
}

function isMissionRevealTiming(value: unknown): value is MissionRevealTiming {
  return (
    value === "game_start" ||
    value === "intro_start" ||
    value === "intro_end" ||
    value === "round_start" ||
    value === "node_reached"
  );
}

function normalizeMission(value: unknown, index: number): Mission | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" && value.id.trim() ? value.id : `mission-${index + 1}`;
  const type = typeof value.type === "string" && value.type.trim() ? value.type : "secret";
  const description = typeof value.description === "string" ? value.description : "";
  const points = typeof value.points === "number" && Number.isFinite(value.points) ? value.points : 0;
  return {
    id,
    type,
    description,
    points,
    ...(typeof value.targetCharacterId === "string" ? { targetCharacterId: value.targetCharacterId } : {}),
    ...(typeof value.targetClueId === "string" ? { targetClueId: value.targetClueId } : {}),
    ...(typeof value.condition === "string" ? { condition: value.condition } : {}),
    ...(typeof value.quantity === "number" ? { quantity: value.quantity } : {}),
    ...(typeof value.secretContent === "string" ? { secretContent: value.secretContent } : {}),
    ...(typeof value.penalty === "number" ? { penalty: value.penalty } : {}),
    ...(typeof value.difficulty === "number" ? { difficulty: value.difficulty } : {}),
    ...(isMissionVerification(value.verification) ? { verification: value.verification } : {}),
    visibleFrom: isMissionRevealTiming(value.visibleFrom) ? value.visibleFrom : "game_start",
    ...(typeof value.revealRound === "number" && Number.isFinite(value.revealRound)
      ? { revealRound: Math.max(1, Math.trunc(value.revealRound)) }
      : {}),
    ...(typeof value.revealNodeId === "string" ? { revealNodeId: value.revealNodeId } : {}),
  };
}

export function createMissionDraft(): Mission {
  return {
    id: crypto.randomUUID(),
    type: "secret",
    description: "",
    points: 0,
    verification: "auto",
    visibleFrom: "game_start",
  };
}

export function readCharacterMissionMap(
  configJson: EditorConfig | null | undefined,
): Record<string, Mission[]> {
  const source = configJson?.[LEGACY_CHARACTER_MISSIONS_KEY];
  if (!isRecord(source)) return {};
  return Object.fromEntries(
    Object.entries(source).map(([characterId, missions]) => [
      characterId,
      Array.isArray(missions)
        ? missions.map(normalizeMission).filter((mission): mission is Mission => !!mission)
        : [],
    ]),
  );
}

export function writeCharacterMissionMap(
  configJson: EditorConfig | null | undefined,
  missionsByCharacter: Record<string, Mission[]>,
): EditorConfig {
  return { ...(configJson ?? {}), [LEGACY_CHARACTER_MISSIONS_KEY]: missionsByCharacter };
}

export function getMissionTypeLabel(type: string): string {
  return MISSION_TYPE_LABELS[type] ?? "직접 설정";
}

export function toMissionRuntimeDraft(mission: Mission): MissionRuntimeDraft {
  const runtimeType = toRuntimeType(mission);
  const legacyConditionNote = mission.condition?.trim();
  const visibleFrom = normalizeRevealTiming(mission.visibleFrom);
  return {
    id: mission.id,
    type: runtimeType,
    description: mission.description.trim(),
    points: Math.max(0, Math.trunc(mission.points || 0)),
    verification: "auto",
    resultVisibility: "result_only",
    engineOwner: "backend_engine",
    visibleFrom,
    ...(visibleFrom === "round_start" && typeof mission.revealRound === "number"
      ? { revealRound: Math.max(1, Math.trunc(mission.revealRound)) }
      : {}),
    ...(visibleFrom === "node_reached" && mission.revealNodeId?.trim()
      ? { revealNodeId: mission.revealNodeId.trim() }
      : {}),
    ...(mission.targetCharacterId ? { targetCharacterId: mission.targetCharacterId } : {}),
    ...(mission.targetClueId ? { targetClueId: mission.targetClueId } : {}),
    ...(legacyConditionNote ? { legacyConditionNote } : {}),
  };
}

export function toMissionEngineContractDraft(
  missionsByCharacter: Record<string, Mission[]>,
): MissionEngineContractDraft {
  const assignments = Object.entries(missionsByCharacter)
    .map(([characterId, missions]) => {
      const runtimeMissions = missions.map(toMissionRuntimeDraft);
      return {
        characterId,
        missions: runtimeMissions,
        totalPoints: runtimeMissions.reduce((sum, mission) => sum + mission.points, 0),
        autoVerifiableCount: runtimeMissions.filter((mission) => mission.verification === "auto").length,
        manualReviewCount: 0,
      };
    })
    .filter((assignment) => assignment.missions.length > 0);

  return {
    moduleId: HIDDEN_MISSION_MODULE_ID,
    resultVisibility: "result_only",
    engineOwner: "backend_engine",
    assignments,
  };
}

export function toMissionViewModel(mission: Mission): MissionViewModel {
  const runtimeDraft = toMissionRuntimeDraft(mission);
  const warnings = buildMissionWarnings(mission, runtimeDraft);
  return {
    id: mission.id,
    title: mission.description.trim() || "미션 내용을 입력해 주세요",
    typeLabel: getMissionTypeLabel(mission.type),
    pointsLabel: runtimeDraft.points > 0 ? `${runtimeDraft.points}점` : "점수 없음",
    resultVisibilityLabel: "결과 화면에서만 공개",
    runtimeType: runtimeDraft.type,
    verification: runtimeDraft.verification,
    verificationLabel: "자동 판정",
    revealLabel: formatRevealLabel(runtimeDraft),
    engineOwnerLabel: "게임 판정은 백엔드가 담당",
    warnings,
  };
}

function toRuntimeType(mission: Mission): MissionRuntimeType {
  if (mission.type === "possess") return "hold_clue";
  if (mission.type === "kill") return "vote_target";
  if (mission.type === "protect") return mission.targetClueId ? "hold_clue" : "custom";
  return "custom";
}

function normalizeRevealTiming(value: unknown): MissionRevealTiming {
  return isMissionRevealTiming(value) ? value : "game_start";
}

function formatRevealLabel(mission: MissionRuntimeDraft): string {
  if (mission.visibleFrom === "round_start" && mission.revealRound) {
    return `${mission.revealRound}라운드 시작부터`;
  }
  if (mission.visibleFrom === "node_reached" && mission.revealNodeId) {
    return `진행 노드 ${mission.revealNodeId} 도달 후`;
  }
  return REVEAL_LABELS[mission.visibleFrom];
}

function buildMissionWarnings(mission: Mission, runtimeDraft: MissionRuntimeDraft): string[] {
  const warnings: string[] = [];
  if (!mission.description.trim()) warnings.push("플레이어가 이해할 미션 내용을 입력해 주세요.");
  if (runtimeDraft.type === "hold_clue" && !runtimeDraft.targetClueId) {
    warnings.push("보유 미션은 대상 단서를 선택해야 자동 판정할 수 있습니다.");
  }
  if (runtimeDraft.type === "vote_target" && !runtimeDraft.targetCharacterId) {
    warnings.push("투표형 미션은 대상 캐릭터를 선택해야 자동 판정할 수 있습니다.");
  }
  if (runtimeDraft.type === "custom") {
    warnings.push("직접 작성 미션은 자동 판정 조건이 아직 없으므로 결과 판정 엔진 확장이 필요합니다.");
  }
  if (runtimeDraft.visibleFrom === "round_start" && !runtimeDraft.revealRound) {
    warnings.push("라운드 공개 시점은 시작 라운드를 입력해야 합니다.");
  }
  if (runtimeDraft.visibleFrom === "node_reached" && !runtimeDraft.revealNodeId) {
    warnings.push("진행 노드 공개 시점은 노드 식별자를 입력해야 합니다.");
  }
  if (mission.condition?.trim()) {
    warnings.push("미션 조건 메모는 제작자 참고용이며, 실제 진행 분기는 스토리 이동 조건에서 판정됩니다.");
  }
  return warnings;
}
