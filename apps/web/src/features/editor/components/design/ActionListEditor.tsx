import { Plus, Trash2 } from "lucide-react";
import type { PhaseAction } from "../../flowTypes";
import {
  DELIVER_INFORMATION_ACTION,
  getCreatorActionLabel,
  getVisibleCreatorActionOptions,
  isInformationDeliveryAction,
} from "../../entities/shared/actionAdapter";
import { useReadingSections } from "../../readingApi";
import {
  toReadingSectionPickerOptions,
  type ReadingSectionPickerOption,
} from "../../entities/story/readingSectionAdapter";
import {
  getPresentationCueConfig,
  PresentationCueFields,
} from "./PresentationCueFields";
import { InformationActionFields } from "./InformationActionFields";
import { BroadcastActionFields } from "./BroadcastActionFields";
import { readAllPlayerReadingSectionId } from "./actionFieldHelpers";

export { PRESENTATION_CUE_ACTION_TYPES } from "./PresentationCueFields";

interface ActionListEditorProps {
  label: string;
  actions: PhaseAction[];
  onChange: (actions: PhaseAction[]) => void;
  hiddenTypes?: string[];
  allowedTypes?: readonly string[];
  themeId?: string;
}

export function ActionListEditor({
  label,
  actions,
  onChange,
  hiddenTypes = [],
  allowedTypes,
  themeId,
}: ActionListEditorProps) {
  const { data: readingSections = [] } = useReadingSections(themeId ?? "");
  const readingOptions = toReadingSectionPickerOptions(readingSections);
  const isTypeVisible = (type: string) =>
    !hiddenTypes.includes(type) && (!allowedTypes || allowedTypes.includes(type));
  const visibleActions = actions
    .map((action, index) => ({ action, index }))
    .filter(({ action }) => isTypeVisible(action.type));
  const visibleActionTypes = getVisibleCreatorActionOptions(hiddenTypes).filter(
    (actionType) => !allowedTypes || allowedTypes.includes(actionType.value),
  );
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

      {visibleActions.map(({ action, index: idx }, visibleIndex) => (
        <ActionRow
          key={action.id ?? idx}
          action={action}
          index={idx}
          displayIndex={visibleIndex}
          label={label}
          visibleActionTypes={visibleActionTypes}
          onTypeChange={handleTypeChange}
          onParamsChange={handleParamsChange}
          onRemove={handleRemove}
          themeId={themeId}
          readingOptions={readingOptions}
        />
      ))}
    </div>
  );
}

function createDefaultParams(type: string): Record<string, unknown> | undefined {
  if (type === DELIVER_INFORMATION_ACTION) {
    return { deliveries: [] };
  }
  if (type === "BROADCAST_MESSAGE") {
    return { message: "" };
  }
  return getPresentationCueConfig(type) ? {} : undefined;
}

export function hasIncompletePresentationCueActions(actions: PhaseAction[]): boolean {
  return actions.some((action) => {
    if (isInformationDeliveryAction(action)) {
      return readAllPlayerReadingSectionId(action.params) === "";
    }
    if (action.type === "BROADCAST_MESSAGE") {
      const message = action.params?.message;
      return typeof message !== "string" || message.trim().length === 0;
    }
    const config = getPresentationCueConfig(action.type);
    if (!config) return false;
    if (config.kind === "theme") {
      const themeToken = action.params?.themeToken;
      return typeof themeToken !== "string" || themeToken.trim().length === 0;
    }
    const mediaId = action.params?.mediaId;
    return typeof mediaId !== "string" || mediaId.trim().length === 0;
  });
}

export function isPresentationCueAction(action: PhaseAction): boolean {
  return getPresentationCueConfig(action.type) !== null;
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
  displayIndex: number;
  label: string;
  visibleActionTypes: ReturnType<typeof getVisibleCreatorActionOptions>;
  onTypeChange: (index: number, type: string) => void;
  onParamsChange: (index: number, params: Record<string, unknown>) => void;
  onRemove: (index: number) => void;
  themeId?: string;
  readingOptions: ReadingSectionPickerOption[];
}

function ActionRow({
  action,
  index,
  displayIndex,
  label,
  visibleActionTypes,
  onTypeChange,
  onParamsChange,
  onRemove,
  themeId,
  readingOptions,
}: ActionRowProps) {
  const hasCurrentOption = visibleActionTypes.some((actionType) => actionType.value === action.type);
  const fallbackLabel = getCreatorActionLabel(action.type);

  return (
    <div className="flex flex-col gap-2 rounded border border-slate-700 bg-slate-900 px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <select
          value={action.type}
          onChange={(e) => onTypeChange(index, e.target.value)}
          aria-label={`${label} ${displayIndex + 1} 실행 결과`}
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
          aria-label={`${label} ${displayIndex + 1} 삭제`}
          className="inline-flex h-9 w-9 items-center justify-center rounded text-slate-500 transition-colors hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {getPresentationCueConfig(action.type) ? (
        <PresentationCueFields
          action={action}
          label={label}
          index={displayIndex}
          themeId={themeId}
          onParamsChange={(params) => onParamsChange(index, params)}
        />
      ) : null}
      <InformationActionFields
        action={action}
        label={label}
        index={index}
        readingOptions={readingOptions}
        onParamsChange={(params) => onParamsChange(index, params)}
      />
      <BroadcastActionFields
        action={action}
        label={label}
        index={index}
        onParamsChange={(params) => onParamsChange(index, params)}
      />
    </div>
  );
}
