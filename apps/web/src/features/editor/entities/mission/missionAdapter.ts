import type { EditorConfig } from "../../utils/configShape";

export const HIDDEN_MISSION_MODULE_ID = "hidden_mission";
export const LEGACY_CHARACTER_MISSIONS_KEY = "character_missions";

export type MissionCreatorType = "kill" | "possess" | "secret" | "protect";
export type MissionRuntimeType = "hold_clue" | "vote_target" | "transfer_clue" | "survive" | "custom";
export type MissionVerification = "auto" | "self_report" | "gm_verify";
export type MissionResultVisibility = "result_only";
export type MissionRuntimeOwner = "backend_engine";

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
  targetCharacterId?: string;
  targetClueId?: string;
  condition?: string;
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

const VERIFICATION_LABELS: Record<MissionVerification, string> = {
  auto: "자동 판정",
  self_report: "플레이어 신고",
  gm_verify: "진행자 확인",
};

function isRecord(value: unknown): value is EditorConfig {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isMissionVerification(value: unknown): value is MissionVerification {
  return value === "auto" || value === "self_report" || value === "gm_verify";
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
  };
}

export function createMissionDraft(): Mission {
  return {
    id: crypto.randomUUID(),
    type: "secret",
    description: "",
    points: 0,
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
  return {
    id: mission.id,
    type: runtimeType,
    description: mission.description.trim(),
    points: Math.max(0, Math.trunc(mission.points || 0)),
    verification: isMissionVerification(mission.verification)
      ? mission.verification
      : defaultVerification(runtimeType),
    resultVisibility: "result_only",
    engineOwner: "backend_engine",
    ...(mission.targetCharacterId ? { targetCharacterId: mission.targetCharacterId } : {}),
    ...(mission.targetClueId ? { targetClueId: mission.targetClueId } : {}),
    ...(mission.condition ? { condition: mission.condition } : {}),
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
        manualReviewCount: runtimeMissions.filter((mission) => mission.verification !== "auto").length,
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
    verificationLabel: VERIFICATION_LABELS[runtimeDraft.verification],
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

function defaultVerification(runtimeType: MissionRuntimeType): MissionVerification {
  return runtimeType === "custom" ? "self_report" : "auto";
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
    warnings.push("이 미션은 자동 판정 대신 플레이어 신고 또는 진행자 확인으로 처리됩니다.");
  }
  return warnings;
}
