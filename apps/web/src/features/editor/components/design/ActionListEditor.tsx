import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { PhaseAction } from "../../flowTypes";
import {
  getCreatorActionLabel,
  getVisibleCreatorActionOptions,
} from "../../entities/shared/actionAdapter";
import { MediaPicker } from "../media/MediaPicker";
import type { MediaResourceUseCase } from "../../entities/mediaResource/mediaResourceAdapter";
import type { MediaType } from "../../mediaApi";

interface ActionListEditorProps {
  label: string;
  actions: PhaseAction[];
  onChange: (actions: PhaseAction[]) => void;
  hiddenTypes?: string[];
  themeId?: string;
}

export function ActionListEditor({
  label,
  actions,
  onChange,
  hiddenTypes = [],
  themeId,
}: ActionListEditorProps) {
  const visibleActions = actions
    .map((action, index) => ({ action, index }))
    .filter(({ action }) => !hiddenTypes.includes(action.type));
  const visibleActionTypes = getVisibleCreatorActionOptions(hiddenTypes);
  const defaultActionType = visibleActionTypes[0]?.value;
  const handleAdd = () => {
    if (!defaultActionType) return;
    onChange([...actions, { id: crypto.randomUUID(), type: defaultActionType }]);
  };

  const handleRemove = (index: number) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  const handleTypeChange = (index: number, type: string) => {
    const next = actions.map((action, i) =>
      i === index ? withActionType(action, type) : action,
    );
    onChange(next);
  };

  const handleParamsChange = (index: number, params: Record<string, unknown>) => {
    onChange(actions.map((action, i) => (i === index ? { ...action, params } : action)));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-400">{label}</span>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!defaultActionType}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
        >
          <Plus className="h-3 w-3" />
          추가
        </button>
      </div>

      {visibleActions.length === 0 && (
        <p className="text-[10px] text-slate-600">트리거 실행 결과 없음</p>
      )}

      {visibleActions.map(({ action, index: idx }) => (
        <ActionRow
          key={action.id ?? idx}
          action={action}
          index={idx}
          label={label}
          visibleActionTypes={visibleActionTypes}
          onTypeChange={handleTypeChange}
          onParamsChange={handleParamsChange}
          onRemove={handleRemove}
          themeId={themeId}
        />
      ))}
    </div>
  );
}

function createDefaultParams(type: string): Record<string, unknown> | undefined {
  return getPresentationCueConfig(type) ? {} : undefined;
}

function withActionType(action: PhaseAction, type: string): PhaseAction {
  const params = createDefaultParams(type);
  const next: PhaseAction = { ...action, type };
  if (params) {
    next.params = params;
  } else {
    delete next.params;
  }
  return next;
}

interface ActionRowProps {
  action: PhaseAction;
  index: number;
  label: string;
  visibleActionTypes: ReturnType<typeof getVisibleCreatorActionOptions>;
  onTypeChange: (index: number, type: string) => void;
  onParamsChange: (index: number, params: Record<string, unknown>) => void;
  onRemove: (index: number) => void;
  themeId?: string;
}

function ActionRow({
  action,
  index,
  label,
  visibleActionTypes,
  onTypeChange,
  onParamsChange,
  onRemove,
  themeId,
}: ActionRowProps) {
  const hasCurrentOption = visibleActionTypes.some((actionType) => actionType.value === action.type);
  const fallbackLabel = getCreatorActionLabel(action.type);

  return (
    <div className="flex flex-col gap-2 rounded border border-slate-700 bg-slate-900 px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <select
          value={action.type}
          onChange={(e) => onTypeChange(index, e.target.value)}
          aria-label={`${label} ${index + 1} 실행 결과`}
          className="flex-1 bg-transparent text-xs text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-inset"
        >
          {!hasCurrentOption && <option value={action.type}>{fallbackLabel} (기존값)</option>}
          {visibleActionTypes.map((actionType) => (
            <option key={actionType.value} value={actionType.value}>
              {actionType.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label={`${label} ${index + 1} 삭제`}
          className="inline-flex h-9 w-9 items-center justify-center rounded text-slate-500 transition-colors hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <PresentationCueFields
        action={action}
        label={label}
        index={index}
        themeId={themeId}
        onParamsChange={(params) => onParamsChange(index, params)}
      />
    </div>
  );
}

interface PresentationCueConfig {
  buttonLabel: string;
  selectedLabel: string;
  dialogTitle: string;
  useCase: MediaResourceUseCase;
  filterType?: MediaType;
}

const PRESENTATION_CUE_CONFIG: Record<string, PresentationCueConfig> = {
  SET_BGM: {
    buttonLabel: "BGM 선택",
    selectedLabel: "BGM 선택됨",
    dialogTitle: "BGM 선택",
    useCase: "phase_bgm",
    filterType: "BGM",
  },
  play_bgm: {
    buttonLabel: "BGM 선택",
    selectedLabel: "BGM 선택됨",
    dialogTitle: "BGM 선택",
    useCase: "phase_bgm",
    filterType: "BGM",
  },
  PLAY_SOUND: {
    buttonLabel: "효과음 선택",
    selectedLabel: "효과음 선택됨",
    dialogTitle: "효과음 선택",
    useCase: "phase_sound_effect",
  },
  play_sound: {
    buttonLabel: "효과음 선택",
    selectedLabel: "효과음 선택됨",
    dialogTitle: "효과음 선택",
    useCase: "phase_sound_effect",
  },
  PLAY_MEDIA: {
    buttonLabel: "영상 선택",
    selectedLabel: "영상 선택됨",
    dialogTitle: "영상 선택",
    useCase: "video_action",
    filterType: "VIDEO",
  },
  play_media: {
    buttonLabel: "영상 선택",
    selectedLabel: "영상 선택됨",
    dialogTitle: "영상 선택",
    useCase: "video_action",
    filterType: "VIDEO",
  },
};

function getPresentationCueConfig(type: string): PresentationCueConfig | null {
  return PRESENTATION_CUE_CONFIG[type] ?? null;
}

function PresentationCueFields({
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
  if (!config) return null;

  const params = action.params ?? {};
  const mediaId = typeof params.mediaId === "string" ? params.mediaId : null;

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
