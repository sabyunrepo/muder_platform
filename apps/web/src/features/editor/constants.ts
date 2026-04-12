import { FileText, BookOpen, Users, Settings, Music, Code, LayoutTemplate } from "lucide-react";
import type { ThemeStatus } from "./api";

// ---------------------------------------------------------------------------
// Editor Tabs
// ---------------------------------------------------------------------------

export const EDITOR_TABS = [
  { key: "overview" as const, label: "기본정보", icon: FileText },
  { key: "story" as const, label: "스토리", icon: BookOpen },
  { key: "characters" as const, label: "등장인물", icon: Users },
  { key: "design" as const, label: "게임설계", icon: Settings },
  { key: "media" as const, label: "미디어", icon: Music },
  { key: "advanced" as const, label: "고급", icon: Code },
  { key: "template" as const, label: "템플릿", icon: LayoutTemplate },
];

export type EditorTab = (typeof EDITOR_TABS)[number]["key"];

// ---------------------------------------------------------------------------
// Theme Status
// ---------------------------------------------------------------------------

export const STATUS_LABEL: Record<ThemeStatus, string> = {
  DRAFT: "초안",
  PUBLISHED: "출판됨",
};

export const STATUS_COLOR: Record<ThemeStatus, string> = {
  DRAFT: "bg-slate-600 text-slate-200",
  PUBLISHED: "bg-emerald-600 text-emerald-100",
};

// ---------------------------------------------------------------------------
// Module Categories (29개 모듈, 6 카테고리)
// ---------------------------------------------------------------------------

export interface ModuleInfo {
  id: string;
  name: string;
  description: string;
}

export interface ModuleCategory {
  key: string;
  label: string;
  modules: ModuleInfo[];
}

export const MODULE_CATEGORIES: ModuleCategory[] = [
  {
    key: "core",
    label: "코어",
    modules: [
      { id: "connection", name: "접속 관리", description: "플레이어 접속/재접속 처리" },
      { id: "room", name: "방 관리", description: "방 생성/참가/나가기" },
      { id: "ready", name: "준비 상태", description: "게임 시작 전 레디 체크" },
      { id: "clue_interaction", name: "단서 상호작용", description: "단서 열람/공유" },
    ],
  },
  {
    key: "progression",
    label: "진행",
    modules: [
      { id: "script_progression", name: "스크립트 진행", description: "순차적 페이즈 진행" },
      { id: "hybrid_progression", name: "하이브리드 진행", description: "타이머+합의 기반 진행" },
      { id: "event_progression", name: "이벤트 진행", description: "비선형 이벤트 그래프" },
      { id: "skip_consensus", name: "스킵 합의", description: "페이즈 스킵 투표" },
      { id: "gm_control", name: "GM 제어", description: "진행자 수동 제어" },
      { id: "consensus_control", name: "합의 제어", description: "플레이어 합의 기반 제어" },
      { id: "reading", name: "리딩", description: "대사 낭독 시스템" },
      { id: "ending", name: "엔딩", description: "엔딩 분기/결과 처리" },
    ],
  },
  {
    key: "communication",
    label: "소통",
    modules: [
      { id: "text_chat", name: "텍스트 채팅", description: "전체/그룹 채팅" },
      { id: "whisper", name: "귓속말", description: "1:1 비밀 메시지" },
      { id: "group_chat", name: "그룹 채팅", description: "소그룹 채팅방" },
      { id: "voice_chat", name: "음성 채팅", description: "실시간 음성 통화" },
      { id: "spatial_voice", name: "공간 음성", description: "위치 기반 음성" },
    ],
  },
  {
    key: "decision",
    label: "결정",
    modules: [
      { id: "voting", name: "투표", description: "다수결 투표 시스템" },
      { id: "accusation", name: "고발", description: "범인 지목/변호" },
      { id: "hidden_mission", name: "히든 미션", description: "비밀 임무 시스템" },
    ],
  },
  {
    key: "exploration",
    label: "탐색",
    modules: [
      { id: "floor_exploration", name: "층 탐색", description: "건물 층별 탐색" },
      { id: "room_exploration", name: "방 탐색", description: "방별 탐색" },
      { id: "timed_exploration", name: "시간 제한 탐색", description: "제한 시간 내 탐색" },
      { id: "location_clue", name: "장소 단서", description: "위치 기반 단서 발견" },
    ],
  },
  {
    key: "clue_distribution",
    label: "단서 배포",
    modules: [
      { id: "conditional_clue", name: "조건부 단서", description: "조건 충족 시 단서 제공" },
      { id: "starting_clue", name: "시작 단서", description: "게임 시작 시 배포" },
      { id: "round_clue", name: "라운드 단서", description: "라운드별 단서 배포" },
      { id: "timed_clue", name: "시간 단서", description: "시간 경과 시 배포" },
      { id: "trade_clue", name: "단서 교환", description: "플레이어 간 단서 교환" },
    ],
  },
];
