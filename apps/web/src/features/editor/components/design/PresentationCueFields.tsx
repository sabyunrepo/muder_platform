import { Check } from "lucide-react";
import { useState } from "react";
import type { PhaseAction } from "../../flowTypes";
import type { MediaResourceUseCase } from "../../entities/mediaResource/mediaResourceAdapter";
import type { MediaType } from "../../mediaApi";
import { MediaPicker } from "../media/MediaPicker";

interface PresentationCueConfig {
  kind: "media" | "theme";
  buttonLabel: string;
  selectedLabel: string;
  dialogTitle: string;
  useCase: MediaResourceUseCase;
  filterType?: MediaType;
}

const PRESENTATION_CUE_CONFIG: Record<string, PresentationCueConfig> = {
  SET_BGM: {
    kind: "media",
    buttonLabel: "BGM 선택",
    selectedLabel: "BGM 선택됨",
    dialogTitle: "BGM 선택",
    useCase: "phase_bgm",
    filterType: "BGM",
  },
  play_bgm: {
    kind: "media",
    buttonLabel: "BGM 선택",
    selectedLabel: "BGM 선택됨",
    dialogTitle: "BGM 선택",
    useCase: "phase_bgm",
    filterType: "BGM",
  },
  PLAY_SOUND: {
    kind: "media",
    buttonLabel: "효과음 선택",
    selectedLabel: "효과음 선택됨",
    dialogTitle: "효과음 선택",
    useCase: "phase_sound_effect",
  },
  play_sound: {
    kind: "media",
    buttonLabel: "효과음 선택",
    selectedLabel: "효과음 선택됨",
    dialogTitle: "효과음 선택",
    useCase: "phase_sound_effect",
  },
  PLAY_MEDIA: {
    kind: "media",
    buttonLabel: "영상 선택",
    selectedLabel: "영상 선택됨",
    dialogTitle: "영상 선택",
    useCase: "video_action",
    filterType: "VIDEO",
  },
  play_media: {
    kind: "media",
    buttonLabel: "영상 선택",
    selectedLabel: "영상 선택됨",
    dialogTitle: "영상 선택",
    useCase: "video_action",
    filterType: "VIDEO",
  },
  SET_BACKGROUND: {
    kind: "media",
    buttonLabel: "배경 이미지 선택",
    selectedLabel: "배경 이미지 선택됨",
    dialogTitle: "배경 이미지 선택",
    useCase: "presentation_background",
    filterType: "IMAGE",
  },
  set_background: {
    kind: "media",
    buttonLabel: "배경 이미지 선택",
    selectedLabel: "배경 이미지 선택됨",
    dialogTitle: "배경 이미지 선택",
    useCase: "presentation_background",
    filterType: "IMAGE",
  },
  SET_THEME_COLOR: {
    kind: "theme",
    buttonLabel: "",
    selectedLabel: "",
    dialogTitle: "",
    useCase: "presentation_background",
  },
  set_theme_color: {
    kind: "theme",
    buttonLabel: "",
    selectedLabel: "",
    dialogTitle: "",
    useCase: "presentation_background",
  },
};

export function getPresentationCueConfig(type: string): PresentationCueConfig | null {
  return PRESENTATION_CUE_CONFIG[type] ?? null;
}

export function PresentationCueFields({
  action,
  label,
  index,
  themeId,
  onParamsChange,
}: {
  action: PhaseAction;
  label: string;
  index: number;
  themeId?: string;
  onParamsChange: (params: Record<string, unknown>) => void;
}) {
  const config = getPresentationCueConfig(action.type);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  if (!config) {
    return (
      <div className="rounded border border-amber-700/40 bg-amber-950/30 p-2 text-[11px] text-amber-200">
        지원되지 않는 연출 액션입니다. 액션 타입을 다시 선택해 주세요.
      </div>
    );
  }

  const params = action.params ?? {};
  const mediaId = typeof params.mediaId === "string" ? params.mediaId : null;

  if (config.kind === "theme") {
    const themeToken = typeof params.themeToken === "string" ? params.themeToken : "";
    return (
      <div className="rounded border border-slate-800 bg-slate-950/80 p-2">
        <span className="text-[11px] text-slate-500">화면 분위기를 선택하세요</span>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {THEME_COLOR_PRESETS.map((preset) => {
            const isSelected = themeToken === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => onParamsChange({ ...params, themeToken: preset.value })}
                aria-pressed={isSelected}
                className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] transition-colors ${
                  isSelected
                    ? "border-amber-400 bg-amber-500/10 text-amber-200"
                    : "border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
              >
                <span className={`h-3 w-3 shrink-0 rounded-full ${preset.swatchClass}`} />
                <span>{preset.label}</span>
                {isSelected ? (
                  <>
                    <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="sr-only">선택됨</span>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-slate-800 bg-slate-950/80 p-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[11px] text-slate-500">
          {mediaId ? config.selectedLabel : "재생할 미디어를 선택하세요"}
        </span>
        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          disabled={!themeId}
          className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 transition-colors hover:border-amber-500/60 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {config.buttonLabel}
        </button>
      </div>
      {!themeId ? (
        <p className="mt-1 text-[10px] text-slate-600">
          테마 화면에서 미디어를 선택할 수 있습니다.
        </p>
      ) : null}
      {themeId ? (
        <MediaPicker
          open={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          onSelect={(media) => onParamsChange({ ...params, mediaId: media.id })}
          themeId={themeId}
          filterType={config.filterType}
          useCase={config.useCase}
          selectedId={mediaId}
          title={`${label} ${index + 1} ${config.dialogTitle}`}
        />
      ) : null}
    </div>
  );
}

export const PRESENTATION_CUE_ACTION_TYPES = Object.freeze(Object.keys(PRESENTATION_CUE_CONFIG));

const THEME_COLOR_PRESETS = [
  { value: "noir", label: "누아르", swatchClass: "bg-slate-700" },
  { value: "tension", label: "긴장", swatchClass: "bg-red-500" },
  { value: "calm", label: "차분", swatchClass: "bg-cyan-500" },
  { value: "reveal", label: "폭로", swatchClass: "bg-amber-400" },
] as const;
