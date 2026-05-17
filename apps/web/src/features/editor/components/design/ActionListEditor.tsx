import { Plus, Trash2 } from "lucide-react";
import type { PhaseAction } from "../../flowTypes";
import {
  DELIVER_INFORMATION_ACTION,
  GRANT_CLUE_ACTION,
  type CreatorActionOption,
  getCreatorActionLabel,
  getVisibleCreatorActionOptions,
  isClueGrantAction,
  isInformationDeliveryAction,
} from "../../entities/shared/actionAdapter";
import { useEditorCharacters } from "../../api/characters";
import { useEditorClues } from "../../editorClueApi";
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
import { ClueGrantActionFields } from "./ClueGrantActionFields";
import { hasCompleteClueGrantParams } from "./clueGrantActionUtils";
import { readAllPlayerReadingSectionId } from "./actionFieldHelpers";
import type { InvestigationTokenDraft } from "../../entities/deckInvestigation/deckInvestigationAdapter";

export { PRESENTATION_CUE_ACTION_TYPES } from "./PresentationCueFields";

interface ActionListEditorProps {
  label: string;
  actions: PhaseAction[];
  onChange: (actions: PhaseAction[]) => void;
  hiddenTypes?: string[];
  allowedTypes?: readonly string[];
  themeId?: string;
  actionOptions?: CreatorActionOption[];
  createDefaultParamsForType?: (type: string) => Record<string, unknown> | undefined;
  preserveDisallowedActions?: boolean;
  investigationTokens?: InvestigationTokenDraft[];
}

export function ActionListEditor({
  label,
  actions,
  onChange,
  hiddenTypes = [],
  allowedTypes,
  themeId,
  actionOptions,
  createDefaultParamsForType,
  preserveDisallowedActions = false,
  investigationTokens = [],
}: ActionListEditorProps) {
  const { data: readingSections = [] } = useReadingSections(themeId ?? "");
  const { data: characters = [] } = useEditorCharacters(themeId ?? "");
  const { data: clues = [] } = useEditorClues(themeId ?? "");
  const readingOptions = toReadingSectionPickerOptions(readingSections);
  const characterOptions = characters.map((character) => ({
    id: character.id,
    name: character.name,
  }));
  const clueOptions = clues.map((clue) => ({
    id: clue.id,
    name: clue.name,
    summary: clue.is_common ? "공용 단서" : undefined,
  }));
  const isTypeVisible = (type: string) =>
    !hiddenTypes.includes(type) &&
    (preserveDisallowedActions || !allowedTypes || allowedTypes.includes(type));
  const visibleActions = actions
    .map((action, index) => ({ action, index }))
    .filter(({ action }) => isTypeVisible(action.type));
  const visibleActionTypes = (actionOptions ?? getVisibleCreatorActionOptions(hiddenTypes)).filter(
    (actionType) => !allowedTypes || allowedTypes.includes(actionType.value),
  );
  const defaultActionType = visibleActionTypes[0]?.value;
  const handleAdd = () => {
    if (!defaultActionType) return;
    const params = resolveDefaultParams(defaultActionType, createDefaultParamsForType);
    onChange([
      ...actions,
      {
        id: crypto.randomUUID(),
        type: defaultActionType,
        ...(params ? { params } : {}),
      },
    ]);
  };

  const handleRemove = (index: number) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  const handleTypeChange = (index: number, type: string) => {
    const next = actions.map((action, i) =>
      i === index ? withActionType(action, type, createDefaultParamsForType) : action,
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
          characters={characterOptions}
          clues={clueOptions}
          investigationTokens={investigationTokens}
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
    return { message: "", target: { type: "all_players" } };
  }
  if (type === GRANT_CLUE_ACTION) {
    return { deliveries: [] };
  }
  return getPresentationCueConfig(type) ? {} : undefined;
}

function resolveDefaultParams(
  type: string,
  customFactory?: (type: string) => Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  return customFactory ? customFactory(type) : createDefaultParams(type);
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
    if (isClueGrantAction(action)) {
      return !hasCompleteClueGrantParams(action.params);
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

function withActionType(
  action: PhaseAction,
  type: string,
  customFactory?: (type: string) => Record<string, unknown> | undefined,
): PhaseAction {
  const params = resolveDefaultParams(type, customFactory);
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
  characters: { id: string; name: string }[];
  clues: { id: string; name: string; summary?: string }[];
  investigationTokens: InvestigationTokenDraft[];
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
  characters,
  clues,
  investigationTokens,
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
        index={displayIndex}
        readingOptions={readingOptions}
        onParamsChange={(params) => onParamsChange(index, params)}
      />
      <BroadcastActionFields
        action={action}
        label={label}
        index={displayIndex}
        characters={characters}
        onParamsChange={(params) => onParamsChange(index, params)}
      />
      <ClueGrantActionFields
        action={action}
        characters={characters}
        clues={clues}
        onParamsChange={(params) => onParamsChange(index, params)}
      />
      <InvestigationTokenActionFields
        action={action}
        tokens={investigationTokens}
        onParamsChange={(params) => onParamsChange(index, params)}
      />
    </div>
  );
}

function InvestigationTokenActionFields({
  action,
  tokens,
  onParamsChange,
}: {
  action: PhaseAction;
  tokens: InvestigationTokenDraft[];
  onParamsChange: (params: Record<string, unknown>) => void;
}) {
  if (action.type !== "GRANT_INVESTIGATION_TOKEN" && action.type !== "RESET_INVESTIGATION_TOKEN") {
    return null;
  }

  const params = action.params ?? {};
  const selectedTokenId =
    typeof params.tokenId === "string" && params.tokenId
      ? params.tokenId
      : tokens[0]?.id ?? "";
  const amount =
    typeof params.amount === "number" && Number.isFinite(params.amount)
      ? Math.max(1, Math.floor(params.amount))
      : 1;

  return (
    <div className="rounded border border-slate-800 bg-slate-950/80 p-2">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_96px]">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-500">조사권</span>
          <select
            value={selectedTokenId}
            onChange={(event) => onParamsChange({ ...params, tokenId: event.target.value })}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
          >
            {tokens.map((token) => (
              <option key={token.id} value={token.id}>
                {token.iconLabel} {token.name}
              </option>
            ))}
          </select>
        </label>
        {action.type === "GRANT_INVESTIGATION_TOKEN" ? (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-500">추가 수량</span>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(event) =>
                onParamsChange({
                  ...params,
                  tokenId: selectedTokenId,
                  amount: Math.max(1, Number.parseInt(event.target.value || "1", 10)),
                })
              }
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
            />
          </label>
        ) : (
          <p className="rounded border border-slate-800 bg-slate-900/70 px-2 py-1.5 text-[11px] leading-4 text-slate-400">
            선택한 조사권을 시작 수량으로 되돌립니다.
          </p>
        )}
      </div>
      {tokens.length === 0 ? (
        <p className="mt-2 text-[11px] text-amber-300">조사권 설정에서 조사권을 먼저 추가해 주세요.</p>
      ) : null}
    </div>
  );
}
